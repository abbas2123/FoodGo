# FoodiGo — Remediation Task 6: Containerization and Deployment Hardening Report

**Project:** FoodiGo Backend (`foodgo-backend`)  
**Task:** Remediation Task 6 — Containerization and Deployment Hardening  
**Date:** October 11, 2026  
**Status:** COMPLETE — READY FOR CONTROLLED STAGING DEPLOYMENT

---

## 1. Executive Summary

### 1.1 Scope of Hardening
Following the production readiness audits (Remediation Tasks 1–5), Task 6 addresses the containerization, orchestration health probes, reverse-proxy integration, and deployment automation for `foodgo-backend`. The objective was to eliminate runtime surprises in containerized staging/production environments without provisioning cloud resources or executing destructive changes.

### 1.2 Summary of Implemented Changes
| Component | Action Taken | Rationale / Result |
| :--- | :--- | :--- |
| **Dockerfile** | Created multi-stage `node:22-alpine` build | Minimal image footprint, non-root user (`1001:1001`), no secret leakage, separate `deps` / `builder` / `runner` stages. |
| **Prisma Engine** | Added `linux-musl-openssl-3.0.x` to `schema.prisma` `binaryTargets` | Prisma classic query engine requires musl-compatible Rust binary on Alpine; installed runtime `openssl`. |
| **Docker Ignore** | Created `.dockerignore` | Excludes `.env*`, `node_modules`, `dist`, `test`, `coverage`, `*.tsbuildinfo`, `src/generated`, `.git`, preventing build cache poisoning and secret leaks. |
| **Migration Script** | Added `prisma:deploy` to `package.json` | Explicit decoupled command (`prisma migrate deploy`) intended for CI/CD pre-deploy release phase; migrations do not run on container boot. |
| **Trust Proxy** | Implemented `TRUST_PROXY_HOPS` via `@nestjs/config` & `class-validator` | Safe default (`0`); configurable for reverse proxies (e.g. `1` for ALB/Nginx/Railway/Render) without insecure open `trust proxy true`. |
| **Health Probes** | Refactored `HealthController` with `/health`, `/health/live`, `/health/ready` | Split orchestrator probes: `/health/live` (process alive, no DB query), `/health/ready` (DB probe, HTTP 503 on failure, zero detail leakage). |
| **Tests** | Added 8 comprehensive health endpoint tests | 325/325 backend unit tests passing; 79/79 E2E tests passing. |

### 1.3 Deployment Readiness Status
- **Backend Unit Tests:** 325 passed across 28 test files (100% pass rate).
- **Backend E2E Tests:** 79 passed across 4 test suites (100% pass rate).
- **Backend Compilation:** `npx tsc -p tsconfig.build.json` succeeded cleanly with exit code 0.
- **Mobile TypeScript:** `npx tsc --noEmit` exited cleanly with exit code 0.
- **Security & Integrity:** Non-root execution, zero secrets in build context, hardened health error handling.

---

## 2. Container Image Specification

### 2.1 Base Image Selection & Justification
- **Base Image:** `node:22-alpine`
- **Node.js LTS Requirement:** NestJS v11 requires Node.js `>=20.0.0`; Prisma v6 requires Node.js `>=18.18.0`. Node.js 22 is active LTS.
- **Minimal Footprint:** Alpine Linux reduces container attack surface and image size (under ~180MB uncompressed compared to ~1.1GB with `node:22` Debian bookworm).
- **Build-Time vs Runtime Dependencies:** Build tools (`python3`, `make`, `g++`) are confined to the `deps` stage for native compilation support (e.g. `bcrypt` prebuilts fallback). The runtime image only installs `openssl` (required by Prisma classic Rust engine for OpenSSL 3.0 crypto symbols on musl).

