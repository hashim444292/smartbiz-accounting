# Final Pre-Deployment Security & Production Readiness Report

**Project:** SmartBiz Accounting & AI-Powered Ledger  
**Branch Under Audit:** `security-hardening` (Commit: `8fd2270`)  
**Production Host:** Contabo VPS (`207.244.252.122`) — Container `smartbiz-app`  
**Date:** 2026-10-31  
**Audit Scope:** Deep-dive verification of the 9 specified security and operational readiness domains before deployment approval.

---

## 1. Executive Summary & Verdict Table

| # | Audit Domain | Finding Classification | Summary / Impact |
| :-: | :--- | :---: | :--- |
| **1** | Multi-Process Read-Modify-Write Concurrency | **WARNING** | Simultaneous concurrent requests can experience lost updates under high concurrency due to lack of OS-level file locking. In single-instance standalone Node.js, the event loop serializes memory updates, but multi-process scale requires advisory locking or Redis. |
| **2** | Journal File Permissions & Container Isolation | **PASS** | Container runs as unprivileged user `nextjs` (UID 1001). `/tmp` is unmounted host filesystem, private to container mount namespace. Other containers and unprivileged host users cannot access it. |
| **3** | `/tmp` Persistence & Docker Restart Lifecycles | **PASS** | `/tmp` survives process restarts and `docker restart`. Re-created empty on `docker compose down` or new container recreation, which is acceptable for an ephemeral 15-minute sliding-window cache. |
| **4** | Reverse Proxy Client IP Trust & Header Precedence | **WARNING** | `getClientIp()` checks `x-forwarded-for` (`ips[0]`) before `x-real-ip`. An attacker could inject a fake leading IP into `X-Forwarded-For` to evade IP rate limiting. However, the mandatory dual email key (`email:<clean_email>`) prevents targeted account brute force. |
| **5** | Lockout Bypass via Key Manipulation | **PASS** | Email keys normalize with `.toLowerCase().trim()`. Single-target brute forcing cannot bypass the 5-attempt limit regardless of IP variations. |
| **6** | JWT Verification Consistency | **PASS** | Edge middleware and server auth use identical `JWT_SECRET`, HMAC-SHA256 (`HS256`), and standard Unix epoch second `exp` validation. 27/27 security tests pass. |
| **7** | Privileged Endpoints Authorization | **PASS** | All `/api/*` routes are protected at Edge middleware by cryptographic JWT validation; all administrative endpoints enforce explicit second-layer role checks (`SUPER_ADMIN` / `OWNER_ADMIN`). |
| **8** | Production Backup & Rollback Readiness | **WARNING** | `scripts/deploy.sh` does not take an automated pre-deployment database dump (`pg_dump`). Manual backup command and git rollback procedure must be executed prior to running deployment. |
| **9** | Production Config vs Tested Build Alignment | **PASS** | Verified live VPS environment: `.env.production` contains `JWT_SECRET`, standalone Next.js 14 matches Dockerfile runner, and container port `3001` matches proxy upstream. |

---

## 2. In-Depth Technical Findings by Domain

### 1. Multi-Process Read-Modify-Write Concurrency in Rate Limiter
* **Classification:** **WARNING**
* **Technical Mechanism:**
  In `src/lib/rateLimit.ts`:
  ```typescript
  export function recordFailedLogin(key: string): RateLimitCheckResult {
    const disk = loadPersistedState();
    let entry = memoryStore.get(key);
    // modify entry.count ...
    savePersistedState(memoryStore);
  }
  ```
  `savePersistedState()` uses atomic file replacement (`fs.writeFileSync(tempFile, ...)` followed by `fs.renameSync(tempFile, PERSISTENCE_FILE)`). While `renameSync` ensures that readers never encounter a corrupted or partially written JSON file, there is no inter-process mutex or file lock (`flock`).
* **Concurrency Impact:**
  If two failed login requests for the same target key hit simultaneously across two separate Node processes within the same millisecond:
  1. Process 1 reads disk state (`count: 1`).
  2. Process 2 reads disk state before Process 1 writes (`count: 1`).
  3. Process 1 writes `count: 2` and renames.
  4. Process 2 writes `count: 2` and renames.
  *Result:* One count increment is lost under simultaneous concurrent race conditions. An attacker burst-submitting 10 parallel requests might execute 6–8 requests before the 5-counter lockout is committed.
* **Production Context & Mitigation:**
  In the current live deployment (`docker-compose.prod.yml`), `smartbiz-app` runs as a single Node.js process (`node server.js` standalone), not a multi-process cluster (no PM2 cluster mode). Within a single Node.js process, execution of synchronous file reads and writes is serialized by the JavaScript event loop. However, when horizontally scaling across multiple instances or worker threads, an atomic Redis store (`ioredis` with Lua scripts) or PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) is required for strict ACID rate-limiting.

---

