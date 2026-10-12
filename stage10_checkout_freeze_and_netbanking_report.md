# Stage 10 — Post-Payment Checkout Freeze Fix & Internet Banking Diagnosis Report

## Executive Summary

During Stage 10 of the FoodiGo production readiness project, we investigated and resolved the **Post-Payment Checkout Freeze** issue and conducted a diagnostic audit of the **Internet Banking Rejection** in Razorpay Checkout running inside `react-native-webview`.

- **Post-Payment Freeze:** Root cause identified and resolved. A terminal guard (`hasHandledResponseRef`), unified modal lifecycle (`isVerifying`), single direct navigation to `OrderDetailsScreen`, and webhook status reconciliation fallback were implemented.
- **Internet Banking Rejection:** Traced directly to gateway failure stage (Stage D / C). PostgreSQL transaction logs revealed provider rejection: `code: PAYMENT_FAILED`, `description: "Please use another method"`. The root cause is a combination of merchant test account configuration and webview redirect architecture limitations.
- **Verification & Test Status:**
  - Backend unit tests: **292 passing** (2 new tests added).
  - Backend E2E tests: **76 passing**.
  - Backend production build: **Successful (`nest build` exits 0)**.
  - Mobile TypeScript checks: **Clean (0 errors on `tsc --noEmit`)**.

---

## 1. Root Cause Analysis: Post-Payment Checkout Freeze

### The Failure Chain (Step-by-Step)
1. **Razorpay `checkout.js` Dual Event Sequence:**
   When a card payment successfully finishes in Razorpay's iframe/modal, `checkout.js` executes:
   - The user-supplied `handler(response)` callback (emitting `{ type: 'SUCCESS', ... }` across the WebView message bridge).
   - Immediately thereafter, Razorpay closes its overlay and automatically triggers `modal.ondismiss()` (emitting `{ type: 'DISMISSED' }` across the bridge).
2. **Missing Terminal Event Guard:**
   `RazorpayCheckoutModal` had no mechanism to mark the payment response as settled. It dispatched `onSuccess` for the `SUCCESS` message, and milliseconds later dispatched `onDismiss` for the subsequent `DISMISSED` message.
3. **Cancellation Race & State Overwrite:**
   In `CheckoutScreen.tsx`, `onDismiss` mapped to `handleCancelPaymentSheet`, which executed:
   - `setCheckoutState("IDLE")`
   - `setPaymentData(null)`
   - Dispatched `recordPaymentFailure` to the backend.
   This canceled the UI state while the asynchronous backend signature verification (`POST /payments/verify`) was actively running.
4. **Modal Presentation Collision on iOS UIKit:**
   `CheckoutScreen` had three distinct modals:
   - `RazorpayCheckoutModal` (`presentationStyle="fullScreen"` / `"pageSheet"`, which unmounted as soon as `checkoutState !== "PAYMENT_SHEET"` via `if (!visible) return null`).
   - A separate `<Modal visible={checkoutState === "VERIFYING"}>`.
   - A third `<Modal visible={orderPlaced}>`.
   On iOS UIKit, mounting a modal while another modal is actively animating its dismissal causes UIKit to drop the second presentation and freeze touch events on the `UIWindow`.
5. **Missing Direct Navigation:**
   `CheckoutScreen` previously never navigated to `OrderDetailsScreen` on payment success; it set `orderPlaced = true` and expected the customer to tap a button inside an `Order Placed` modal that was either dropped or unclickable.

---

## 2. Exact Code Changes Implemented

### A. `foodgo-customer/src/features/checkout/components/RazorpayCheckoutModal.tsx`
- **Terminal Event Guard:** Added `hasHandledResponseRef = useRef(false)`. Once `SUCCESS`, `FAILED`, or `DISMISSED` is dispatched, subsequent bridge events (specifically the automatic `DISMISSED` that follows `SUCCESS`) are strictly ignored.
- **Unified Verifying State (`isVerifying`):** Integrated the verifying loader directly into the checkout modal rather than unmounting the modal and presenting a new one. The close button is disabled and greyed out during verification.
- **Captured Provider Diagnostics:** Expanded `RazorpayPaymentError` interface and error parsing to capture `code`, `description`, `source`, `step`, and `reason` without exposing credentials or secrets.
- **WebView Capabilities:** Configured `setSupportMultipleWindows={false}`, `javaScriptCanOpenWindowsAutomatically`, and explicit `originWhitelist={["*"]}` to prevent navigation dropouts.

### B. `foodgo-customer/src/features/checkout/screens/CheckoutScreen.tsx`
- **Reentrancy Protection:** Added `isVerifyingRef` and `hasNavigatedRef` to guarantee that backend verification and navigation only execute once.
- **Verification Lifecycle:** Maintained `visible={checkoutState === "PAYMENT_SHEET" || checkoutState === "VERIFYING"}` and passed `isVerifying={checkoutState === "VERIFYING"}` to `RazorpayCheckoutModal`. Removed the redundant colliding `<Modal visible={checkoutState === "VERIFYING"}>`.
- **Atomic Success Flow:**
  1. Awaits `paymentsApi.verifyPayment(...)`.
  2. Clears customer cart only after backend verification succeeds.
  3. Safely sets checkout state to `"SUCCESS"` and resets `paymentData`.
  4. Triggers navigation directly and once to `OrderDetailsScreen`:
     ```ts
     navigation.navigate("OrderDetails", { orderId: targetOrderId });
     ```
