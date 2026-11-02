# Final Pre-Deployment Security & Production Readiness Report

**Project:** SmartBiz Accounting & AI-Powered Ledger  
**Branch Under Audit:** `main` (Latest Commit: `0f592aa`, containing all security remediation from `8fd2270`)  
**Production Host:** Contabo VPS (`207.244.252.122`) — Container `smartbiz-app` at `https://accounts360.live`  
**Date:** 2026-11-03  
**Audit Scope:** Comprehensive pre-deployment security review across the 9 mandated domains.

---

## 1. Executive Summary & Verdict Table

| # | Audit Domain | Classification | Executive Verdict & Technical Summary |
| :-: | :--- | :---: | :--- |
| **1** | Multi-Process Read-Modify-Write Concurrency | **WARNING** | Atomic file replacement (`writeFileSync` + `renameSync`) prevents file corruption, but lack of OS-level file locking (`flock`) causes lost update increments if multiple processes handle concurrent failed attempts. In the current single-process deployment (`node server.js`), the JavaScript event loop serializes execution, but horizontal scaling requires Redis or DB transactions. |
| **2** | Journal File Permissions & Container Isolation | **PASS** *(Mode Warning)* | Container runs as unprivileged user `nextjs` (UID 1001). `/tmp` is unmounted host filesystem, private to container mount namespace. Other containers and unprivileged host users cannot access it. *Note: File is written with default umask (`0o644`) rather than explicit `0o600`.* |
| **3** | `/tmp` Persistence & Docker Restart Lifecycles | **PASS** *(Ephemeral)* | `/tmp` survives container restarts (`restart: unless-stopped`) and process reboots. Re-created empty on `docker compose down` or new image deployment, which is standard and acceptable for an ephemeral 15-minute sliding-window cache. |
| **4** | Reverse Proxy Client IP Trust & Header Precedence | **FAIL** | `getClientIp()` inspects `x-forwarded-for` (`ips[0]`) before `x-real-ip`. Nginx appends `$remote_addr` via `$proxy_add_x_forwarded_for`, leaving the leftmost IP attacker-controlled. An attacker can inject a fake leading IP into `X-Forwarded-For` to evade IP rate limiting. |
| **5** | Lockout Bypass via Key Manipulation | **PASS** *(Account)* / **FAIL** *(IP Spray)* | Targeted account brute force cannot bypass the 5-attempt limit because `emailKey` is normalized with `.toLowerCase().trim()` and tracked independently of IP. However, distributed password spraying across different accounts is vulnerable to the IP spoofing issue in Domain 4. |
| **6** | JWT Verification Consistency | **PASS** | Edge middleware and server auth use identical `JWT_SECRET`, HMAC-SHA256 (`HS256`), and standard Unix epoch second `exp` validation. Token expiration, algorithm, and signature checks are 100% consistent across all entry points. |
| **7** | Privileged Endpoints Authorization | **WARNING** | All `/api/*` endpoints are protected at Edge middleware by cryptographic JWT validation; platform admin endpoints enforce strict role checks (`SUPER_ADMIN` / `ADMIN`). However, two sub-endpoints (`POST /api/sales/[id]/reverse` and `POST /api/branches/[id]/assign`) lack tenant-ownership checks (BOLA gaps). |
| **8** | Production Backup & Rollback Readiness | **WARNING** | `scripts/backup-db.sh` provides daily automated `pg_dump` with 14-day retention. However, `scripts/deploy.sh` does not take an automated pre-deploy snapshot, and no automated restore script (`restore-db.sh`) or single-command application rollback exists. |
| **9** | Production Config vs Tested Build Alignment | **PASS** *(Body Disparity)* | Verified live VPS environment: standalone Next.js 14 matches Dockerfile runner, container port `3001` matches proxy upstream, and healthchecks pass. *Minor gap: Nginx permits `client_max_body_size 25M;` while AI route enforces 14MB.* |

---

## 2. In-Depth Technical Findings by Domain

### 1. Multi-Process Read-Modify-Write Concurrency in Rate Limiter
* **Classification:** **WARNING**
* **Technical Mechanism:**
  In `src/lib/rateLimit.ts`:
  ```typescript
  export function recordFailedLogin(key: string): RateLimitCheckResult {
    const disk = loadPersistedState();
    if (disk.has(key)) {
      memoryStore.set(key, disk.get(key)!);
    }
    // modify entry.count ...
    savePersistedState(memoryStore);
  }
  ```
  `savePersistedState()` uses atomic file replacement (`fs.writeFileSync(tempFile, ...)` followed by `fs.renameSync(tempFile, PERSISTENCE_FILE)`). While `renameSync` ensures that readers never encounter a corrupted or partially written JSON file, there is no inter-process mutex or file lock (`flock`).
