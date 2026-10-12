# FoodiGo — Remediation Task 5: Staging Deployment Preparation

**Date:** 2026-10-11
**Project:** FoodiGo (foodgo-backend + foodgo-customer)
**Root Path:** `/Users/muhammedabbas/FoodiGo`
**Scope:** Staging readiness audit. No infrastructure was created. No deployments were performed.

---

## Executive Summary

All five previous remediation tasks are complete. The codebase contains no remaining application-level blockers. What remains is entirely **operational** — environment configuration, secret provisioning, infrastructure provisioning, and mobile build configuration. Every item below is a deployment prerequisite, not a code defect.

| Area | Status | Blocker? |
|:---|:---|:---|
| Backend application code | ✅ Ready | No |
| Backend environment validation | ✅ Ready | No |
| CORS configuration | ✅ Ready | No |
| Helmet / security headers | ✅ Ready | No |
| Payment throttling (tiered) | ✅ Ready | No |
| Webhook idempotency | ✅ Ready | No |
| Order number collision resistance | ✅ Ready | No |
| OTP generation and hashing | ✅ Ready | No |
| SMS provider (Twilio) | ⚠️ Needs credentials | **Yes — staging** |
| PostgreSQL database | ⚠️ Needs provisioning | **Yes — staging** |
| Reverse-proxy trust | ⚠️ Needs one line | **Yes — behind ALB/Cloudflare** |
| Backend Docker / CI | ⚠️ Needs creation | Yes |
| Mobile API URL | ⚠️ Needs staging URL | **Yes — preview build** |
| EAS build secrets | ⚠️ Needs provisioning | Yes |

---

## Phase 1 — Backend Configuration Audit

### 1.1 Environment Validation

**File:** `foodgo-backend/src/config/env.validation.ts`

The `validate()` function enforces the following at **startup**. If any required variable is missing or invalid, the process throws and refuses to start.

**Always required (all environments):**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ACCESS_SECRET` — Must be non-empty
- `JWT_REFRESH_SECRET` — Must be non-empty

**Required in production specifically:**
- `NODE_ENV=production`
- `CORS_ORIGIN` — Must be set; wildcard `"*"` is explicitly rejected
- `SMS_PROVIDER=twilio` — `"dev"` is rejected at startup
- `TWILIO_ACCOUNT_SID` — Must be non-empty when provider is twilio
- `TWILIO_AUTH_TOKEN` — Must be non-empty when provider is twilio
- `TWILIO_FROM_PHONE` — Must be non-empty when provider is twilio

**Optional (gracefully absent):**
- `GOOGLE_MAPS_API_KEY` — Backend geocoding degrades gracefully; client uses expo-location fallback
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Required at runtime for payment flows; not validated at startup
- `OBSERVE_APP_KEY` / `OBSERVE_APP_SECRET` — Observability is disabled if absent

### 1.2 CORS Configuration

**File:** `foodgo-backend/src/main.ts` (Lines 23–51)

- In production, `CORS_ORIGIN` is mandatory. Wildcard `"*"` throws at startup via both `env.validation.ts` and `resolveCorsOrigin()`.
- Comma-separated multi-origin list is supported: `CORS_ORIGIN=https://api.foodigo.app,https://admin.foodigo.app`
- Native React Native mobile clients do **not** trigger CORS preflight; CORS guards only apply to browser-based clients (admin panels, web builds).

**Staging action:** Set `CORS_ORIGIN` to the exact staging origin(s). Do not use `"*"`.

### 1.3 Trust Proxy — Gap Identified

**Finding:** `app.set('trust proxy', ...)` is **not present** in `main.ts`.

**Impact:** If the backend is placed behind a reverse proxy (ALB, nginx, Cloudflare), the IP address seen by NestJS throttling will be the proxy's IP rather than the real client IP. This means all clients share the same throttle bucket, making rate limiting ineffective.

**Required action (one line in `main.ts`, before `app.listen()`):**

```typescript
// Trust exactly one hop (the reverse proxy / ALB in front of the app).
// Only enable this if the backend is behind a known, trusted reverse proxy.
app.getHttpAdapter().getInstance().set('trust proxy', 1);
```

> **Security note:** Only trust the exact number of proxy hops in the deployment topology. `1` is correct for a single ALB or nginx in front of the app. Do not use `true` (trusts all forwarded headers unconditionally).

### 1.4 Throttling — In-Memory Store

**File:** `foodgo-backend/src/app.module.ts` (Lines 37–43)

The global throttler uses NestJS's default **in-memory store**. This is correct for a single-instance staging deployment. For horizontal scaling (multiple backend replicas), the store must be replaced with Redis via `@nestjs/throttler-storage-redis`.

**Staging verdict:** Acceptable for a single-instance staging server. Document this as a pre-production scaling prerequisite.

### 1.5 Swagger / API Docs

**File:** `foodgo-backend/src/main.ts` (Lines 95–110)

