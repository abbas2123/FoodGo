# FoodiGo — Remediation Task 2 Report: Payment Endpoint Rate-Limiting Audit and Fix

**Document Version:** 1.0.0  
**Date:** October 11, 2026  
**Status:** COMPLETED & VERIFIED  
**Author:** Antigravity Engineering Agent  
**Target:** `/Users/muhammedabbas/FoodiGo/foodgo-backend`

---

## 1. Executive Summary

During production readiness audits (`FOODIGO_PRODUCTION_READINESS_AUDIT.md` and `FOODIGO_AUDIT_VERIFICATION.md`), a critical throttling configuration issue was identified:
- All payment endpoints in `PaymentsController` inherited the generic global rate limit of **60 requests per 60 seconds per IP** configured in `AppModule`.
- This global limit was problematic in two opposite directions:
  1. **Too loose for payment creation & order initiation:** 60 requests/minute allowed malicious actors or compromised clients to spam order creation, flood Razorpay API quotas, or engage in card-testing attacks.
  2. **Too strict for Razorpay webhooks during peak checkout:** Razorpay delivers asynchronous webhook notifications (`order.paid`, `payment.captured`, `payment.failed`, `refund.processed`) from a shared pool of egress IP addresses. During flash sales or lunch/dinner spikes, delivery bursts could exceed 60 requests/minute from a single Razorpay egress IP, causing NestJS to reject legitimate webhook events with `HTTP 429 Too Many Requests`. This would trigger exponential backoff at Razorpay, delaying order confirmation for customers.
  3. **Risk of misconfiguring webhooks:** Simply slapping `@SkipThrottle()` on the webhook route would have left an unauthenticated endpoint completely unprotected against volumetric Denial-of-Service (DoS) attacks.

This remediation implements an **evidence-based, multi-tiered throttling policy** directly on `PaymentsController`, preserves existing cryptographic signature verification and persistent database idempotency, validates behavior through 313 unit tests and 79 E2E tests, and verifies zero breakage of existing payment workflows.

---

## 2. Phase 1 — Inspection Findings

### 2.1 Route Inventory & Current Throttle State
All routes in `PaymentsController` and `PaymentMethodsController` were inspected. Prior to this fix, no method in `PaymentsController` had an explicit `@Throttle()` or `@SkipThrottle()` decorator; every endpoint inherited the global throttler.

| Endpoint | Method | Auth Guard | Previous Throttle | Final Throttle |
| :--- | :--- | :--- | :--- | :--- |
| `/payments/create-order` | POST | `JwtAuthGuard` | 60 req / 60s (Global) | **20 req / 60s** (Dedicated) |
| `/payments/verify` | POST | `JwtAuthGuard` | 60 req / 60s (Global) | **20 req / 60s** (Dedicated) |
| `/payments/failure` | POST | `JwtAuthGuard` | 60 req / 60s (Global) | **20 req / 60s** (Dedicated) |
| `/payments/order/:orderId` | GET | `JwtAuthGuard` | 60 req / 60s (Global) | **30 req / 60s** (Dedicated) |
| `/payments/webhook` | POST | None (Signature) | 60 req / 60s (Global) | **120 req / 60s** (Dedicated) |
| `/payments/methods` | GET | `JwtAuthGuard` | 60 req / 60s (Global) | 60 req / 60s (Global) |
| `/payments/methods` | POST | `JwtAuthGuard` | 60 req / 60s (Global) | 60 req / 60s (Global) |
| `/payments/methods/:id/default` | PATCH | `JwtAuthGuard` | 60 req / 60s (Global) | 60 req / 60s (Global) |
| `/payments/methods/:id` | DELETE | `JwtAuthGuard` | 60 req / 60s (Global) | 60 req / 60s (Global) |

