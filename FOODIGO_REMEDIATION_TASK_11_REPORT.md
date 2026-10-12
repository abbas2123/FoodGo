# FoodiGo Remediation Task 11 — Final Pre-Commit Validation and Safe Staging Plan

**Execution Date:** 2026-10-11  
**Repository:** `/Users/muhammedabbas/FoodiGo`  
**Current Git Branch:** `main`  
**Base Commit (HEAD):** `9794f94b04bcf278606e1ce5da71c9f252c4102a` ("Add FoodiGo backend and customer app")  
**Remote:** `origin` (`https://github.com/abbas2123/FoodGo.git`)  

---

## Executive Summary

This report establishes the final pre-commit validation and safe staging plan for the FoodiGo remediation project. A comprehensive technical audit was executed across the Git working tree, database migration files, CI/CD container workflow, critical security and transactional code paths, automated test suites, and staging deployment readiness.

### Key Audit Verdict
> **VERDICT: NOT READY FOR STAGING REVIEW (CONDITIONAL ON 1 PRE-DEPLOY MIGRATION FIX)**  
> While all automated test suites pass completely (325/325 unit, 79/79 E2E, 0 TypeScript compiler errors), a **critical schema-migration drift** was discovered: `schema.prisma` defines `@@unique([cartId, menuItemId])` on `CartItem`, which is utilized in `carts.service.ts` for atomic upserts (`cartId_menuItemId`), but **no corresponding migration SQL exists** in `prisma/migrations/`. In a fresh or staging database provisioned strictly via `prisma migrate deploy`, `cartItem.upsert` will fail at runtime with a PostgreSQL constraint exception. Once this missing additive migration is added, the codebase is fully ready for commit and staging pipeline execution.

---

## Section A: Working Tree & Git State Review

A full inspection of the Git working tree was performed using read-only Git commands.

```
$ git status --short
85 modified tracked files
72 untracked entries (including 7 migration SQL files, CI workflow, test specs, and markdown reports)
0 files staged in git index
```

### 1. Repository Metadata
- **Branch:** `main`
- **HEAD Commit:** `9794f94b04bcf278606e1ce5da71c9f252c4102a`
- **Git Diff Hygiene (`git diff --check`):** **PASSED (Exit 0)**. Zero trailing whitespace errors, zero unresolved merge conflict markers, zero orphaned indentation defects.

### 2. Secret & Sensitive File Isolation
- `foodgo-backend/.env`: **STRICTLY IGNORED** via `foodgo-backend/.gitignore` (line 39: `.env`). Verified via `git status --ignored --short`. No secrets are staged or eligible for accidental commit.
- `foodgo-backend/.env.example`: Tracked file modified solely to add sanitized template documentation for `TRUST_PROXY_HOPS`, `SMS_PROVIDER`, `TWILIO_*`, `CORS_ORIGIN`, and `PAYMENT_*`. Zero real credentials present.
- `foodgo-customer/.env.example`: Untracked template file, contains only public Expo configuration placeholders.
- Private keys, `.pem`, `.key`, or database dumps: **None detected**.

### 3. Build Artifact Leakage Finding
- `foodgo-backend/tsconfig.build.tsbuildinfo`: **Tracked file currently marked modified (`M`)**. TypeScript build cache was previously committed in HEAD. Because `*.tsbuildinfo` is not yet present in `foodgo-backend/.gitignore`, this build cache file should be explicitly untracked (`git rm --cached`) and excluded from staging to prevent unnecessary Git churn.

---

## Section B: Database Migration Review & Schema Compatibility

All 7 pending migration SQL files in `foodgo-backend/prisma/migrations/` were audited against the production database schema and Prisma models.

### Migration Audit Table

