# FoodiGo — Email-Based OTP Authentication Migration Report

**Date:** 2026-10-11  
**Project:** FoodiGo  
**Task:** Migrate phone-based authentication to email-based OTP authentication  
**Status:** ✅ COMPLETE AND LOCALLY VERIFIED

---

## 1. Objective

Replace FoodiGo's phone-number OTP login with email-based OTP login across the NestJS backend and the Expo React Native customer application.

**Out of scope:** All other modules (orders, cart, payments, favorites, addresses, profile, tracking, restaurants) were left completely unchanged.

---

## 2. Verification Results

| Check | Result |
|---|---|
| Backend unit tests | ✅ 356 / 356 passed |
| Backend E2E tests | ✅ 84 / 84 passed |
| Backend TypeScript (`tsconfig.build.json --noEmit`) | ✅ Exit 0 — no errors |
| Mobile TypeScript (`tsc --noEmit` in `foodgo-customer`) | ✅ Exit 0 — no errors |
| `git diff --check` (whitespace) | ✅ Exit 0 — clean |

---

## 3. Changes Made

### 3.1 Database Schema & Migration

**File:** `foodgo-backend/prisma/schema.prisma`

- `UserAuth`: `phone` changed to nullable (`String?`); `email` (`VARCHAR(255)`, unique, non-null) and `emailVerified` (`Boolean DEFAULT false`) added.
- `OtpVerification`: `phone` changed to nullable; `email` (`VARCHAR(255)`) added with compound index `(email, type)`.

**File:** `foodgo-backend/prisma/migrations/20261011153000_migrate_to_email_auth/migration.sql`

Additive migration applied to local `localhost:5432/foodgo`:
- `ALTER TABLE user_auth ALTER COLUMN phone DROP NOT NULL`
- `ALTER TABLE user_auth ADD COLUMN email VARCHAR(255) UNIQUE`
- `ALTER TABLE user_auth ADD COLUMN "emailVerified" BOOLEAN DEFAULT false`
- `ALTER TABLE otp_verifications ALTER COLUMN phone DROP NOT NULL`
- `ALTER TABLE otp_verifications ADD COLUMN email VARCHAR(255)`
- Compound index on `(email, type)` for OTP lookup
- Compound unique index on `cart_items (cart_id, menu_item_id)` to fix prior drift

Migration applied cleanly with zero data loss.

---

### 3.2 Backend — New Files

| File | Purpose |
|---|---|
| `src/common/utils/email.util.ts` | Email normalisation (`toLowerCase` + `trim`), RFC regex validation, masked logging (`cu*****@example.com`) |
| `src/common/utils/email.util.spec.ts` | Unit tests for all email utilities |
| `src/modules/auth/interfaces/email-provider.interface.ts` | `IEmailProvider` interface + `EMAIL_PROVIDER` injection token |
| `src/modules/auth/services/dev-email.service.ts` | Dev fallback: logs `[DEV EMAIL OTP]` in development; throws in production |
| `src/modules/auth/services/resend-email.service.ts` | Production Resend integration (10 s AbortController timeout, startup credential validation, masked logging) |
| `src/modules/auth/services/resend-email.service.spec.ts` | Unit tests for ResendEmailService |
| `src/modules/auth/dto/send-email-otp.dto.ts` | `SendEmailOtpDto` with `@IsEmail()` validation |
| `src/modules/auth/dto/verify-email-otp.dto.ts` | `VerifyEmailOtpDto` with `@IsEmail()` + 6-digit OTP regex |

---

### 3.3 Backend — Updated Files

| File | Changes |
|---|---|
| `src/modules/auth/services/otp.service.ts` | Added `createEmailOtp` (secure random, hashed, cooldown) and `verifyEmailOtp` (atomic delete, attempt limit) |
| `src/modules/auth/services/token.service.ts` | `rotateRefreshToken` supports both `email` and `phone` subject types |
| `src/modules/auth/interfaces/jwt-payload.interface.ts` | Added `email?: string` to JWT payload |
| `src/modules/auth/interfaces/tokens.interface.ts` | Added `email?: string` to token response interface |
| `src/modules/auth/dto/auth-response.dto.ts` | Added `email` field to auth response |
| `src/modules/auth/auth.service.ts` | Added `sendEmailOtp` and `verifyEmailOtp` methods; upsert via normalised email; legacy phone methods retained |
| `src/modules/auth/auth.controller.ts` | Added `POST /auth/email/send-otp` and `POST /auth/email/verify-otp` endpoints |
| `src/modules/auth/auth.module.ts` | Registered `EMAIL_PROVIDER` (DevEmailService / ResendEmailService); SMS provider remains resilient |
| `src/config/env.validation.ts` | Added `RESEND_API_KEY`, `EMAIL_FROM`, `OTP_EXPIRY_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_COOLDOWN_SECONDS` |
| `src/config/configuration.ts` | Surfaced email config under `emailAuth` namespace |
| `.env.example` | Documented all new email auth environment variables |