### 2.2 Webhook Signature & Idempotency Architecture
The webhook endpoint (`POST /payments/webhook`) relies on three sequential security checks:
1. **Raw Body Capture:** Enabled globally in `main.ts` via `NestFactory.create(AppModule, { rawBody: true })`. `PaymentsController.handleWebhook` extracts `req.rawBody.toString('utf-8')`.
2. **Cryptographic Signature Verification:** `PaymentsService.handleWebhook` validates the incoming `x-razorpay-signature` header using `PaymentGatewayService.verifyWebhookSignature(rawBody, signature)`. This computes `crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')` and executes a constant-time comparison via `crypto.timingSafeEqual`. Any invalid or missing signature triggers `BadRequestException('Invalid webhook signature')`.
3. **Persistent Two-Tier Idempotency:**
   - **Fast-path check:** Queries `prisma.processedWebhookEvent.findUnique` by `provider_eventId` (`provider: 'RAZORPAY', eventId: <resolvedId>`). If present, returns `{ status: 'already_processed', eventId }` without executing database mutations.
   - **Atomic Transaction Registration:** If not previously seen, inside `prisma.$transaction`, creates a row in `processedWebhookEvent` guarded by a database unique constraint `@@unique([provider, eventId])`.
   - **Concurrency Conflict Interception:** Concurrent duplicate deliveries from Razorpay hitting parallel threads trigger Prisma error `P2002` on `provider_event_id`, which is safely intercepted by `isDuplicateWebhookError` and returns `{ status: 'already_processed', eventId }`.

### 2.3 Throttler Storage Architecture
`AppModule` configures `@nestjs/throttler` via:
```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60000,
    limit: 60,
  },
]),
```
- **Storage Type:** In-Memory (`ThrottlerStorageService` backed by an in-process JavaScript `Map`).
- **Distributed Sharing:** Rate limits are **NOT shared across instances**. Each Node.js process / container maintains its own counter buckets.
- **Key Derivation:** `@nestjs/throttler` generates unique cache keys per route and IP:
  ```typescript
  const prefix = `${context.getClass().name}-${context.getHandler().name}-${name}`;
  return sha256(`${prefix}-${suffix}`); // suffix is normalizeIp(req.ip)
  ```
  Consequently, rate limit buckets are strictly isolated per handler. Hits on `/payments/create-order` do not consume tokens for `/payments/verify` or `/payments/webhook`.

---

## 3. Phase 2 — Policy Design Rationale

### 3.1 Endpoint Limits

#### 1. `POST /payments/create-order`: 20 requests / 60 seconds
- **Rationale:** Creating a payment order involves server-side order total re-calculation and calls Razorpay's `/v1/orders` API. Legitimate users initiate this once per checkout attempt.
- **Headroom for Retries & Shared IPs:** A customer may change payment methods or retry on payment failure. Furthermore, mobile users frequently share public IPv4 addresses via Carrier-Grade NAT (CGNAT) or campus/office Wi-Fi. A limit of 20 req/min provides a 4x–5x buffer for concurrent orders from the same NAT IP while preventing automated card-testing scripts from creating hundreds of orders.

#### 2. `POST /payments/verify`: 20 requests / 60 seconds
- **Rationale:** Called once by the mobile client after Razorpay modal completion.
- **Headroom for Retries & Flaky Networks:** On slow or intermittent mobile networks (e.g., 3G/4G cell handover), the client may timeout and retry verification. A limit of 20 req/min permits up to 20 verification retries within a 60-second window (one attempt every 3 seconds) without ever blocking a legitimate paying customer.
- **Abuse Prevention:** Protects the order confirmation database transaction and prevents brute-force signature manipulation.

#### 3. `POST /payments/failure`: 20 requests / 60 seconds
- **Rationale:** Reports user cancellations or payment failures from the client modal.
- **Headroom:** 20 req/min ensures failure telemetry is reliably captured even if the user rapidly dismisses the modal multiple times.

#### 4. `GET /payments/order/:orderId`: 30 requests / 60 seconds
- **Rationale:** Read-only endpoint queried by clients to check order transaction status.
- **Polling Headroom:** Allows polling at 2-second intervals (30 requests in 60 seconds) while awaiting webhook or verification confirmation.

#### 5. `POST /payments/webhook`: 120 requests / 60 seconds (Dedicated Policy)
- **Why NOT `@SkipThrottle()`:** Blindly disabling rate limiting on an unauthenticated public route exposes the backend to denial-of-service floods targeting raw body parsing, JSON decoding, and HMAC computation.
- **Why 120 req / 60s:** Razorpay dispatches webhook events from a concentrated set of IP addresses. Under high checkout concurrency, multiple webhooks can arrive from the same egress IP within 60 seconds. A limit of 120 req/min (2 requests per second sustained per IP) accommodates transaction bursts while maintaining a strict upper bound against volumetric attacks.
- **Enforcement:** Enforced via `@Throttle({ default: { limit: 120, ttl: 60000 } })`, layered behind HMAC-SHA256 signature verification and database idempotency.

---

## 4. Phase 3 — Implementation Details