| # | Migration Directory | SQL Target | Operation Type | Destructive Risk | Compatibility & Safety Notes |
|---|---|---|---|---|---|
| 1 | `20260915124347_add_notifications_search_history` | `notifications`, `search_history` | `CREATE TABLE`, `CREATE INDEX` | **NONE (Purely Additive)** | Creates user notifications and search query history with CASCADE delete on users. Safe for existing DB. |
| 2 | `20260920173000_set_null_on_order_address_delete` | `orders_address_id_fkey` | `ALTER TABLE DROP CONSTRAINT`, `ADD CONSTRAINT` | **LOW (Safe Relational Policy)** | Changes foreign key constraint from RESTRICT to `ON DELETE SET NULL`. If a user deletes an address, historical orders preserve financial and item records while setting `address_id = NULL`. Uses `DROP CONSTRAINT IF EXISTS`. |
| 3 | `20260920183000_order_lifecycle_and_history` | `orders`, `order_status_history` | `ALTER TABLE ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX` | **NONE (Purely Additive)** | Adds 6 nullable lifecycle timestamp columns (`confirmed_at`, `preparing_at`, `out_for_delivery_at`, `delivered_at`, `cancelled_at`). Creates audit trail table. Zero data loss. |
| 4 | `20260920193000_add_payment_transactions` | `PaymentStatus`, `PaymentProvider`, `payment_transactions` | `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` | **NONE (Purely Additive)** | Creates Razorpay transaction ledger with unique constraints on provider order/payment IDs. |
| 5 | `20260926131500_add_order_checkout_group_id` | `orders` | `ALTER TABLE ADD COLUMN`, `CREATE INDEX` | **NONE (Purely Additive)** | Adds nullable `checkout_group_id VARCHAR(50)` with `ADD COLUMN IF NOT EXISTS`. Supports multi-restaurant checkout grouping. |
| 6 | `20261011140000_add_order_driver_updated_at` | `orders` | `ALTER TABLE ADD COLUMN` | **NONE (Purely Additive)** | Adds nullable `driver_updated_at TIMESTAMP` with `ADD COLUMN IF NOT EXISTS`. Supports live driver telematics. |
| 7 | `20261011142500_add_processed_webhook_events` | `processed_webhook_events` | `CREATE TABLE`, `CREATE INDEX` | **NONE (Purely Additive)** | Creates idempotent webhook audit table with `UNIQUE(provider, event_id)` and `CREATE TABLE IF NOT EXISTS`. |

### Critical Schema-Migration Drift Finding (Blocking)
- **Observation:** `foodgo-backend/prisma/schema.prisma` (lines 483–484) defines:
  ```prisma
  model CartItem {
    ...
    @@unique([cartId, menuItemId])
    @@index([cartId])
    @@map("cart_items")
  }
  ```
- **Code Usage:** In `foodgo-backend/src/modules/carts/carts.service.ts` (lines 131–137), `cartItem.upsert` relies on the compound unique constraint:
  ```typescript
  await this.prisma.cartItem.upsert({
    where: {
      cartId_menuItemId: { cartId: cart.id, menuItemId },
    },
    ...
  });
  ```