* **Concurrency Impact:**
  1. **Lost Update on Concurrent Requests:** If two failed login requests for the same target key hit simultaneously across two separate Node processes within the same millisecond:
     - Process 1 reads disk state (`count: 1`).
     - Process 2 reads disk state before Process 1 writes (`count: 1`).
     - Process 1 writes `count: 2` and renames.
     - Process 2 writes `count: 2` and renames.
     *Result:* One count increment is lost under simultaneous concurrent race conditions.
  2. **Cross-Key Erasure:** In lines 141–144, `recordFailedLogin` only copies the specific requested key from disk into `memoryStore`. When Process B writes `memoryStore` to disk, it does not include keys recorded by Process A that were not in Process B's memory, potentially erasing concurrent keys on disk.
* **Production Context & Mitigation:**
  In the current live deployment (`docker-compose.prod.yml`), `smartbiz-app` runs as a single Node.js process (`node server.js` standalone), not a multi-process cluster (no PM2 cluster mode or multi-replica setup). Within a single Node.js process, synchronous file reads and writes are serialized by the JavaScript event loop. However, before horizontally scaling to multiple instances or worker threads, an atomic Redis store (`ioredis` with Lua scripts / `INCR` + `EXPIRE`) or PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) is required for strict ACID rate-limiting.

---

### 2. Journal File Permissions & Container Isolation
* **Classification:** **PASS** *(with Default File Mode Warning)*
* **Technical Mechanism:**
  * **User Execution:** As defined in `Dockerfile` (lines 42–52), the production runner executes under dedicated unprivileged system user `nextjs` (UID 1001, GID 1001).
  * **Filesystem Namespace Isolation:** In Linux containers, `/tmp` is located on the container's overlay filesystem (`overlay2`) and is isolated within the container's private mount namespace.
  * **Inter-Container Security:** In `docker-compose.prod.yml`, no host volume is mapped to `/tmp`. Neighboring containers on the Contabo VPS (such as `contract-genie-db`, `contract-genie-app`, and `contract-genie-cron`) run in distinct mount namespaces and have zero filesystem access to `smartbiz-app`'s `/tmp/sb_login_rate_limits.json`.
  * **Host User Isolation:** Only the host `root` user can inspect the container overlay directory. Unprivileged users on the host or in other containers cannot read or tamper with rate-limit state.
  * **File Permissions Mode:** In line 54, `fs.writeFileSync(tempFile, ...)` is called without an explicit `mode: 0o600`. It defaults to `0o666 & ~umask` (typically `0o644`). Because only `nextjs` and `root` exist in the container, no local privilege escalation is possible, but explicit `0o600` is recommended for defense-in-depth.
  * **Data Stored:** The file contains only IP addresses, email strings, attempt counters, and timestamps. It contains zero passwords, password hashes, or session tokens.

---

### 3. `/tmp` Persistence & Docker Restart Lifecycles
* **Classification:** **PASS** *(for Ephemeral Sliding Window Cache)*
* **Technical Mechanism:**
  * **Container Restarts:** When the container restarts via Docker daemon restart policies (`restart: unless-stopped` or `docker restart smartbiz-app`), the container's writable overlay layer is preserved. `/tmp/sb_login_rate_limits.json` survives container restarts.
  * **Process Crashes:** If the `node server.js` process is restarted internally, `/tmp` retains state.
  * **Container Recreation (`docker compose down` / New Deployment):** When a new container image is built and replaced during a deployment (`docker compose up -d`), a fresh container layer is provisioned, resetting `/tmp`.
* **Security Evaluation:**
  Because the rate limiter implements an ephemeral 15-minute sliding window (`LOGIN_WINDOW_MS = 15 * 60 * 1000`), discarding historical failed attempt state during an intentional, operator-initiated software deployment is benign and standard for ephemeral caching tiers. However, an attacker who is temporarily locked out will have their lockout timer cleared if a container deployment occurs within their 15-minute lockout window.

---

### 4. Reverse Proxy Client IP Trust & Header Precedence
* **Classification:** **FAIL**
* **Technical Mechanism:**
  In `deploy/nginx/myaccounts360.com.conf` (lines 63–64):
  ```nginx
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  ```
  Nginx's `$proxy_add_x_forwarded_for` appends the client's socket IP to the end of any incoming `X-Forwarded-For` header. If an attacker sends:
  `X-Forwarded-For: 198.51.100.1`
  Nginx passes:
  `X-Forwarded-For: 198.51.100.1, <client_real_ip>`
  In `src/lib/rateLimit.ts` (lines 69–80):
  ```typescript
  export function getClientIp(req: NextRequest): string {
    const xForwardedFor = req.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const ips = xForwardedFor.split(",").map((ip) => ip.trim());
      if (ips[0]) return ips[0]; // Returns client-spoofed leading IP!
    }
    const xRealIp = req.headers.get("x-real-ip");
    if (xRealIp) return xRealIp.trim();
  }
  ```