### 4.1 Modifications to `PaymentsController`
File: `foodgo-backend/src/modules/payments/payments.controller.ts`

Imported `Throttle` from `@nestjs/throttler` and applied endpoint-specific decorators:
```typescript
import { Throttle } from '@nestjs/throttler';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async createPaymentOrder(...) { ... }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async verifyPayment(...) { ... }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('failure')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async recordFailure(...) { ... }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('order/:orderId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getOrderPayments(...) { ... }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(...) { ... }
}
```

### 4.2 Modifications to Controller Unit Tests
File: `foodgo-backend/src/modules/payments/payments.controller.spec.ts`

Added unit tests verifying that all endpoint metadata matches the designed throttling policies and that the webhook route is not skipped:
```typescript
describe('Throttling Policies and Rate Limits', () => {
  const reflector = new Reflector();

  it('createPaymentOrder has endpoint-specific limit of 20 req / 60s', () => {
    const limit = reflector.get('THROTTLER:LIMITdefault', controller.createPaymentOrder);
    const ttl = reflector.get('THROTTLER:TTLdefault', controller.createPaymentOrder);
    expect(limit).toBe(20);
    expect(ttl).toBe(60000);
  });

  it('verifyPayment has endpoint-specific limit of 20 req / 60s', () => {
    const limit = reflector.get('THROTTLER:LIMITdefault', controller.verifyPayment);
    const ttl = reflector.get('THROTTLER:TTLdefault', controller.verifyPayment);
    expect(limit).toBe(20);
    expect(ttl).toBe(60000);
  });

  it('recordFailure has endpoint-specific limit of 20 req / 60s', () => {
    const limit = reflector.get('THROTTLER:LIMITdefault', controller.recordFailure);
    const ttl = reflector.get('THROTTLER:TTLdefault', controller.recordFailure);
    expect(limit).toBe(20);
    expect(ttl).toBe(60000);
  });

  it('getOrderPayments has polling limit of 30 req / 60s', () => {
    const limit = reflector.get('THROTTLER:LIMITdefault', controller.getOrderPayments);
    const ttl = reflector.get('THROTTLER:TTLdefault', controller.getOrderPayments);
    expect(limit).toBe(30);
    expect(ttl).toBe(60000);
  });

  it('handleWebhook has high-capacity limit of 120 req / 60s and is NOT skipped', () => {
    const limit = reflector.get('THROTTLER:LIMITdefault', controller.handleWebhook);
    const ttl = reflector.get('THROTTLER:TTLdefault', controller.handleWebhook);
    const skip = reflector.get('THROTTLER:SKIPdefault', controller.handleWebhook);
    expect(limit).toBe(120);
    expect(ttl).toBe(60000);
    expect(skip).toBeFalsy();
  });
});
```

### 4.3 Modifications to E2E Tests
File: `foodgo-backend/test/phase2b-payment.e2e-spec.ts`

Added an E2E suite section verifying active throttling enforcement by `ThrottlerGuard`:
```typescript
describe('10. Payment Endpoint Rate Limiting and Throttle Policy Enforcement', () => {
  it('allows legitimate verification retries within limit and returns 429 when limit is exceeded', async () => {
    const responses: any[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: 999999,
          providerOrderId: 'order_fake',
          providerPaymentId: 'pay_fake',
          providerSignature: 'sig_fake',
        });
      responses.push(res);
    }

    const statuses = responses.map((r) => r.status);
    expect(statuses[0]).toBe(404); // Initial requests pass guard
    expect(statuses.includes(429)).toBe(true); // Exceeding 20 returns 429
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  it('rejects unauthenticated requests before payment processing without leaking data', async () => {
    const res = await request(app.getHttpServer())
      .post('/payments/create-order')
      .send({ orderId: 1 })
      .expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it('enforces mandatory webhook signature validation before processing', async () => {
    const res = await request(app.getHttpServer())
      .post('/payments/webhook')
      .send({ event: 'payment.captured' })
      .expect(400);
    expect(res.body.message).toContain('Missing x-razorpay-signature');
  });
});
```

---

## 5. Phase 4 — Test Results & Verification

All tests were executed using the established Node 20 runtime environment (`export PATH=~/.nvm/versions/node/v20.19.6/bin:$PATH`).

### 5.1 Focused Payment Unit Tests
```bash
npx vitest run src/modules/payments/payments.controller.spec.ts src/modules/payments/payments.service.spec.ts
```
**Result:**
- `payments.controller.spec.ts`: **16/16 passed** (including 5 new throttling policy metadata tests)
- `payments.service.spec.ts`: **31/31 passed**
- Total: **47/47 passed**, 0 failures.