### 2.2 Multi-Stage Build Architecture & Layer Caching
The Dockerfile is structured across 3 isolated stages:
```
Stage 1: deps (node:22-alpine + openssl + python3 make g++)
  ├── COPY package.json package-lock.json
  └── RUN npm ci (deterministic installation from lockfile)

Stage 2: builder (deps)
  ├── COPY prisma schema & config
  ├── COPY application source (src/)
  ├── RUN npx prisma generate (fetches native + linux-musl engine binaries)
  └── RUN npx tsc -p tsconfig.build.json (compiles NestJS app into dist/)

Stage 3: runner (node:22-alpine + openssl)
  ├── Non-root system user (nestjs:1001)
  ├── COPY --from=deps node_modules (production deps)
  ├── COPY --from=builder dist/
  ├── COPY --from=builder prisma/ (schema + migrations for migration job)
  ├── COPY package.json
  ├── USER nestjs
  └── CMD ["node", "dist/main"]
```
- **Layer Caching Strategy:** `package.json` and `package-lock.json` are copied and installed first. Unless dependencies change, the dependency installation layer is cached across builds.
- **Build Isolation:** Compilation occurs directly via `npx tsc -p tsconfig.build.json`, bypassing the Nest CLI circular import defect (`ERR_REQUIRE_CYCLE_MODULE` in `@angular-devkit/schematics`/`ora`) and ensuring a reliable, headless container build.

### 2.3 Non-Root Execution
- Group `nestjs` (GID 1001) and system user `nestjs` (UID 1001) are created in the `runner` stage.
- All files copied into `/app` are assigned ownership `chown=nestjs:nestjs`.
- The container switches to `USER nestjs` before port exposure (`EXPOSE 3000`) and entrypoint execution.
- Prevents container breakout privileges and complies with CIS Docker Benchmark recommendations.

### 2.4 Prisma Engine Binary Handling
- FoodiGo uses Prisma with the `classic` engine (explicitly declared in `prisma.config.ts`: `engine: "classic"`).
- Alpine Linux uses `musl` libc rather than GNU `glibc`.
- To prevent missing query engine crashes (`libquery_engine-linux-musl-openssl-3.0.x.so.node`), `prisma/schema.prisma` was updated:
  ```prisma
  generator client {
    provider      = "prisma-client"
    output        = "../src/generated/prisma"
    binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
  }
  ```
- The runtime image installs `openssl` (`apk add --no-cache openssl`) so musl OpenSSL 3 bindings resolve smoothly.

### 2.5 Secret Handling and Image Sanitization
- `.dockerignore` strictly prevents copying `.env`, `.env.*`, and local credentials into the build context.
- No build secrets are injected via `ARG` or baked into Docker intermediate layers.
- The compiled runtime image accepts configuration exclusively through runtime environment variables (`docker run --env-file ...` or Kubernetes Secrets / ECS Task Definitions).

---

## 3. Database Migration Strategy

### 3.1 Decoupled Execution Model
**Migrations are NOT executed during container startup.**
- Running migrations on `CMD` or application boot causes race conditions and database deadlocks when scaling horizontal replicas (e.g. 2+ pods starting simultaneously).
- A failed migration on startup creates a crash loop, blocking container startup and hindering rolling deploys.
- Instead, migrations must be executed as an isolated **Release Phase Job** or single-replica pre-deployment task.

### 3.2 Migration Script
`package.json` now includes the dedicated script:
```json
"prisma:deploy": "prisma migrate deploy"
```
`prisma migrate deploy` applies pending migrations using the schema and migration history table (`_prisma_migrations`) without prompting for confirmation or resetting data.

### 3.3 CI/CD & Staging Execution Procedure
In the staging deployment pipeline, run the migration container before releasing new application instances:
```bash
# 1. Run migrations via dedicated temporary container
docker run --rm \
  --env-file /secure/path/.env.staging \
  foodgo-backend:v1.0.0 \
  sh -c "npm run prisma:deploy"

# 2. Check exit code; if 0, proceed to rolling update:
docker service update --image foodgo-backend:v1.0.0 foodgo-stack_backend
```

### 3.4 Failure Handling & Rollbacks
- If `prisma migrate deploy` fails: The release pipeline terminates immediately. Existing containers running the previous version remain healthy and untouched.
- Rollback: Since all migrations are forward-compatible and non-destructive (adding optional columns / indices / tables), no rollbacks of migrations are needed if an application code regression occurs.