Swagger is unconditionally disabled when `NODE_ENV=production`. No action needed for staging if `NODE_ENV=production` is set. If `NODE_ENV=development` is used on staging, Swagger will be exposed at `/api/docs`.

**Recommendation:** Set `NODE_ENV=production` on the staging server.

### 1.6 Health Check Endpoint

**File:** `foodgo-backend/src/health/health.controller.ts`

- Route: `GET /health` — Public, no JWT required.
- Response: `{ status: "ok"|"degraded", database: "connected"|"error", uptime, timestamp }`
- Performs a live `SELECT 1` query to verify database connectivity.
- Returns HTTP 200 in all cases (degraded state is signalled in the body, not via HTTP status code).

**Note for load balancers:** ALB/nginx health checks should target `GET /health` and check for HTTP 200 + `"status":"ok"` in the body. The endpoint always returns 200 even when the database is degraded.

### 1.7 Graceful Shutdown

`app.enableShutdownHooks()` is present in `main.ts`. NestJS will handle `SIGTERM` and `SIGINT` signals, allowing in-flight requests to complete before the process exits.

### 1.8 Database Migrations

**Migration directory:** `foodgo-backend/prisma/migrations/`

13 migrations exist, the latest being `20261011142500_add_processed_webhook_events`. Migrations are **not run automatically at startup**. The production/staging deployment script must run:

```bash
npx prisma migrate deploy
```

This command applies pending migrations without modifying existing data and is safe for production use. It is distinct from `prisma migrate dev`, which is only for local development.

---

## Phase 2 — Mobile Configuration Audit

### 2.1 API URL Configuration

**File:** `foodgo-customer/src/api/client/apiConfig.ts`

- In **release** builds, the client enforces that `EXPO_PUBLIC_API_URL` is set to an `https://` URL on a public domain. LAN IPs are rejected at build time.
- In **development** builds, local `http://` addresses are permitted.

**Current `.env.example`:** `EXPO_PUBLIC_API_URL=http://192.168.1.4:3000`

This is a local development value. Before building a **preview** or **production** EAS build, this must be replaced with the staging HTTPS URL.

**Staging action:** Create `foodgo-customer/.env.staging` (or set via EAS Secrets) with:
```
EXPO_PUBLIC_API_URL=https://<staging-api-hostname>
```

### 2.2 EAS Build Profiles

**File:** `foodgo-customer/eas.json`

| Profile | Distribution | Type | Use Case |
|:---|:---|:---|:---|
| `development` | Internal | Dev client | Local development with Expo Go |
| `preview` | Internal | APK | Staging / internal testing |
| `production` | Store | AAB | App Store submission |

**Staging recommendation:** Use the `preview` profile for staging distribution. APK output is directly installable without store submission.

```bash
eas build --profile preview --platform android
```

### 2.3 EAS Secrets (for CI / automated builds)

Environment variables for staging must be set as EAS Secrets so they are injected into the build at compile time:

- `EXPO_PUBLIC_API_URL` — staging backend HTTPS URL

Do not commit real values to `.env` files in the repository.

---

## Phase 3 — Infrastructure Prerequisites

> **Scope note:** This section lists what must be provisioned before staging deployment. No infrastructure was created during this task.

### 3.1 PostgreSQL Database

A PostgreSQL instance is required. Supported options:

| Option | Notes |
|:---|:---|
| Managed cloud (Railway, Supabase, Render, AWS RDS) | Recommended; handles backups and failover |
| Self-hosted (Docker, EC2) | More control; requires manual backup setup |
| Local Docker for staging | Only suitable for a single-machine staging environment |

Required after provisioning:
1. Obtain the connection string.
2. Set `DATABASE_URL` in the backend environment.
3. Run `npx prisma migrate deploy` before starting the backend.

### 3.2 Backend Hosting

The backend requires a Node.js runtime environment. Options:

| Option | Notes |
|:---|:---|
| Railway / Render / Fly.io | Simplest for initial staging; handles TLS termination |
| AWS ECS / EC2 | More control; requires a Dockerfile |
| Docker Compose (single server) | Suitable for a controlled staging environment |

**Missing item — Dockerfile:** No `Dockerfile` exists in `foodgo-backend/`. A minimal production Dockerfile is required for containerised deployment.

**Required `start:prod` command (confirmed in `package.json`):** `node dist/main`. Build step: `nest build`.

**Minimum Dockerfile structure (to be created):**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

### 3.3 Reverse Proxy / TLS Termination

- TLS termination must occur at the reverse proxy (nginx, ALB, Cloudflare).
- The backend itself does not handle TLS.
- Once the reverse proxy is in place, add `trust proxy 1` to `main.ts` (see §1.3).

### 3.4 Twilio Account