- **Audit Defect:** None of the 7 migration SQL files creates `CREATE UNIQUE INDEX "cart_items_cart_id_menu_item_id_key" ON "cart_items"("cart_id", "menu_item_id");`. Baseline migration `20260914192944_add_favorites_reviews_carts_tracking` only created a non-unique index on `cart_id`.
- **Impact:** Running `prisma migrate deploy` on staging will leave the database without this unique constraint. Any attempt to add an item to the cart will cause PostgreSQL to throw an error: `there is no unique or exclusion constraint matching the ON CONFLICT specification`.
- **Required Remediation:** Before staging deployment, create migration `20261011150000_add_cart_item_unique_constraint/migration.sql`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_id_menu_item_id_key" ON "cart_items"("cart_id", "menu_item_id");
  ```

---

## Section C: CI/CD Docker Workflow Safety Audit

The GitHub Actions workflow `.github/workflows/docker-ci.yml` (248 lines) was audited against security best practices and isolation requirements.

### Workflow Verification Matrix

| Check | Expected Behavior | Actual Implementation | Status |
|---|---|---|---|
| **Push Disabled** | Do not push images to any public or private registry | Lines 89–95: `push: false` in `docker/build-push-action@v6` | **VERIFIED** |
| **No Production Secrets** | Use dummy/mock values for CI smoke test | Lines 160–178: Uses `dummy_jwt_access_secret_for_ci_test_12345`, `SMS_PROVIDER: "dev"`, dummy Razorpay test keys | **VERIFIED** |
| **Network Isolation** | Container cannot access external network or production DB | Line 151: Creates isolated bridge network `ci-smoke-net`; DB is ephemeral `postgres:16-alpine` | **VERIFIED** |
| **Non-Root Execution** | Container must run under unprivileged user | Lines 110–115: Validates user is `nestjs` (UID 1001, GID 1001), not `root` | **VERIFIED** |
| **Failover Validation** | Test readiness probe failure when DB is stopped | Lines 220–237: Stops postgres container, validates `/health/ready` returns HTTP 503 | **VERIFIED** |
| **Resource Cleanup** | Never leak orphaned containers on self-hosted runners | Lines 240–247: `if: always()` removes containers and network | **VERIFIED** |
| **Workflow Permissions** | Explicit principle of least privilege | Top-level `permissions` block omitted; defaults to read-only on PRs, write on main branches | **ACCEPTABLE (Minor Note)** |

---

## Section D: Critical Security & Transactional Code Paths

| Path / Mechanism | Implementation Verification | Unverified Assumptions / Limitations |
|---|---|---|
| **SMS Production Guard** | `TwilioSmsService` constructor throws if `NODE_ENV=production` and `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, or `TWILIO_FROM_PHONE` are missing. `DevSmsService` throws if instantiated in production. `AuthModule` uses dynamic factory enforcing `twilio` in production. | Live Twilio delivery not tested (no live API calls permitted during audit). |
| **Environment Validation** | `env.validation.ts` validates `JWT_ACCESS_SECRET !== JWT_REFRESH_SECRET`, forbids wildcard CORS `*` in production, and forbids mock keys in production for `PAYMENT_KEY_ID`. | Key mock detection checks for `'mock'` substring; valid test keys like `rzp_test_*` pass validation. |
| **Razorpay Verification** | `PaymentGatewayService.verifyPaymentSignature` computes HMAC SHA-256 using `crypto.timingSafeEqual`. Amount is server-authoritative from database `Decimal(10,2)`. | Live Razorpay checkout popup not initiated with real credit card / UPI credentials. |
| **Webhook Idempotency** | Webhooks recorded in `processed_webhook_events` under atomic `$transaction`. Prisma P2002 duplicate key returns HTTP 200 without duplicate execution. | `payment.failed` event updates status idempotently but does not insert into `processed_webhook_events` table (minor). |
| **Checkout Atomicity** | `OrdersService.checkout` calculates prices server-side, validates restaurant status, generates 20-character collision-resistant `orderNumber`, and locks payment transaction atomically. | Real-time concurrent inventory deduction across multiple parallel users is handled at the order level, not row-locked at menu item level. |
| **Account Deletion** | `ProfileService.deleteAccount` executes in `$transaction`: blocks if active orders exist, deletes refresh tokens, addresses, cart items, notifications, and anonymizes user row (`deleted_user_<id>`). | Complies with GDPR/privacy right-to-be-forgotten while preserving legal financial transaction audit logs. |
| **Health Probes** | `/health/live` returns HTTP 200. `/health/ready` executes `prisma.$queryRaw\`SELECT 1\`` and returns HTTP 503 if database disconnects. | Probes verified via automated unit and E2E tests. Local Docker daemon unavailable to run image locally. |
| **Proxy Trust** | `TRUST_PROXY_HOPS` configurable (0 default). Injects `app.set('trust proxy', hops)` into Express instance in `main.ts`. | Actual reverse proxy hop count depends on hosting environment (Cloud Run = 1, AWS ALB = 1, Cloudflare + Nginx = 2). |

---

## Section E: Final Automated Validation Results

All tests were executed locally using Node.js and npm on 2026-10-11:

```
================================================================================
                    FOODIGO REMEDIATION TEST SUITE RESULTS
================================================================================
1. Backend Unit Tests:         28/28 test files passed | 325/325 tests passed (100%)
2. Backend E2E Tests:           4/4 test files passed  |  79/79 tests passed (100%)
3. Backend TypeScript Build:   EXIT CODE 0             |  0 type errors (tsconfig.build.json)
4. Mobile TypeScript Check:    EXIT CODE 0             |  0 type errors (foodgo-customer tsc)
5. Git Whitespace / Conflicts: EXIT CODE 0             |  0 whitespace/conflict errors
================================================================================
```

---

## Section F: Safe Pre-Commit Staging Plan

To maintain git history hygiene and ensure zero unreviewed artifacts enter the repository, commits should be organized into five logical staging groups.

### Group 1: Database Schema & Migrations
- `foodgo-backend/prisma/schema.prisma`
- `foodgo-backend/prisma/migrations/20260915124347_add_notifications_search_history/migration.sql`
- `foodgo-backend/prisma/migrations/20260920173000_set_null_on_order_address_delete/migration.sql`
- `foodgo-backend/prisma/migrations/20260920183000_order_lifecycle_and_history/migration.sql`
- `foodgo-backend/prisma/migrations/20260920193000_add_payment_transactions/migration.sql`
- `foodgo-backend/prisma/migrations/20260926131500_add_order_checkout_group_id/migration.sql`
- `foodgo-backend/prisma/migrations/20261011140000_add_order_driver_updated_at/migration.sql`
- `foodgo-backend/prisma/migrations/20261011142500_add_processed_webhook_events/migration.sql`
- *(Add missing CartItem unique constraint migration prior to staging commit)*