* **Vulnerability Analysis:**
  Because `ips[0]` evaluates the leftmost IP, an attacker sending requests with rotated `X-Forwarded-For` values can bypass the IP-based counter (`ip:<fake_ip>`). The trusted `X-Real-IP` (which Nginx forcibly sets to `$remote_addr`) is on line 75 and is never reached whenever `X-Forwarded-For` is present.
* **Compensating Control:**
  In `src/app/api/auth/login/route.ts`:
  `const emailCheck = checkLoginRateLimit(emailKey);`
  The login endpoint enforces dual-key validation: both the IP key and the email key must pass. Targeted credential brute force against any specific account is strictly blocked at 5 attempts by the email key, preventing account takeover. However, distributed password spraying across different accounts is vulnerable to this IP spoofing flaw.
* **Remediation Plan:**
  Update `getClientIp()` to evaluate `req.headers.get("x-real-ip")` first, as Nginx guarantees `$remote_addr` overwrites any client-supplied `X-Real-IP`.

---

### 5. Lockout Bypass via Key Manipulation
* **Classification:** **PASS** *(Targeted Account Defense)* / **FAIL** *(Password Spraying)*
* **Technical Mechanism:**
  * **Targeted Account Brute-Force (PASS):** In `src/app/api/auth/login/route.ts`, the target email is explicitly sanitized:
    `const cleanEmail = email.toLowerCase().trim();`
    Attempts with varied casing (`User@Domain.com`, `USER@DOMAIN.COM`) or trailing whitespace map to the identical key (`email:user@domain.com`).
  * **State Reset Logic:** `resetLoginRateLimit()` is triggered exclusively upon successful password verification. An attacker receiving `401 Unauthorized` cannot trigger a counter reset.
  * **Lockout Persistence:** Once `blockedUntil` is set ($now + 15\text{ mins}$), subsequent requests return `HTTP 429 Too Many Requests` with header `Retry-After: 900` without reaching password comparison or database queries.
  * **Password Spraying Bypass (FAIL):** As documented in Domain 4, an attacker attempting 1 password across 10,000 different emails can bypass IP rate limiting by rotating `X-Forwarded-For` headers.

---