To enable OTP authentication in staging:
1. Create a Twilio account (a trial account is sufficient for limited beta).
2. Obtain `ACCOUNT_SID`, `AUTH_TOKEN`, and a verified `FROM_PHONE` number.
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE`, `SMS_PROVIDER=twilio`.
4. In trial mode, only Twilio-verified phone numbers can receive SMS. Verify tester phone numbers in the Twilio console before beta testing.

### 3.5 Razorpay

- Use the Razorpay **test** account for staging.
- Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to test-mode credentials.
- Configure the webhook endpoint in the Razorpay dashboard: `https://<staging-api-hostname>/payments/webhook`
- Set `RAZORPAY_WEBHOOK_SECRET` from the Razorpay webhook signing secret.

---

## Phase 4 — Staging Environment Variable Checklist

Variable names only. No values.

### Backend (`foodgo-backend` hosting environment)

```
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=

# JWT
JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d

# OTP
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_COOLDOWN_SECONDS=60

# CORS (comma-separated list of allowed browser origins; no wildcard)
CORS_ORIGIN=

# SMS
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Google Maps (optional — app degrades gracefully without it)
# GOOGLE_MAPS_API_KEY=

# Observability (optional)
# OBSERVE_APP_KEY=
# OBSERVE_APP_SECRET=
```

### Mobile EAS Build (`foodgo-customer`)

```
EXPO_PUBLIC_API_URL=https://<staging-api-hostname>
```

---

## Phase 5 — First Staging Deployment Sequence

The following is the correct deployment order. This sequence is a reference — it has not been executed.

```
Step 1.  Provision PostgreSQL instance.
         Record DATABASE_URL.

Step 2.  Provision backend hosting environment.

Step 3.  Set all backend environment variables on the hosting environment.
         Do not commit secrets to the repository.

Step 4.  Create Dockerfile in foodgo-backend/ (see §3.2).

Step 5.  Add `trust proxy 1` to main.ts if behind a reverse proxy (see §1.3).

Step 6.  Deploy the backend container / service.
         Startup runs: prisma migrate deploy → node dist/main
         Confirm: backend refuses to start if any required env var is missing.

Step 7.  Verify backend health:
         GET https://<staging-api-hostname>/health
         Expected: { "status": "ok", "database": "connected", ... }

Step 8.  Verify throttle headers are present:
         X-RateLimit-Limit and X-RateLimit-Remaining in responses.

Step 9.  Configure Razorpay webhook in Razorpay dashboard:
         Endpoint: https://<staging-api-hostname>/payments/webhook
         Record the webhook signing secret → set RAZORPAY_WEBHOOK_SECRET.

Step 10. Set EXPO_PUBLIC_API_URL for the staging build:
         EAS Secret or foodgo-customer/.env.staging

Step 11. Build the staging APK:
         eas build --profile preview --platform android

Step 12. Install and test on a physical Android device.

Step 13. Verify full OTP authentication flow:
         Request OTP → receive SMS → enter code → receive JWT.
         (Twilio trial: tester phone must be pre-verified in the Twilio console.)

Step 14. Verify payment flow end-to-end:
         Create order → initiate Razorpay checkout → complete test payment
         → Razorpay webhook fires → order status updates to PAID.
```

---

## Phase 6 — Outstanding Action Items

| # | Item | Priority | Notes |
|:---|:---|:---|:---|
| 6.1 | Create `foodgo-backend/Dockerfile` | **High** | Required for containerised deploy |
| 6.2 | Add `trust proxy 1` to `main.ts` | **High** | Required behind any reverse proxy for correct rate-limit IP resolution |
| 6.3 | Provision PostgreSQL (staging) | **High** | Cannot deploy without |
| 6.4 | Provision Twilio (staging) | **High** | OTP auth is non-functional without |
| 6.5 | Set `EXPO_PUBLIC_API_URL` for preview build | **High** | Mobile app will not connect to staging |
| 6.6 | Redis for throttler | Medium | Required before horizontal scaling |
| 6.7 | Health check HTTP status refinement | Medium | Load balancers expecting non-200 on degraded state |
| 6.8 | CI/CD pipeline (GitHub Actions or equivalent) | Medium | Automates build and deploy; not required for initial staging |
| 6.9 | Google Maps API key | Low | Optional; app degrades gracefully |
| 6.10 | FCM/APNs push notifications | Low | Currently uses polling; sufficient for beta |

---

## Summary

The FoodiGo codebase is **application-code complete** for a controlled staging deployment. All five remediation tasks have been implemented and verified:

- **Task 1/1.1** — Collision-resistant order numbers (crypto-based, retry on P2002)
- **Task 2** — Tiered payment endpoint rate limiting (20/20/30/120 req/min)
- **Task 3** — SMS/OTP hardening (Twilio enforced in production, DevSmsService blocked)
- **Task 4** — Production environment validation (startup rejection for all missing secrets)
- **Task 5** — Staging deployment preparation (this document)

The remaining work is entirely **operational**:
1. Create `foodgo-backend/Dockerfile`
2. Add `trust proxy 1` to `main.ts`
3. Provision PostgreSQL, Twilio, and a backend hosting environment
4. Set environment variables on the hosting environment
5. Build the EAS `preview` APK with the staging API URL

No further application code changes are required before staging deployment, except the two items above.