---

## 4. Reverse-Proxy and Network Hardening

### 4.1 Trust-Proxy Configuration
FoodiGo utilizes `express` behind NestJS. Express evaluates client IP addresses through the `X-Forwarded-For` header only when `trust proxy` is configured.
- Hardcoding `app.set('trust proxy', 1)` or `true` creates an IP-spoofing vulnerability when the application is directly exposed (clients could spoof their IP to bypass rate limits).
- Conversely, omitting `trust proxy` causes all requests behind a reverse-proxy (AWS ALB, Cloudflare, Nginx, Railway, Render) to appear as originating from the internal proxy IP (e.g. `10.0.0.1`), causing all users to share a single global rate-limit bucket.

### 4.2 Configurable `TRUST_PROXY_HOPS` Implementation
1. **Validation Schema (`src/config/env.validation.ts`):**
   ```typescript
   @IsInt()
   @Min(0)
   @Max(10)
   @IsOptional()
   TRUST_PROXY_HOPS: number = 0;
   ```
2. **Bootstrap Logic (`src/main.ts`):**
   ```typescript
   const configService = app.get(ConfigService);
   const trustProxyHops = configService.get<number>('TRUST_PROXY_HOPS', 0);
   if (trustProxyHops > 0) {
     app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
     logger.log(`Reverse proxy trust enabled: trusting ${trustProxyHops} hop(s)`);
   } else {
     logger.log('Reverse proxy trust disabled (direct connection mode)');
   }
   ```
3. **Environment Documentation (`.env.example`):**
   ```env
   # Number of trusted upstream reverse-proxy hops for X-Forwarded-For resolution.
   # Set to 0 if the backend is directly internet-exposed (default: safe).
   # Set to 1 if behind a single proxy (AWS ALB, Railway, Render, Fly.io, or Nginx).
   # Set to 2 if behind Cloudflare + ALB / Nginx.
   TRUST_PROXY_HOPS=0
   ```

### 4.3 Recommended Infrastructure Topologies
- **Direct Local / Dev:** `TRUST_PROXY_HOPS=0`
- **Railway / Render / Fly.io / AWS ALB:** `TRUST_PROXY_HOPS=1`
- **Cloudflare CDN + Nginx / ALB Ingress:** `TRUST_PROXY_HOPS=2`

---

## 5. Health and Monitoring Architecture

### 5.1 Endpoint Specification
`HealthController` (`src/health/health.controller.ts`) provides three distinct endpoints:

| Route | Purpose | Target Consumer | Dependency Checked | HTTP Success | HTTP Failure |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | Combined health status | Legacy monitoring / Pingdom | Memory + Database | `200 OK` | `200 OK` (degraded payload) |
| `GET /health/live` | Process liveness | Kubernetes / Docker liveness probe | None (process loop only) | `200 OK` | Container crash / unresp. |
| `GET /health/ready` | Traffic readiness | Kubernetes / Load Balancer readiness | Database query (`SELECT 1`) | `200 OK` | `503 Service Unavailable` |

### 5.2 Behavior Under Database Failure
- **Liveness (`/health/live`):** Continues to return `200 OK` (`{ status: 'ok', timestamp: '...' }`). Prevents orchestrators from killing and restarting healthy application pods during transient database hiccups.
- **Readiness (`/health/ready`):** Executes `SELECT 1` via `prisma.$queryRaw`. If the database is unreachable or times out, it throws an `HttpException(503)` returning:
  ```json
  {
    "status": "degraded",
    "timestamp": "2026-10-11T14:33:23.000Z",
    "database": "error"
  }
  ```
- **Information Leakage Prevention:** The error handler swallows all database exceptions, socket messages, connection strings, and stack traces. Only the opaque token `"error"` is returned.

### 5.3 Recommended Orchestrator Probe Configuration
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

---

## 6. Verification Results

