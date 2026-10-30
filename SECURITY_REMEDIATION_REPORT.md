# Security Remediation & Verification Report

**Project:** SmartBiz Accounting & AI-Powered Ledger  
**Branch:** `security-hardening`  
**Date:** 2026-10-31  
**Status:** Remediated & Verified (100% Test Pass Rate, Production Build Clean)  
**Deployment Policy:** Local Remediation & Verification Complete — No Automatic Deployment

---

## 1. Executive Summary

A comprehensive application security remediation was conducted targeting 8 critical and high-severity vulnerabilities (`VULN-01` through `VULN-08`). All fixes were implemented in application code with minimal, targeted changes adhering strictly to the security-only mandate:
- **No UI/UX or styling modifications**: User interfaces, layouts, animations, and components remain identical.
- **No business logic alterations**: Accounting ledgers, double-entry rules, and invoice processing remain untouched.
- **No database migrations or mutations**: Production PostgreSQL tables, schema, and records were not modified or migrated.
- **No infrastructure mutations**: Contabo VPS SSH, firewall, Nginx, Docker, and system configs remain untouched.
- **Zero regressions**: All 26 test suites (216/216 tests, 100%) pass cleanly. Next.js 14 production build succeeds with all 42 routes.

---

## 2. Vulnerabilities Remediated & Code Diffs

### VULN-01: Cryptographic JWT Signature & Expiration Verification
- **Severity:** Critical
- **Affected File:** `src/middleware.ts`
- **Root Cause:** Next.js Edge middleware previously unpacked JWTs using an unverified `atob()` base64 JSON parse without cryptographic signature validation. An attacker could forge any arbitrary JWT (e.g. `role: "SUPER_ADMIN"`) and bypass authentication.
- **Fix Implemented:** Replaced base64 parsing with genuine HMAC-SHA256 signature verification using the Web Crypto API (`crypto.subtle.importKey` + `crypto.subtle.verify`) matching `JWT_SECRET`. Added validation for token expiration (`exp`) and payload integrity.
- **Diff:**
```diff
--- a/src/middleware.ts
+++ b/src/middleware.ts
+async function verifyJwt(token?: string | null): Promise<boolean> {
+  if (!token || typeof token !== "string") return false;
+  const parts = token.split(".");
+  if (parts.length !== 3) return false;
+  const [headerB64, payloadB64, signatureB64] = parts;
+  try {
+    const encoder = new TextEncoder();
+    const key = await crypto.subtle.importKey(
+      "raw",
+      encoder.encode(JWT_SECRET),
+      { name: "HMAC", hash: "SHA-256" },
+      false,
+      ["verify"]
+    );
+    const signatureBytes = base64UrlToUint8Array(signatureB64);
+    const dataBytes = encoder.encode(`${headerB64}.${payloadB64}`);
+    const isValidSig = await crypto.subtle.verify("HMAC", key, signatureBytes as any, dataBytes);
+    if (!isValidSig) return false;
+    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
+    const payload = JSON.parse(payloadJson);
+    if (payload.exp && Date.now() >= payload.exp * 1000) return false;
+    return Boolean(payload.userId && payload.role);
+  } catch {
+    return false;
+  }
+}
```

---

### VULN-02: Broken Object-Level Authorization (BOLA) in Active Business Resolver
- **Severity:** High
- **Affected File:** `src/lib/businessHelper.ts`
- **Root Cause:** `getActiveBusinessId` previously accepted untrusted client headers (`x-business-id`) and cookies (`sb_active_business_id`) without verifying user membership, enabling cross-tenant data access.
- **Fix Implemented:** Candidate business IDs from headers or cookies are strictly validated against `session.companyIds`, `session.businessId`, and database `BusinessMember` memberships. Unauthorized IDs are rejected and safely fall back to the authenticated user's own authorized company. Only `SUPER_ADMIN` retains multi-tenant switching privileges.
- **Diff:**
```diff
--- a/src/lib/businessHelper.ts
+++ b/src/lib/businessHelper.ts
+  let validatedBusinessId: string | null = null;
+  if (session) {
+    const isSuperAdmin = session.role === "SUPER_ADMIN";
+    const userCompanyIds = Array.isArray(session.companyIds) && session.companyIds.length > 0
+      ? session.companyIds
+      : (session.businessId ? [session.businessId] : []);
+    if (candidate) {
+      if (isSuperAdmin || userCompanyIds.includes(candidate)) {
+        validatedBusinessId = candidate;
+      } else if (process.env.DATABASE_URL) {
+        // Database membership verification
+      }
+    }
+    if (!validatedBusinessId) validatedBusinessId = session.businessId || userCompanyIds[0] || null;
+  }
```

