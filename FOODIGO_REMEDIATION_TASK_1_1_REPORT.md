# FoodiGo — Remediation Task 1.1: Final Review of Order Number Generation Report

**Date:** 2026-10-11  
**Project Root:** `/Users/muhammedabbas/FoodiGo`  
**Scope:** Final precision audit of order-number identifier format, non-truncation guarantees, Prisma `P2002` error classification, and transaction safety.  
**Status:** COMPLETE & FULLY VALIDATED  

---

## 1. Exact Files Changed

| File Path | Nature of Change |
| :--- | :--- |
| `foodgo-backend/src/common/utils/order-number.util.ts` | **Refactored**: Removed `.slice(0, 20)` arbitrary truncation fallback. Implemented fixed-length, zero-truncation formatting where prefix (`2 chars`), Base36 timestamp (`8 chars`), and cryptographic random hex (`8 chars`) combine to strictly and invariantly yield **exactly 20 characters**. Normalized `checkoutGroupId` to 28 characters (`VarChar(50)`). |
| `foodgo-backend/src/common/utils/order-number.util.spec.ts` | **Updated**: Added unit tests asserting exact 20-character non-truncation invariant, random hex segment completeness (8 full hex characters / 32 bits), and prefix normalization. |
| `foodgo-backend/src/modules/orders/orders.service.ts` | **Refactored**: Hardened `isOrderNumberUniqueConstraintError()` to strictly require a confirmed `order_number` constraint target. Unknown, missing, or unrelated `P2002` targets (e.g., `email`, `phone`, `provider_payment_id`) are never retried and propagate immediately. |
| `foodgo-backend/src/modules/orders/orders.service.spec.ts` | **Updated**: Added unit tests verifying that confirmed `order_number` P2002 triggers retry and succeeds, while unrelated P2002 targets (e.g. `email`) and missing target metadata reject immediately on the first attempt without retrying. |

---

## 2. Final Identifier Formats & Character Lengths

### A. Order Number (`orderNumber`)
- **Database Column:** `orders.order_number` (`@unique @map("order_number") @db.VarChar(20)`)
- **Generation Method:** `OrderNumberUtil.generate('FG')`
- **Final Format:** `FG-<TIMESTAMP_BASE36>-<RANDOM_HEX>`
- **Sample Identifier:** `FG-MV3TMQM4-26C51B08`
- **Character Breakdown:**
  - Prefix: `FG` (2 characters)
  - Delimiter: `-` (1 character)
  - Timestamp: `Date.now().toString(36).toUpperCase().padStart(8, '0')` (strictly 8 characters, covering millisecond precision until year 2059+)
  - Delimiter: `-` (1 character)
  - Random Component: `crypto.randomBytes(4).toString('hex').toUpperCase()` (strictly 8 characters = 4 full bytes = 32 bits = 4,294,967,296 possibilities per millisecond)
  - **Total Length:** `2 + 1 + 8 + 1 + 8 = 20` characters.
- **Truncation Elimination:**
  - Previous implementation relied on `.slice(0, 20)` which could slice away entropy if inputs varied.
  - The revised implementation guarantees every component is fixed-width. An explicit assertion check ensures the generated string is exactly 20 characters before return. Zero random bits are truncated or discarded.

### B. Checkout Group Identifier (`checkoutGroupId`)
- **Database Column:** `orders.checkout_group_id` (`@map("checkout_group_id") @db.VarChar(50)`)
- **Generation Method:** `OrderNumberUtil.generateCheckoutGroupId('CG')`
- **Final Format:** `CG-<TIMESTAMP_BASE36>-<RANDOM_HEX>`
- **Sample Identifier:** `CG-MV3TMQM4-9F8E7D6C5B4A1234`
- **Character Breakdown:**
  - Prefix: `CG` (2 characters) + Delimiter `-` (1 character) = 3 characters
  - Timestamp: 8 characters
  - Delimiter: `-` (1 character)
  - Random Component: `crypto.randomBytes(8).toString('hex').toUpperCase()` (16 hex characters = 64 bits of entropy)
  - **Total Length:** `3 + 8 + 1 + 16 = 28` characters (well within the 50-character column limit, zero truncation).

---

## 3. How Prisma P2002 Errors Are Classified

### Vulnerability in Prior Version:
In the initial Task 1 draft, `isOrderNumberUniqueConstraintError()` returned `true` if `error.meta?.target` was missing or unspecified. This risked retrying unrelated unique constraint errors (e.g. account email or user token conflicts).