### 6. JWT Verification Consistency Between Middleware and Server-Side Auth
* **Classification:** **PASS**
* **Technical Mechanism:**
  * **Shared Secret:** Both `src/middleware.ts` (line 4) and `src/lib/auth.ts` (line 6) resolve secrets from `process.env.JWT_SECRET` with identical fallbacks.
  * **Cryptographic Algorithm:**
    * Signing: `jsonwebtoken.sign()` uses HMAC SHA-256 (`HS256`).
    * Middleware Verification: Web Crypto API (`crypto.subtle.importKey("raw", ..., { name: "HMAC", hash: "SHA-256" })` + `crypto.subtle.verify("HMAC", ...)`).
    * Server-side Verification: `jsonwebtoken.verify()`.
  * **Expiration Validation:** Standard Unix epoch timestamps (`exp` in seconds) are evaluated identically across layers (`Date.now() >= payload.exp * 1000`).
  * **Cookie Configuration:** `sb_auth_token` is configured with `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `secure: true` in production.
  * **Test Verification:** Verified by automated unit tests in `test/security_hardening.test.ts` (Valid token accepted, forged secret rejected, tampered payload rejected, expired token rejected).

---

### 7. Privileged Endpoints Authorization
* **Classification:** **WARNING** *(Two Sub-Endpoint BOLA Gaps)*
* **Technical Mechanism:**
  * **Perimeter Defense (`src/middleware.ts`):** All `/api/*` endpoints (except `/api/health`, `/api/auth/login`, and `/api/verify/*`) require a valid cryptographically verified JWT in Edge middleware.
  * **Administrative Endpoints (PASS):**
    * `POST /api/admin/companies/reset-transactions`: Enforces `SUPER_ADMIN` strictly.
    * `PUT /api/admin/users/[id]` & `DELETE /api/admin/users/[id]`: Enforces `SUPER_ADMIN` strictly.
    * `GET/POST /api/admin/companies`, `GET/POST /api/admin/users`, `GET/POST /api/admin/billing`: Enforces `SUPER_ADMIN` or `ADMIN`.
    * `PUT /api/admin/companies/[id]`: Enforces tenant boundary for `OWNER_ADMIN` (`session.businessId === id || session.companyIds.includes(id)`).
    * `POST /api/auth/switch-user`: Enforces `SUPER_ADMIN` or active impersonation flag (`session.isSwitched`).
    * `POST /api/auth/switch-company`: Enforces authenticated session and validates tenant membership in database or session payload.
  * **Identified Gaps (WARNING):**
    1. `POST /api/sales/[id]/reverse`: Middleware ensures the caller is logged in, but the route does not verify that the target sale (`id`) belongs to the caller's active business (`businessId`). A logged-in user in Tenant A could attempt to call `/api/sales/<tenant_b_sale_id>/reverse` to cancel an invoice belonging to Tenant B.
    2. `POST /api/branches/[id]/assign`: Authorizes `OWNER_ADMIN`, but does not verify that the target `branchId` or `userId` belong to the `OWNER_ADMIN`'s own company.

---

### 8. Production Backup & Rollback Readiness
* **Classification:** **WARNING**
* **Technical Mechanism:**
  * **Backup Infrastructure (PASS):** `scripts/backup-db.sh` exists and automates `pg_dump` with gzip compression, outputs to `/var/backups/smartbiz-db`, and enforces 14-day automated retention cleanup.
  * **Automated Pre-Deploy Backup (WARNING):** `scripts/deploy.sh` does not automatically invoke `backup-db.sh` prior to building containers or running `prisma db push`.
  * **Database Restore Procedure (WARNING):** There is no automated restore script (`scripts/restore-db.sh`) or step-by-step restoration verification test in repository operational documentation.
  * **Application Rollback Procedure (WARNING):** `scripts/deploy.sh` does not retain the previous Docker image tag (e.g. `smartbiz-accounting:previous`) or provide an automated single-command rollback if a post-deploy issue is detected after the healthcheck passes. Rollback requires manual operator SSH commands (`git checkout <tag/commit>`, `docker compose build && docker compose up -d`).

---

### 9. Production Config vs Tested Build Alignment
* **Classification:** **PASS** *(with Body Size Disparity Warning)*
* **Technical Mechanism:**
  * **Live Container Status:** Read-only inspection of Contabo VPS confirmed `smartbiz-app` is currently `Up (healthy)` on `127.0.0.1:3001` with 3ms DB latency.
  * **Environment Variables:** Verified `JWT_SECRET` and `GEMINI_API_KEY` are configured in `/opt/smartbiz-accounting/.env.production` with strict permissions.
  * **Build Artifacts:** `npm run build` compiled with Next.js 14 standalone configuration matching `Dockerfile` Stage 3 (`runner`). All 42 routes and 30+ API endpoints compile cleanly without type or build errors.
  * **Body Size Limit Disparity (WARNING):** Nginx sets `client_max_body_size 25M;` while `src/app/api/ai/extract/route.ts` enforces 14MB (`MAX_IMAGE_PAYLOAD_CHARS = 14 * 1024 * 1024`). Payloads between 14MB and 25MB will pass Nginx and be buffered into Node memory before receiving HTTP 413 from the application.

---

## 3. Actionable Remediation Checklist (Prior to Final Approval)

Before authorizing full production sign-off, the following 3 items should be addressed:

1. **Fix Client IP Spoofing in `rateLimit.ts` (Domain 4 & 5):**
   Change `getClientIp()` to prioritize `req.headers.get("x-real-ip")` before `x-forwarded-for`:
   ```typescript
   export function getClientIp(req: NextRequest): string {
     const xRealIp = req.headers.get("x-real-ip");
     if (xRealIp) return xRealIp.trim();
     const xForwardedFor = req.headers.get("x-forwarded-for");
     if (xForwardedFor) {
       const ips = xForwardedFor.split(",").map((ip) => ip.trim());
       if (ips[0]) return ips[0];
     }
     return (req as any).ip || "127.0.0.1";
   }
   ```
2. **Add Tenant Ownership Check to `sales/[id]/reverse` (Domain 7):**
   Verify `sale.businessId === activeBusinessId` before executing the reversal transaction.
3. **Document Pre-Deployment Backup & Restore Command in `scripts/deploy.sh` (Domain 8):**
   Add automated execution of `scripts/backup-db.sh` as Step 0 in `deploy.sh`.

---

## 4. Current State & Strict Rules Compliance

* **Application Code Files Modified This Turn:** None.
* **Database State:** Untouched.
* **Server State:** Untouched.
* **Branches:** Unmerged. Main remains up-to-date with remote.
* **Deployment:** Not executed.

**Report complete. Awaiting user review and approval.**