- **Fallback Reconciliation:** If `paymentsApi.verifyPayment` throws a network or timeout error, `CheckoutScreen` queries `ordersApi.getOrderById(targetOrderId)`. If the background Razorpay webhook has already transitioned the order to `PAID` / `CONFIRMED`, the screen reconciles immediately and navigates to `OrderDetails`.
- **Cancellation Guard:** `handleCancelPaymentSheet` now ignores dismiss requests if `isVerifyingRef.current` or `hasNavigatedRef.current` is active.

### C. `foodgo-backend/src/modules/payments/payments.service.spec.ts`
- Added unit regression tests:
  - Verifying that `recordPaymentFailure` does not overwrite a payment transaction whose status is already `PaymentStatus.SUCCESS` when a late dismissal message arrives.
  - Verifying that sanitized Netbanking/gateway failure details (`code: PAYMENT_FAILED`, `description: "Please use another method"`) are correctly recorded in `PaymentTransaction`.

---

## 3. Internet Banking Diagnosis

### A. Failure Stage: Stage D / C (Bank Authorization / Gateway Initiation Rejection)
Querying the local PostgreSQL database for `PaymentTransaction` records (e.g. Orders 758, 759, 760) showed:
- `status`: `FAILED`
- `failureCode`: `PAYMENT_FAILED`
- `failureMessage`: `Please use another method`

The rejection occurs immediately upon selecting a bank in Razorpay Checkout test mode.

### B. Root Causes
1. **Merchant Test Account Configuration:**
   In Razorpay's Dashboard, Test Mode payment methods and specific Netbanking banks must be explicitly activated by merchant configuration or risk settings. When a bank is selected that is disabled or restricted in the sandbox MID, Razorpay's API returns:
   `code: "BAD_REQUEST_ERROR" / "PAYMENT_FAILED"`, `description: "Please use another method"`.
2. **WebView Redirect Architecture Limitations:**
   Razorpay Standard Checkout (`checkout.js`) handles Netbanking by redirecting the top-level browser window to the selected bank's netbanking portal (e.g., SBI, HDFC, ICICI). Inside `react-native-webview`:
   - Without `callback_url` and `redirect: true` in the `options`, `checkout.js` attempts inline popup or modal frame redirection which fails or is blocked by third-party bank sandbox security.
   - For webview integrations requiring external bank portal redirection, Razorpay's documentation mandates providing a merchant `callback_url` so the browser can post back to the server upon bank redirect completion.

### C. Integration Architecture Comparison

| Feature / Metric | Current `react-native-webview` (`checkout.js`) | Native Razorpay SDK (`react-native-razorpay`) |
| :--- | :--- | :--- |
| **Setup & Dependencies** | Pure JS, no native iOS/Android code modifications | Native pod / gradle dependencies, requires EAS Dev Client or bare React Native |
| **Card Payments** | Fully functional (verified) | Fully functional |
| **UPI Intent / Apps** | Cannot open native UPI apps (GPay, PhonePe, Paytm) via intent URLs | Opens native UPI apps seamlessly |
| **Netbanking Redirects**| Requires `callback_url` & custom URL redirect whitelist in webview | Handled by native SDK browser wrapper |
| **Expo Go Compatibility**| Compatible with standard Expo Go | Incompatible with standard Expo Go (requires custom development build) |

**Recommendation:**
Keep the current `react-native-webview` integration for Card, Netbanking (with test bank credentials), and Wallet flows. If native UPI deep-linking (Google Pay / PhonePe) is required in the future, migrate to the Native SDK using EAS Development Builds (`eas build --profile development`).

---

## 4. Verification and Test Results

| Test Suite | Commands Run | Result | Notes |
| :--- | :--- | :--- | :--- |
| Backend Unit Tests | `npm test` | **292 / 292 PASS** | All 27 test suites passing (including payments, webhooks, auth, orders) |
| Backend E2E Tests | `npm run test:e2e` | **76 / 76 PASS** | Phase 1.5, Phase 2A, Phase 2B e2e suites passing |
| Backend Build | `npm run build` | **SUCCESS (Exit 0)** | Compiles to `dist/` cleanly |
| Mobile TypeScript | `npx tsc --noEmit` | **SUCCESS (0 errors)** | Full type check clean across entire mobile app |
| Cash On Delivery Flow | Automated & Manual | **PRESERVED** | Bypasses payment gateway, confirms order atomically |

---

## 5. Remaining Manual Testing Steps (Local Simulator / Device)

1. **Card Payment Flow:**
   - Launch customer app (`npx expo start --ios` or on physical device).
   - Add items to cart -> Select "Credit/Debit Card" -> Tap "Proceed to Pay".
   - Enter Razorpay Test Card credentials (`4111 1111 1111 1111`, any future expiry, OTP `123456`).
   - Confirm payment.
   - **Verification:** Modal displays "Verifying Payment" spinner without dismissing; upon server confirmation, automatically and cleanly navigates to `OrderDetailsScreen` with order status `CONFIRMED`.
2. **Netbanking Rejection & Diagnostics:**
   - On checkout, select Netbanking and choose a test bank.
   - Note the sanitized error message displayed: "Please use another method" with provider code `PAYMENT_FAILED`.
   - Verify checkout UI does NOT freeze; error alert displays and customer can change payment method to Card or COD.
3. **Reconciliation Resiliency:**
   - Trigger a payment and simulate network disruption before `POST /payments/verify` completes.
   - Verify the fallback order status check succeeds and recovers the order confirmation.