---

### VULN-03: Missing Privileged Authorization on Company Transactions Reset
- **Severity:** Critical
- **Affected File:** `src/app/api/admin/companies/reset-transactions/route.ts`
- **Root Cause:** The transaction reset endpoint allowed unauthenticated or non-privileged users to purge company data.
- **Fix Implemented:** Enforced strict Super Admin authorization (`if (!session || session.role !== "SUPER_ADMIN") return 403 Forbidden`).
- **Diff:**
```diff
--- a/src/app/api/admin/companies/reset-transactions/route.ts
+++ b/src/app/api/admin/companies/reset-transactions/route.ts
@@ -10,2 +10,6 @@ export async function POST(req: NextRequest) {
   try {
+    const session = await getSession(req);
+    if (!session || session.role !== "SUPER_ADMIN") {
+      return NextResponse.json({ success: false, error: "Access denied. Only Super Admin has permission to reset company transactions." }, { status: 403 });
+    }
```

---

### VULN-04: Unauthenticated Access to Administrative Routes
- **Severity:** High
- **Affected Files:**
  - `src/app/api/admin/billing/route.ts`
  - `src/app/api/admin/companies/route.ts`
  - `src/app/api/admin/companies/[id]/route.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/admin/users/[id]/route.ts`
  - `src/app/api/branches/[id]/assign/route.ts`
- **Root Cause:** Flawed conditional pattern `if (session && session.role !== "SUPER_ADMIN")` allowed completely unauthenticated requests (`session === null`) to bypass role checks.
- **Fix Implemented:** Replaced all occurrences with `if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN"))`. Scoped `OWNER_ADMIN` strictly to their assigned company in `companies/[id]`.
- **Diff Pattern:**
```diff
- if (session && session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
+ if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
  }
```

---

### VULN-05: Unauthenticated Admin Session Minting on Company Switch
- **Severity:** Critical
- **Affected File:** `src/app/api/auth/switch-company/route.ts`
- **Root Cause:** When `session` was null, lines 61-74 minted an active platform admin JWT for `fallbackStore.users[0]` and returned it in cookies to any anonymous caller.
- **Fix Implemented:**
  1. Required session authentication: `if (!session) return 401`.
  2. Enforced tenant membership authorization: users can only switch to companies in `session.companyIds`, `session.businessId`, or verified in `BusinessMember`.
  3. Removed the unauthenticated admin session creation block entirely.
  4. Added `secure: process.env.NODE_ENV === "production"` to cookies.
- **Diff:**
```diff
--- a/src/app/api/auth/switch-company/route.ts
+++ b/src/app/api/auth/switch-company/route.ts
@@ -8,2 +8,8 @@ export async function POST(req: NextRequest) {
   try {
+    const session = await getSession(req);
+    if (!session) {
+      return NextResponse.json({ success: false, error: "Authentication required to switch company" }, { status: 401 });
+    }
+    let isAuthorized = session.role === "SUPER_ADMIN" || session.businessId === businessId || Boolean(session.companyIds?.includes(businessId));
+    if (!isAuthorized) return NextResponse.json({ success: false, error: "Access denied. You do not have permission to access this company." }, { status: 403 });
```

---