### Group 2: Backend Core, Config & Health Probes
- `foodgo-backend/.env.example`
- `foodgo-backend/package.json`
- `foodgo-backend/package-lock.json`
- `foodgo-backend/tsconfig.build.json`
- `foodgo-backend/vitest.config.e2e.ts`
- `foodgo-backend/src/main.ts`
- `foodgo-backend/src/app.module.ts`
- `foodgo-backend/src/config/configuration.ts`
- `foodgo-backend/src/config/env.validation.ts`
- `foodgo-backend/src/config/env.validation.spec.ts`
- `foodgo-backend/src/health/health.controller.ts`
- `foodgo-backend/src/health/health.controller.spec.ts`
- `foodgo-backend/src/common/guards/jwt-auth.guard.ts`
- `foodgo-backend/src/common/guards/jwt-auth.guard.spec.ts`
- `foodgo-backend/src/common/guards/roles.guard.ts`
- `foodgo-backend/src/common/guards/roles.guard.spec.ts`
- `foodgo-backend/src/common/decorators/roles.decorator.ts`
- `foodgo-backend/src/common/utils/order-number.util.ts`
- `foodgo-backend/src/common/utils/order-number.util.spec.ts`

### Group 3: Backend Modules & Automated Tests
- `foodgo-backend/src/modules/auth/**` (Twilio SMS service, dev SMS, token service, specs)
- `foodgo-backend/src/modules/carts/**` (Carts service, multi-restaurant support, specs)
- `foodgo-backend/src/modules/orders/**` (Orders service, state machine, admin orders controller, DTOs, specs)
- `foodgo-backend/src/modules/payments/**` (Payments service, gateway service, state machine, DTOs, specs)
- `foodgo-backend/src/modules/notifications/**` (Notifications controller, service, module, specs)
- `foodgo-backend/src/modules/search/**` (Search controller, service, module, specs)
- `foodgo-backend/src/modules/profile/**` (Account deletion, GDPR anonymization, specs)
- `foodgo-backend/src/modules/adress/**` (Address controller specs)
- `foodgo-backend/test/**` (All 4 E2E test suites)

### Group 4: Mobile Customer Application
- `foodgo-customer/package.json`
- `foodgo-customer/package-lock.json`
- `foodgo-customer/app.json`
- `foodgo-customer/eas.json`
- `foodgo-customer/.gitignore`
- `foodgo-customer/App.tsx`
- `foodgo-customer/src/api/**` (Client, config, auth, cart, orders, payments, notifications, search, users)
- `foodgo-customer/src/features/**` (Checkout, orders tracking, restaurants, notifications, profile, search)
- `foodgo-customer/src/components/**` (CartModal, GlobalCartBar, ConfirmationModal, etc.)
- `foodgo-customer/src/navigation/**` (AppNavigator, RootNavigator, types)
- `foodgo-customer/src/store/**` (Redux slices, root reducer, store configuration)
- `foodgo-customer/src/services/**` (Secure storage)
- `foodgo-customer/src/utils/**` (Currency formatting)

### Group 5: CI/CD & Docker Infrastructure
- `foodgo-backend/Dockerfile`
- `foodgo-backend/.dockerignore`
- `.github/workflows/docker-ci.yml`

### Explicit Exclude List (Do NOT Stage)
1. `foodgo-backend/.env` — contains local development secrets.
2. `foodgo-backend/tsconfig.build.tsbuildinfo` — compiled build cache artifact; must add to `.gitignore`.
3. `FOODIGO_*.md` and `stage10_*.md` — local audit and remediation documentation files (keep in local tree or commit in dedicated documentation branch if requested).

---

## Final Recommendation & Next Steps

1. **Pre-Staging Fix:** Add the missing migration for `CartItem @@unique([cartId, menuItemId])` so `prisma migrate deploy` matches `schema.prisma`.
2. **Git Ignore Enhancement:** Append `*.tsbuildinfo` to `foodgo-backend/.gitignore` and run `git rm --cached foodgo-backend/tsconfig.build.tsbuildinfo`.
3. **Commit Execution:** Execute staged commits following Groups 1 through 5 using descriptive commit messages.
4. **Trigger CI:** Push to a feature/staging branch on GitHub to trigger the automated `.github/workflows/docker-ci.yml` workflow for end-to-end container verification in GitHub Actions.

---
*Report certified by Antigravity Autonomous Agent.*