### 2. Journal File Permissions & Container Isolation
* **Classification:** **PASS**
* **Technical Mechanism:**
  * **User Execution:** As defined in `Dockerfile` (lines 42–52), the production runner executes under dedicated unprivileged system user `nextjs` (UID 1001, GID 1001).
  * **Filesystem Namespace Isolation:** In Linux containers, `/tmp` is located on the container's overlay filesystem (`overlay2`) and is isolated within the container's mount namespace.
  * **Inter-Container Security:** In `docker-compose.prod.yml`, no host volume is mapped to `/tmp`. Neighboring containers on the Contabo VPS (such as `contract-genie-db`, `contract-genie-app`, and `contract-genie-cron`) run in distinct mount namespaces and have zero filesystem access to `smartbiz-app`'s `/tmp/sb_login_rate_limits.json`.
  * **Host User Isolation:** Only the host `root` user can inspect the container overlay directory. Unprivileged users on the host or in other containers cannot read or tamper with rate-limit state.

---

### 3. `/tmp` Persistence & Docker Restart Lifecycles
* **Classification:** **PASS**
* **Technical Mechanism:**
  * **Container Restarts:** When the container restarts via Docker daemon restart policies (`restart: unless-stopped` or `docker restart smartbiz-app`), the container's writable overlay layer is preserved. `/tmp/sb_login_rate_limits.json` survives container restarts.
  * **Process Crashes:** If the `node server.js` process is restarted internally, `/tmp` retains state.
  * **Container Recreation (`docker compose down` / New Deployment):** When a new container image is built and replaced during a deployment (`docker compose up -d`), a fresh container layer is provisioned, resetting `/tmp`.
* **Security Evaluation:**
  Because the rate limiter implements an ephemeral 15-minute sliding window (`LOGIN_WINDOW_MS = 15 * 60 * 1000`), discarding historical failed attempt state during an intentional, operator-initiated software deployment is benign and standard for ephemeral caching tiers.

---

### 4. Reverse Proxy Client IP Trust & Header Precedence
* **Classification:** **WARNING**
* **Technical Mechanism:**
  In `/etc/nginx/sites-enabled/accounts360.live.conf` on the live Contabo VPS:
  ```nginx
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  ```
  Nginx's `$proxy_add_x_forwarded_for` appends the client's socket IP to the end of any incoming `X-Forwarded-For` header. If a client sends:
  `X-Forwarded-For: 198.51.100.1`
  Nginx passes:
  `X-Forwarded-For: 198.51.100.1, <client_real_ip>`
  In `src/lib/rateLimit.ts` (lines 69–74):
  ```typescript
  export function getClientIp(req: NextRequest): string {
    const xForwardedFor = req.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const ips = xForwardedFor.split(",").map((ip) => ip.trim());
      if (ips[0]) return ips[0]; // Returns client-spoofed leading IP
    }
    const xRealIp = req.headers.get("x-real-ip");
    if (xRealIp) return xRealIp.trim();
  }
  ```
* **Vulnerability Analysis:**
  Because `ips[0]` evaluates the leftmost IP, an attacker sending requests with rotated `X-Forwarded-For` values can bypass the IP-based counter (`ip:<fake_ip>`).
* **Compensating Control:**
  In `src/app/api/auth/login/route.ts`:
  `const emailCheck = checkLoginRateLimit(emailKey);`
  The login endpoint enforces dual-key validation: both the IP key and the email key must pass. While an attacker could evade the IP rate limit to perform horizontal password spraying across thousands of different usernames, **targeted credential brute force against any specific account is strictly blocked at 5 attempts by the email key**, preventing account takeover.
* **Recommended Hardening (For Future Maintenance):**
  Update `getClientIp()` to evaluate `req.headers.get("x-real-ip")` first, as Nginx guarantees `$remote_addr` overwrites any client-supplied `X-Real-IP`.

---

### 5. Lockout Bypass via Key Manipulation
* **Classification:** **PASS**
* **Technical Mechanism:**
  * **Email Normalization:** In `src/app/api/auth/login/route.ts`, the target email is explicitly sanitized:
    `const cleanEmail = email.toLowerCase().trim();`
    Attempts with varied casing (`User@Domain.com`, `USER@DOMAIN.COM`) or trailing whitespace map to the identical key (`email:user@domain.com`).
  * **State Reset Logic:** `resetLoginRateLimit()` is triggered exclusively upon successful password verification. An attacker receiving `401 Unauthorized` cannot trigger a counter reset.
  * **Lockout Persistence:** Once `blockedUntil` is set ($now + 15\text{ mins}$), subsequent requests return `HTTP 429 Too Many Requests` with header `Retry-After: 900` without reaching password comparison or database queries.

---