---

### 3.4 Customer App — Updated Files

| File | Changes |
|---|---|
| `src/api/client/apiConfig.ts` | `SEND_OTP → /auth/email/send-otp`, `VERIFY_OTP → /auth/email/verify-otp` |
| `src/api/client/apiClient.ts` | `isAuthEndpoint` guard updated from phone to email OTP route paths |
| `src/api/auth/authApi.ts` | `UserDto.email` (primary, required); `phone` optional/nullable; `sendOtp(email)` and `verifyOtp(email, otp)` |
| `src/store/slices/authSlice.ts` | `User.email` primary; `phone` optional; `sendOtpThunk(email)`, `verifyOtpThunk({email, otp})`, `login` reducer updated |
| `src/navigation/types.ts` | `OtpVerification` route params changed from `{ phoneNumber? }` to `{ email? }` |
| `src/features/auth/screens/PhoneNumberScreen.tsx` | Transformed to email input screen: RFC email validation, `email-address` keyboard, `you@example.com` placeholder, passes `email` to nav |
| `src/features/auth/screens/OtpVerificationScreen.tsx` | Reads `route.params?.email`, displays email in subtitle, passes to `verifyOtpThunk` and resend call; `autoComplete="one-time-code"` |
| `src/features/profile/components/ProfileHeader.tsx` | Props: `email` (required), `phone` (optional); initials derived from email prefix when no name; displays email as primary contact line |
| `src/features/profile/screens/ProfileScreen.tsx` | Passes `user?.email` to `ProfileHeader` |

---

## 4. Authentication Flow (After Migration)

```
User enters email → POST /auth/email/send-otp
                        ↓
                  OTP generated (6-digit, bcrypt-hashed, TTL=10min)
                  Email sent via Resend (prod) or console log (dev)
                        ↓
User enters OTP  → POST /auth/email/verify-otp
                        ↓
                  OTP atomically deleted on success (single-use)
                  UserAuth upserted by normalised email
                  Access token + refresh token issued
                        ↓
                  App stores tokens in SecureStorage
                  Redux state updated (isAuthenticated, user, tokens)
```

---

## 5. Security Properties

| Property | Implementation |
|---|---|
| OTP storage | bcrypt-hashed in `otp_verifications.code_hash` |
| OTP lifetime | 10 minutes (configurable via `OTP_EXPIRY_MINUTES`) |
| Attempt limit | Max 5 attempts (configurable via `OTP_MAX_ATTEMPTS`) |
| Resend cooldown | 60 s (configurable via `OTP_COOLDOWN_SECONDS`) |
| Single-use | Atomic `DELETE` on first successful verification |
| Production email | Credentials validated at startup; service refuses to start without `RESEND_API_KEY` + `EMAIL_FROM` |
| Dev fallback | `DevEmailService` prints OTP to console; **throws** in production |
| Log masking | All email logs use `cu*****@example.com` format; no OTP values logged in production |
| User identity | BigInt primary key unchanged; no ID replaced by email |

---

## 6. Backward Compatibility

- Legacy `POST /auth/phone/send-otp` and `POST /auth/phone/verify-otp` endpoints remain active (existing phone auth users / API clients unaffected).
- `phone` column is nullable (not dropped); existing rows with phone data are preserved.
- All non-auth modules (cart, orders, payments, favorites, addresses, restaurants, tracking, notifications) are **completely unchanged**.

---

## 7. Environment Variables Required

```env
# Email OTP (required in production)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@foodigo.app

# OTP behaviour (optional — defaults shown)
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_COOLDOWN_SECONDS=60
```

---

## COMPLETE AND LOCALLY VERIFIED