### 5.2 Complete Backend Unit Test Suite
```bash
npm test
```
**Result:**
- Test Files: **28 passed (28)**
- Tests: **313 passed (313)**
- Duration: 3.12s
- Total: **313/313 passed**, 0 failures.

### 5.3 Backend E2E Test Suite
```bash
npm run test:e2e
```
**Result:**
- `test/phase2b-payment.e2e-spec.ts`: **28/28 passed** (including active 429 rate limit enforcement tests)
- `test/phase2a-order-lifecycle.e2e-spec.ts`: **24/24 passed**
- `test/phase1-5-verification.e2e-spec.ts`: **21/21 passed**
- `test/app.e2e-spec.ts`: **6/6 passed**
- Total: **79/79 passed across 4 test files**, 0 failures.

### 5.4 Backend Production Build
```bash
npm run build
```
**Result:**
- Nest CLI build succeeded cleanly (`exit code 0`). No TypeScript or bundling errors.

### 5.5 Mobile TypeScript Check
```bash
cd foodgo-customer && npx tsc --noEmit
```
**Result:**
- Clean exit (`exit code 0`). No type violations or API contract regressions.

> [!NOTE]
> **Razorpay Integration Boundary:**
> In accordance with project instructions and safety protocols, no real network requests were dispatched to Razorpay live or sandbox servers. All tests executed against server-authoritative mock and test cryptographic vectors without leaking secrets or altering environment configurations.

---

## 6. Architecture & Scalability Assessment

### 6.1 Multi-Instance Rate Limiting (In-Memory vs. Shared Storage)
- **Current State:** Throttler state is currently stored in-memory using NestJS's default `ThrottlerStorageService`.
- **Single Instance:** Works effectively for development, staging, and single-container deployments.
- **Multiple Instances (Horizontally Scaled):** When scaling the backend across multiple containers or Kubernetes pods behind a load balancer (e.g. AWS ALB, NGINX), each pod tracks request counts independently.
  - An attacker sending 20 req/min across 3 pods could effectively send up to 60 req/min.
  - Conversely, Razorpay webhooks distributed across pods will have even higher resilience against false 429s.
- **Production Recommendation:** When deploying multiple backend replicas, configure a shared Redis store (e.g., `@nest-lab/throttler-storage-redis` with Redis Sentinel or Redis Cluster) so that rate limits are tracked globally across all instances.

### 6.2 Reverse Proxy & Client IP Normalization
- In production, the backend is typically deployed behind a reverse proxy (NGINX, Cloudflare, AWS ALB).
- If the reverse proxy forwards requests without `app.set('trust proxy', 1)` in Express, `req.ip` will evaluate to the internal proxy IP rather than the true client IP.
- **Recommendation:** In `main.ts`, ensure `app.set('trust proxy', 1)` (or appropriate hop count/subnet) is configured for production environments to ensure `normalizeIp(req.ip)` evaluates client public IPs accurately.

---

## 7. Summary of Files Changed

| File Path | Changes |
| :--- | :--- |
| `foodgo-backend/src/modules/payments/payments.controller.ts` | Imported `Throttle` and applied endpoint-specific limits (`create-order`: 20/60s, `verify`: 20/60s, `failure`: 20/60s, `order/:id`: 30/60s, `webhook`: 120/60s). |
| `foodgo-backend/src/modules/payments/payments.controller.spec.ts` | Added unit tests verifying throttle metadata limits, TTLs, and ensuring webhooks are not skipped. |
| `foodgo-backend/test/phase2b-payment.e2e-spec.ts` | Added E2E tests verifying active rate limiting (HTTP 429 on exceeding threshold), legitimate retry handling, unauthenticated rejection, and webhook signature enforcement. |
| `FOODIGO_REMEDIATION_TASK_2_REPORT.md` | Comprehensive remediation report in project root. |

---

## 8. Conclusion
Remediation Task 2 is complete. Payment initialization, verification, failure reporting, and status queries now have dedicated, abuse-resistant rate limits tailored to mobile checkout behavior. Legitimate retries on slow cellular networks and shared NAT environments are fully accommodated. Razorpay webhooks are protected with a dedicated 120 req/min policy backed by HMAC-SHA256 signature verification and atomic database idempotency. All 313 unit tests and 79 E2E tests pass cleanly.