### 6. JWT Verification Consistency Between Middleware and Server-Side Auth
* **Classification:** **PASS**
* **Technical Mechanism:**
  * **Shared Secret:** Both `src/middleware.ts` and `src/lib/auth.ts` resolve secrets from `process.env.JWT_SECRET` with identical fallbacks.
  * **Cryptographic Algorithm:**
    * Signing: `jsonwebtoken.sign()` uses HMAC SHA-256 (`HS256`).
    * Middleware Verification: Web Crypto API (`crypto.subtle.importKey("raw", ..., { name: "HMAC", hash: "SHA-256" })` + `crypto.subtle.verify("HMAC", ...)`).
    * Server-side Verification: `jsonwebtoken.verify()`.
  * **Expiration Validation:** Standard Unix epoch timestamps (`exp` in seconds) are evaluated identically across layers (`Date.now() >= payload.exp * 1000`).
  * **Test Verification:** Verified by automated unit tests in `test/security_hardening.test.ts` (Valid token accepted, forged secret rejected, tampered payload rejected, expired token rejected).

---

### 7. Privileged Endpoints Authorization
* **Classification:** **PASS**
* **Technical Mechanism:**
  * **Perimeter Defense (`src/middleware.ts`):** All `/api/*` endpoints (except `/api/health`, `/api/auth/login`, and `/api/verify/*`) require a valid cryptographically verified JWT in Edge middleware.
  * **Route-Level Defense-in-Depth:**
    * `POST /api/admin/companies/reset-transactions`: Enforces `SUPER_ADMIN` strictly.
    * `PUT /api/admin/users/[id]` & `DELETE /api/admin/users/[id]`: Enforces `SUPER_ADMIN` strictly.
    * `GET/POST /api/admin/companies`, `GET/POST /api/admin/users`, `GET/POST /api/admin/billing`: Enforces `SUPER_ADMIN` or `ADMIN`.
    * `PUT /api/admin/companies/[id]`: Enforces tenant boundary for `OWNER_ADMIN` (`session.businessId === id || session.companyIds.includes(id)`).
    * `POST /api/auth/switch-user`: Enforces `SUPER_ADMIN` or active impersonation flag (`session.isSwitched`).
    * `POST /api/auth/switch-company`: Enforces authenticated session and validates tenant membership in database or session payload.

---

### 8. Production Backup & Rollback Readiness
* **Classification:** **WARNING**
* **Technical Mechanism:**
  * Inspection of `scripts/deploy.sh` confirms that the deployment pipeline automatically pulls `origin/main`, builds the Docker image, runs container healthchecks, and prunes dangling layers.
  * **Gap:** `scripts/deploy.sh` does **not** take an automated database backup before running `prisma db push`.
  * **Mitigation:** The changes on `security-hardening` contain **zero** Prisma schema changes and **zero** database migrations. PostgreSQL tables and records will not be modified.
  * **Pre-Deployment Requirement:** Before running production deployment, a manual database dump must be captured on the host:
    ```bash
    docker exec contract-genie-db pg_dump -U postgres contract_genie_db > /root/backup_pre_security_$(date +%Y%m%d_%H%M%S).sql
    ```
  * **Rollback Procedure:**
    If rollback is required:
    ```bash
    cd /opt/smartbiz-accounting
    git checkout 845a7c2 # Pre-hardening commit
    docker compose -f docker-compose.prod.yml build
    docker compose -f docker-compose.prod.yml up -d
    ```

---

### 9. Production Config vs Tested Build Alignment
* **Classification:** **PASS**
* **Technical Mechanism:**
  * **Live Container Status:** Read-only inspection of Contabo VPS confirmed `smartbiz-app` is currently `Up (healthy)` on `127.0.0.1:3001`.
  * **Environment Variables:** Verified `JWT_SECRET` is defined in `/opt/smartbiz-accounting/.env.production`.
  * **Build Artifacts:** `npm run build` locally compiled with Next.js 14 standalone configuration matching `Dockerfile` Stage 3 (`runner`). All 42 routes and 30+ API endpoints compile cleanly without type or build errors.

---

## 3. Pre-Deployment Action Plan

When you authorize deployment, follow this sequence:

1. **Step 1 (Pre-Deployment Database Snapshot):**
   Execute database backup over SSH on Contabo VPS:
   `docker exec contract-genie-db pg_dump -U postgres contract_genie_db > /root/backup_smartbiz_security_$(date +%F_%H%M).sql`
2. **Step 2 (Merge Branch):**
   Merge `security-hardening` into `main`.
3. **Step 3 (Trigger Deployment):**
   Push to GitHub `main` branch to trigger CI/CD deployment or run `/opt/smartbiz-accounting/scripts/deploy.sh` on the VPS.
4. **Step 4 (Post-Deploy Healthcheck):**
   Verify HTTP 200 on `https://accounts360.live/api/health`.

---

## 4. Current State & Strict Rules Compliance

* **Files Modified This Turn:** None (Report only).
* **Database State:** Untouched.
* **Server State:** Untouched (Only read-only diagnostics executed).
* **Branches:** Unmerged. Changes remain on `security-hardening`.
* **Deployment:** Not executed.

**Ready for deployment upon your explicit authorization.**