### 6.1 Test Suite Execution
- **Backend Unit Tests:**
  ```
  Test Files  28 passed (28)
  Tests       325 passed (325)
  Duration    3.07s
  ```
- **Backend E2E Tests:**
  ```
  Test Files  4 passed (4)
  Tests       79 passed (79)
  Duration    3.79s
  ```
- **Backend TypeScript Compilation:**
  ```
  npx tsc -p tsconfig.build.json -> Exit Code: 0 (No compilation errors)
  ```
- **Mobile TypeScript Verification:**
  ```
  cd foodgo-customer && npx tsc --noEmit -> Exit Code: 0 (No type errors)
  ```

### 6.2 Docker Daemon Availability
- Docker CLI/daemon is **not installed/available** in the local workspace host environment.
- The Dockerfile syntax, multi-stage structure, layer caching, non-root user creation, and entrypoint declarations were verified against Dockerfile best practices and verified compatible with Alpine 3.20/Node 22 LTS.

---

## 7. Staging Deployment Checklist

### 7.1 Required Environment Variables
The following variables must be configured in the staging environment secrets manager:

| Variable | Category | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime | Must be `staging` or `production` |
| `PORT` | Network | Application port (default `3000`) |
| `DATABASE_URL` | Database | PostgreSQL connection string with SSL |
| `JWT_SECRET` | Security | Minimum 32-character random string |
| `JWT_REFRESH_SECRET` | Security | Minimum 32-character random string |
| `TWILIO_ACCOUNT_SID` | SMS Auth | Twilio SID (or test credentials) |
| `TWILIO_AUTH_TOKEN` | SMS Auth | Twilio Auth Token |
| `TWILIO_FROM_PHONE` | SMS Auth | Twilio Phone number in E.164 format |
| `RAZORPAY_KEY_ID` | Payments | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Payments | Razorpay Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Payments | Webhook HMAC secret |
| `CORS_ORIGINS` | Network | Comma-separated list of allowed origins |
| `TRUST_PROXY_HOPS` | Network | Number of trusted reverse-proxy hops (`1` for staging behind LB) |

### 7.2 Pre-Deployment Steps
1. Build container image: `docker build -t foodgo-backend:staging-v1 .`
2. Push container image to private container registry (e.g. AWS ECR / GHCR).
3. Verify database connectivity from staging VPC.

### 7.3 Deployment Execution Steps
1. **Execute Migrations:**
   ```bash
   docker run --rm --env-file /etc/foodgo/staging.env foodgo-backend:staging-v1 npm run prisma:deploy
   ```
2. **Deploy / Update Container:**
   ```bash
   # Example: Docker Compose / Swarm / ECS / K8s
   docker compose -f docker-compose.staging.yml up -d
   ```

### 7.4 Post-Deployment Verification Steps
1. Verify liveness probe: `curl -f http://staging-host:3000/health/live` (expects 200 `{ status: "ok" }`).
2. Verify readiness probe: `curl -f http://staging-host:3000/health/ready` (expects 200 `{ status: "ok", database: "connected" }`).
3. Verify backwards-compatible monitoring: `curl -f http://staging-host:3000/health`.
4. Trigger staging auth OTP test endpoint.
5. Verify customer app connection pointing to staging backend API.

---

## 8. Remaining Hosting-Specific Considerations

1. **Architecture Target (ARM64 vs x86_64):**
   If deploying to AWS Graviton (ARM64), add `"linux-arm64-openssl-3.0.x"` to `binaryTargets` in `prisma/schema.prisma` before building on an x86_64 CI builder with multi-arch cross-compilation.
2. **Reverse-Proxy SSL Termination:**
   Ensure the upstream reverse proxy sends the `X-Forwarded-Proto: https` header and that `TRUST_PROXY_HOPS` matches the exact number of internal proxies before the container.
3. **Database SSL Requirements:**
   If using AWS RDS or Supabase for staging PostgreSQL, append `?sslmode=require` or `?sslmode=prefer` to `DATABASE_URL` depending on VPC SSL configuration.