### Hardened Classification Logic:
In [orders.service.ts](file:///Users/muhammedabbas/FoodiGo/foodgo-backend/src/modules/orders/orders.service.ts#L1248-L1273):
```typescript
private isOrderNumberUniqueConstraintError(error: any): boolean {
  if (error?.code !== 'P2002') return false;
  const target = error?.meta?.target;
  if (!target) return false;

  const isOrderNumberField = (t: unknown): boolean => {
    if (typeof t !== 'string') return false;
    const lower = t.toLowerCase();
    return (
      lower === 'order_number' ||
      lower === 'ordernumber' ||
      lower === 'orders_order_number_key' ||
      lower.endsWith('order_number_key') ||
      lower.endsWith('ordernumber_key')
    );
  };

  if (Array.isArray(target)) {
    return target.some(isOrderNumberField);
  }
  if (typeof target === 'string') {
    return isOrderNumberField(target);
  }

  return false;
}
```

### Safety Guarantees:
1. **Confirmed Target Requirement:** If `meta.target` is undefined, null, or empty, the function returns `false`.
2. **Strict Field Whitelist:** Only matches `order_number`, `orderNumber`, or PostgreSQL index `orders_order_number_key`.
3. **Immediate Rejection of Unrelated P2002s:** Unrelated uniqueness errors (e.g. `['email']`, `['phone']`, `['provider_payment_id']`) immediately return `false` and propagate up without retrying.

---

## 4. Retry and Transaction-Safety Explanation

### A. Rollback Isolation
In both `checkout()` and `placeOrder()`, order creation is executed inside an isolated interactive transaction block:
```typescript
await this.executeOrderTransaction(async () => {
  return this.prisma.$transaction(async (tx) => {
    // 1. Generate fresh OrderNumberUtil.generate() for each order
    // 2. tx.order.create(...)
    // 3. tx.cartItem.deleteMany(...) / tx.cart.update(...) (if COD)
  });
});
```

If `tx.order.create` fails with a unique constraint violation on `order_number`:
1. PostgreSQL immediately marks the transaction block as aborted.
2. Prisma rolls back the entire transaction.
3. Cart item deletions and cart updates are completely reverted in PostgreSQL.
4. No partial order record is persisted.

### B. Fresh Retry Boundary
When `executeOrderTransaction` catches a confirmed `order_number` P2002:
1. It verifies `attempt < maxRetries - 1` (allowing up to 3 attempts total).
2. The retry loop calls `operation()` afresh.
3. `operation()` invokes a brand new `this.prisma.$transaction(...)` connection.
4. Newly generated, distinct cryptographic order numbers are created via `OrderNumberUtil.generate()`.
5. Because the previous transaction was fully aborted and rolled back, the new transaction operates on clean state.

### C. Prevention of Duplicate External Side Effects
- **Payment Sessions:** Payment gateway orders (`Razorpay / paymentsApi.createPaymentOrder`) are **never** created inside `checkout()` or `placeOrder()`. They are created only when the client explicitly invokes `POST /payments/create-order` using the confirmed `orderId`.
- **In-App Notifications:** Notification dispatch (`notificationsService.createNotification`) is located strictly *after* `executeOrderTransaction()` returns. Notifications are only dispatched once the database transaction has committed.
- **Cart Mutations:** Cart deletions occur within the atomic database transaction; if the transaction fails, cart state is preserved.

---

## 5. Exact Test Commands & Results

### 1. Focused Utility and Orders Service Tests
```bash
npx vitest run src/common/utils/order-number.util.spec.ts src/modules/orders/orders.service.spec.ts
```
**Result:** **2 test files passed, 53 / 53 tests passed (100% pass)**
- `order-number.util.spec.ts` (9 tests):
  - Strict 20-character length verified.
  - Complete 8-character random hex verified without truncation.
  - Prefix normalization verified.
  - 10,000 rapid generation iterations with **0 collisions**.
- `orders.service.spec.ts` (44 tests):
  - Place order & checkout format and VarChar(20) compliance verified.
  - Confirmed `order_number` P2002 triggers retry and succeeds on attempt 2.
  - Retry exhaustion after 3 attempts throws `ConflictException`.
  - Unrelated P2002 (`target: ['email']`) is **not retried** (attempt count = 1).
  - Unknown P2002 (`target: {}`) is **not retried** (attempt count = 1).
  - Unrelated DB error (connection reset) is **not retried** (attempt count = 1).

### 2. Full Backend Unit Suite
```bash
npm test
```
**Result:** **28 test files passed, 308 / 308 tests passed (0 failures)**.

### 3. Backend E2E Test Suite
```bash
npm run test:e2e
```
**Result:** **4 test files passed, 76 / 76 tests passed (0 failures)**.

### 4. Backend Production Build
```bash
npm run build
```
**Result:** **Successful (`nest build` exits 0)**.

### 5. Mobile TypeScript Check
```bash
cd foodgo-customer && npx tsc --noEmit
```
**Result:** **Clean (0 errors)**.

---

## 6. Remaining Risks

1. **Database Schema Constraints:**
   `orderNumber` remains mapped to `@db.VarChar(20)`. The generator strictly produces exactly 20 characters, leaving zero margin for accidental prefix expansion without schema migration. Any future prefix changes must preserve the 20-character total width or expand the column width in a scheduled migration.
2. **Entropy Sufficiency:**
   With 32 bits (4 random bytes) of cryptographic randomness per millisecond timestamp, the probability of collision across multiple server nodes in the same millisecond is approximately 1 in 4.29 billion. Under standard load, the retry mechanism will effectively never be triggered; it functions as a fail-safe.

---
*Report completed and verified against the FoodiGo codebase.*
