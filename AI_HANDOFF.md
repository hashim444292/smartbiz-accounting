# AI Session Handoff & Project State: SmartBiz Accounting

## Project Overview
- **Name:** SmartBiz Accounting & AI-Powered Ledger
- **Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Prisma 5.22, PostgreSQL, Decimal.js, Vitest, Recharts, Lucide Icons, Tesseract OCR.
- **Production Target:** Contabo VPS running Docker Compose (`smartbiz-app` on port 3001, reverse proxied by Nginx to `https://myaccounts360.com`).
- **Cloud / Vercel:** Project `smartbiz-accounting` under team `team_r6iDs3ibjGUxv459ChRvJTlJ`.
- **Repository:** `https://github.com/hashim444292/smartbiz-accounting.git` (branch: `main`).

---

## Current Environment & Tooling
- **OS:** Windows 11 (Fresh Installation)
- **Git:** Git 2.56.0 with `gh` credential helper configured.
- **Node.js:** Node.js 24.20.0 LTS, npm 11.19.0.
- **GitHub CLI (`gh`):** Authenticated as `hashim444292` with `workflow`, `repo`, `read:org`, `gist` scopes.
- **Vercel CLI:** Authenticated as `hashimhameedgaziani-9876`.
- **Test Suite Status:** 9/9 test suites passing (87 tests, 100% pass rate).
- **Build Status:** Next.js 14 production build succeeds with all 40 routes and API handlers.

---

## Deployment Architecture
1. **Contabo VPS Deployment:**
   - Script: `scripts/deploy.sh`
   - Docker Compose: `docker-compose.prod.yml`
   - Nginx Config: `deploy/nginx/myaccounts360.com.conf`
   - Database: Host PostgreSQL via Docker host gateway (`contract-genie_app_network`).
   - GitHub Actions CI/CD Template: `deploy/workflows/deploy.yml`.
2. **Vercel Deployment:**
   - Linked via `.vercel/project.json`
   - Config: `vercel.json`

---

## Known Conventions & Guidelines
- Strict double-entry accounting with Decimal.js for precise monetary operations.
- Multi-tenant isolation verified by unit tests.
- FBR POS & Digital Invoicing integration support with QR payload verification.

---

## Session Log
| Date | Author | Changes & Accomplishments | What's Next |
| :--- | :--- | :--- | :--- |
| 2026-10-09 (Part 2) | Antigravity AI | Auto-configured Contabo CI/CD: added `.github/workflows/deploy.yml`, generated/synced SSH keys, and set `CONTABO_SSH_USER`, `CONTABO_SSH_PORT`, and `CONTABO_SSH_KEY` on GitHub secrets via `gh`. Pushed to origin/main. | Set `CONTABO_HOST` (VPS IP) secret once user provides IP address. |
| 2026-10-09 | Antigravity AI | Fresh Windows environment setup: installed MinGit, Node.js LTS, GitHub CLI, Vercel CLI. Authenticated GitHub & Vercel. Configured Git user credentials. Fixed QR test regex for production domain. Ran 87/87 passing tests & verified clean build. Created AI handoff. | Link GitHub Actions secrets for Contabo CI/CD if desired, or proceed with development tasks. |