### VULN-06: Missing HTTP Security Headers & Framework Disclosure
- **Severity:** Medium
- **Affected File:** `next.config.mjs`
- **Root Cause:** `X-Powered-By: Next.js` header was exposed, and standard HTTP defensive headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) were absent.
- **Fix Implemented:** Added `poweredByHeader: false` and configured global security response headers in `nextConfig.headers()`.
- **Diff:**
```diff
--- a/next.config.mjs
+++ b/next.config.mjs
@@ -2,2 +2,27 @@ const nextConfig = {
   output: 'standalone',
   reactStrictMode: true,
+  poweredByHeader: false,
+  async headers() {
+    return [{
+      source: '/:path*',
+      headers: [
+        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
+        { key: 'X-Content-Type-Options', value: 'nosniff' },
+        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
+        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
+      ],
+    }];
+  },
```

---

### VULN-07: Unbounded AI Image Payload & Buffer Allocation DoS
- **Severity:** High
- **Affected Files:** `src/app/api/ai/extract/route.ts`, `src/services/ocrService.ts`
- **Root Cause:** `imageUrl` accepted unbounded base64 payloads without size or MIME type validation before buffer allocation in Tesseract/OCR processing.
- **Fix Implemented:**
  1. Enforced authentication check on `/api/ai/extract`.
  2. Enforced maximum payload length cap of 14MB base64 (~10MB binary limit; returns HTTP 413 Payload Too Large).
  3. Added strict MIME type whitelist (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`, `image/bmp`; returns HTTP 415 Unsupported Media Type).
  4. Added validation in `ocrService.ts` before allocating Node `Buffer.from(base64Data)`.
- **Diff:**
```diff
--- a/src/app/api/ai/extract/route.ts
+++ b/src/app/api/ai/extract/route.ts
@@ -10,2 +10,38 @@ export async function POST(req: NextRequest) {
+  const session = await getSession(req);
+  if (!session) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
+  if (imageUrl) {
+    if (imageUrl.length > MAX_IMAGE_PAYLOAD_CHARS) {
+      return NextResponse.json({ success: false, error: "Image size exceeds maximum allowed limit (10MB)" }, { status: 413 });
+    }
+    if (imageUrl.startsWith("data:")) {
+      const mimeMatch = imageUrl.match(/^data:([a-zA-Z0-9\-.+]+\/[a-zA-Z0-9\-.+]+);base64,/);
+      if (!mimeMatch || !ALLOWED_MIME_TYPES.includes(mimeMatch[1].toLowerCase())) {
+        return NextResponse.json({ success: false, error: "Unsupported image format" }, { status: 415 });
+      }
+    }
+  }
```

---

### VULN-08: Credential Stuffing & Brute-Force Rate Limiting
- **Severity:** High
- **Affected Files:** `src/lib/rateLimit.ts` (new), `src/app/api/auth/login/route.ts`
- **Root Cause:** The authentication route lacked request rate limiting, allowing unlimited automated credential brute-forcing.
- **Fix Implemented:**
  1. Created `src/lib/rateLimit.ts`: Sliding window rate limiter tracking failed attempts per IP address (`ip:<client_ip>`) and per target account (`email:<clean_email>`).
  2. Multi-process & restart compatible: Backed by in-memory low-latency cache synchronized with an atomic file journal in `os.tmpdir()` (`sb_login_rate_limits.json`).
  3. Policy: Maximum 5 failed attempts per 15-minute sliding window. Exceeding triggers a 15-minute lockout (HTTP 429 Too Many Requests with `Retry-After: 900`).
  4. Automatic reset: Successful login clears counters for the client IP and email.
- **Diff:**
```diff
--- a/src/app/api/auth/login/route.ts
+++ b/src/app/api/auth/login/route.ts
@@ -21,2 +21,24 @@ export async function POST(req: NextRequest) {
+    const ipCheck = checkLoginRateLimit(ipKey);
+    if (!ipCheck.allowed) {
+      return NextResponse.json({ success: false, error: "Too many failed login attempts from this network." }, { status: 429, headers: { "Retry-After": String(ipCheck.retryAfterSeconds || 900) } });
+    }
+    const emailCheck = checkLoginRateLimit(emailKey);
+    if (!emailCheck.allowed) {
+      return NextResponse.json({ success: false, error: "Too many failed login attempts for this account." }, { status: 429, headers: { "Retry-After": String(emailCheck.retryAfterSeconds || 900) } });
+    }
```

---

## 3. Test Evidence

### Dedicated Security Test Suite (`test/security_hardening.test.ts`)
Executed: `npx vitest run test/security_hardening.test.ts`
Result: **27 passed / 27 total (100% pass rate)**

| Test Group | Tests | Result |
| :--- | :--- | :--- |
| **VULN-01: Cryptographic JWT Verification** | Valid token acceptance, forged secret rejection, tampered payload rejection, expired token rejection | PASS (4/4) |
| **VULN-02: BOLA Multi-Tenant Isolation** | Rejection of injected `x-business-id`, Super Admin legitimate multi-tenant switch | PASS (2/2) |
| **VULN-03: Transaction Reset Protection** | Unauthenticated rejection (403), Non-Super Admin rejection (403) | PASS (2/2) |
| **VULN-04: Admin Endpoints Auth Enforcement** | Unauthenticated GET/POST companies (403), PUT/DELETE companies (403), GET/POST users (403), PUT/DELETE users (403), branch assign (403) | PASS (9/9) |
| **VULN-05: Company Switch Access Control** | Unauthenticated rejection (401), Unauthorized tenant switch rejection (403), Authorized switch success (200) | PASS (3/3) |
| **VULN-07: Image Upload Size & MIME Type** | Payload >10MB rejection (Error), Unsupported MIME rejection (Error), Unauthenticated extraction (401), PDF/executable upload rejection (415) | PASS (4/4) |
| **VULN-08: Sliding Window Rate Limiter** | Initial attempt allowance, 5-attempt threshold lockout (429), successful login counter reset | PASS (3/3) |

### Full Repository Regression Test Suite
Executed: `npx vitest run`
Result: **26 passed / 26 test files (216 passed / 216 tests, 100% pass rate)**

### TypeScript Compiler Verification
Executed: `npx tsc --noEmit`
Result: **0 errors**

### Next.js 14 Production Build Verification
Executed: `npm run build`
Result: **Success (Exit code 0)**  
All 42 static & dynamic routes and 30+ API handlers compiled with standalone output.

---

## 4. Failed Tests & Resolutions

During initial verification runs:
1. `test/reset_company_transactions.test.ts`: Initially failed with 403 because the existing test called the newly hardened endpoint without authentication. Added a test Super Admin session token. **Resolved (2/2 passing).**
2. `test/cash_deposit_voucher.test.ts`: Failed with 400 because unauthenticated candidate company was rejected by hardened `getActiveBusinessId`. Attached an authenticated company session token. **Resolved (4/4 passing).**
3. `test/security_hardening.test.ts`: 3 tests received 401 because `getSession` previously read exclusively from `next/headers cookies()`. Updated `getSession` to also parse `req.cookies` and raw `cookie` headers. **Resolved (27/27 passing).**

---

## 5. Remaining Risks & Infrastructure Hardening Recommendations

The following infrastructure recommendations were identified during the read-only Contabo VPS audit and require explicit user approval before implementation:

1. **SSH Root Password Authentication:**
   - *Finding:* `PermitRootLogin yes` and `PasswordAuthentication yes` remain enabled on Contabo VPS (`207.244.252.122`).
   - *Recommendation:* Disable password authentication (`PasswordAuthentication no`) and enforce SSH key-only access once key backup is confirmed.
2. **Fail2ban Inactive:**
   - *Finding:* `fail2ban` service is installed but currently inactive (`systemctl status fail2ban`).
   - *Recommendation:* Enable and start `fail2ban` with an SSH jail (`maxretry = 5`, `bantime = 1h`).
3. **Database Port Exposure:**
   - *Finding:* PostgreSQL host binding should remain internal to Docker bridge network (`contract-genie_app_network`) and never be exposed to public interfaces.
