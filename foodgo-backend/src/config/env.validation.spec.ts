import 'reflect-metadata';
import { validate, Environment } from './env.validation.js';

/** Minimal valid development config — used as the base for all test cases. */
const devBase = {
  JWT_ACCESS_SECRET: 'access_secret_that_is_definitely_32_chars_or_more_xxxx',
  JWT_REFRESH_SECRET: 'refresh_secret_that_is_definitely_32_chars_or_more_xxxx',
};

/** Minimal valid production config — extended per test. */
const prodBase = {
  ...devBase,
  NODE_ENV: 'production',
  PAYMENT_KEY_ID: 'rzp_live_AAABBBCCC',
  PAYMENT_KEY_SECRET: 'live_secret_value',
  PAYMENT_WEBHOOK_SECRET: 'live_webhook_secret',
  AUTH_PROVIDER: 'email',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_live_valid_api_key_123',
  EMAIL_FROM: 'FoodiGo <orders@foodigo.app>',
  TWILIO_ACCOUNT_SID: 'ACtest123',
  TWILIO_AUTH_TOKEN: 'authtoken456',
  TWILIO_FROM_PHONE: '+15551234567',
  SMS_PROVIDER: 'twilio',
  CORS_ORIGIN: 'https://app.foodigo.app',
};

describe('env.validate()', () => {
  describe('JWT secret validation', () => {
    it('throws when JWT_ACCESS_SECRET is missing', () => {
      expect(() => validate({ JWT_REFRESH_SECRET: devBase.JWT_REFRESH_SECRET })).toThrow(
        /JWT_ACCESS_SECRET/i,
      );
    });

    it('throws when JWT_REFRESH_SECRET is missing', () => {
      expect(() => validate({ JWT_ACCESS_SECRET: devBase.JWT_ACCESS_SECRET })).toThrow(
        /JWT_REFRESH_SECRET/i,
      );
    });

    it('throws when both JWT secrets are identical', () => {
      const sameSecret = 'same_secret_same_secret_same_secret_xxxxxx';
      expect(() =>
        validate({ JWT_ACCESS_SECRET: sameSecret, JWT_REFRESH_SECRET: sameSecret }),
      ).toThrow(/must be different/i);
    });

    it('throws when JWT_ACCESS_SECRET is shorter than 32 chars', () => {
      expect(() =>
        validate({ JWT_ACCESS_SECRET: 'short', JWT_REFRESH_SECRET: devBase.JWT_REFRESH_SECRET }),
      ).toThrow(/at least 32 characters/i);
    });

    it('throws when JWT_REFRESH_SECRET is shorter than 32 chars', () => {
      expect(() =>
        validate({ JWT_ACCESS_SECRET: devBase.JWT_ACCESS_SECRET, JWT_REFRESH_SECRET: 'short' }),
      ).toThrow(/at least 32 characters/i);
    });

    it('accepts valid secrets of at least 32 chars', () => {
      expect(() => validate(devBase)).not.toThrow();
    });
  });

  describe('production — payment credentials', () => {
    it('throws when PAYMENT_KEY_ID is absent in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).PAYMENT_KEY_ID;
      expect(() => validate(cfg)).toThrow(/PAYMENT_KEY_ID/i);
    });

    it('throws when PAYMENT_KEY_ID contains "mock" in production', () => {
      expect(() =>
        validate({ ...prodBase, PAYMENT_KEY_ID: 'rzp_test_mock_id' }),
      ).toThrow(/mock keys are forbidden/i);
    });

    it('throws when PAYMENT_WEBHOOK_SECRET is absent in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).PAYMENT_WEBHOOK_SECRET;
      expect(() => validate(cfg)).toThrow(/PAYMENT_WEBHOOK_SECRET/i);
    });

    it('accepts valid production payment credentials', () => {
      expect(() => validate(prodBase)).not.toThrow();
    });
  });

  describe('production — SMS credentials', () => {
    it('throws when SMS_PROVIDER is "dev" in production', () => {
      expect(() => validate({ ...prodBase, SMS_PROVIDER: 'dev' })).toThrow(/SMS_PROVIDER.*must be "twilio"/i);
    });

    it('throws when SMS_PROVIDER is "mock" in production', () => {
      expect(() => validate({ ...prodBase, SMS_PROVIDER: 'mock' })).toThrow(/SMS_PROVIDER.*must be "twilio"/i);
    });

    it('throws when SMS_PROVIDER is "development" in production', () => {
      expect(() => validate({ ...prodBase, SMS_PROVIDER: 'development' })).toThrow(/SMS_PROVIDER.*must be "twilio"/i);
    });

    it('throws when Twilio credentials contain "mock" in production', () => {
      expect(() => validate({ ...prodBase, TWILIO_ACCOUNT_SID: 'AC_mock_123' })).toThrow(
        /mock credentials are forbidden/i,
      );
    });

    it('throws when TWILIO_ACCOUNT_SID is missing in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).TWILIO_ACCOUNT_SID;
      expect(() => validate(cfg)).toThrow(/TWILIO_ACCOUNT_SID/i);
    });

    it('throws when TWILIO_AUTH_TOKEN is missing in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).TWILIO_AUTH_TOKEN;
      expect(() => validate(cfg)).toThrow(/TWILIO_AUTH_TOKEN/i);
    });

    it('throws when TWILIO_FROM_PHONE is missing in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).TWILIO_FROM_PHONE;
      expect(() => validate(cfg)).toThrow(/TWILIO_FROM_PHONE/i);
    });

    it('accepts valid production Twilio credentials', () => {
      expect(() => validate(prodBase)).not.toThrow();
    });
  });

  describe('production — email provider validation', () => {
    it('throws when EMAIL_PROVIDER is dev in production', () => {
      expect(() =>
        validate({ ...prodBase, EMAIL_PROVIDER: 'dev' }),
      ).toThrow(/EMAIL_PROVIDER must be "resend" or "smtp" in production/i);
    });

    it('throws when RESEND_API_KEY is missing in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).RESEND_API_KEY;
      expect(() => validate(cfg)).toThrow(/Real RESEND_API_KEY must be set in production/i);
    });

    it('throws when RESEND_API_KEY contains mock in production', () => {
      expect(() =>
        validate({ ...prodBase, RESEND_API_KEY: 're_mock_key_123' }),
      ).toThrow(/mock keys are forbidden/i);
    });

    it('throws when EMAIL_FROM is missing in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).EMAIL_FROM;
      expect(() => validate(cfg)).toThrow(/EMAIL_FROM must be configured in production/i);
    });

    it('accepts valid production Resend email configuration', () => {
      expect(() => validate(prodBase)).not.toThrow();
    });
  });

  describe('SMTP email provider validation', () => {
    const validSmtp = {
      ...devBase,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_USER: 'test@gmail.com',
      SMTP_PASS: 'app-password-1234',
      EMAIL_FROM: 'FoodiGo <test@gmail.com>',
    };

    it('accepts valid SMTP configuration', () => {
      expect(() => validate(validSmtp)).not.toThrow();
    });

    it('throws when SMTP_HOST is missing', () => {
      const cfg = { ...validSmtp, SMTP_HOST: '   ' };
      expect(() => validate(cfg)).toThrow(/SMTP_HOST must be configured/i);
    });

    it('throws when SMTP_PORT is invalid', () => {
      const cfg = { ...validSmtp, SMTP_PORT: 70000 };
      expect(() => validate(cfg)).toThrow(/SMTP_PORT/i);
    });

    it('throws when SMTP_USER is missing', () => {
      const cfg = { ...validSmtp, SMTP_USER: '' };
      expect(() => validate(cfg)).toThrow(/SMTP_USER must be configured/i);
    });

    it('throws when SMTP_PASS is missing', () => {
      const cfg = { ...validSmtp, SMTP_PASS: '' };
      expect(() => validate(cfg)).toThrow(/SMTP_PASS must be configured/i);
    });

    it('throws when EMAIL_FROM is missing with SMTP', () => {
      const cfg = { ...validSmtp, EMAIL_FROM: '' };
      expect(() => validate(cfg)).toThrow(/EMAIL_FROM must be configured/i);
    });

    it('throws when SMTP credentials contain mock in production', () => {
      expect(() =>
        validate({
          ...prodBase,
          EMAIL_PROVIDER: 'smtp',
          SMTP_HOST: 'smtp.gmail.com',
          SMTP_PORT: 587,
          SMTP_USER: 'mock_user',
          SMTP_PASS: 'mock_pass',
          EMAIL_FROM: 'FoodiGo <orders@foodigo.app>',
        }),
      ).toThrow(/mock values are forbidden in production/i);
    });

    it('accepts valid production SMTP email configuration', () => {
      expect(() =>
        validate({
          ...prodBase,
          EMAIL_PROVIDER: 'smtp',
          SMTP_HOST: 'smtp.gmail.com',
          SMTP_PORT: 587,
          SMTP_USER: 'real_user@foodigo.app',
          SMTP_PASS: 'real_app_password',
          EMAIL_FROM: 'FoodiGo <orders@foodigo.app>',
        }),
      ).not.toThrow();
    });
  });

  describe('production — CORS_ORIGIN validation (Task 3 / Task 6)', () => {
    it('throws when CORS_ORIGIN is absent in production', () => {
      const cfg = { ...prodBase };
      delete (cfg as any).CORS_ORIGIN;
      expect(() => validate(cfg)).toThrow(/CORS_ORIGIN/i);
    });

    it('throws when CORS_ORIGIN is "*" in production', () => {
      expect(() => validate({ ...prodBase, CORS_ORIGIN: '*' })).toThrow(/wildcard.*not allowed/i);
    });

    it('accepts a single explicit origin in production', () => {
      expect(() =>
        validate({ ...prodBase, CORS_ORIGIN: 'https://app.foodigo.app' }),
      ).not.toThrow();
    });

    it('accepts a comma-separated list of origins in production', () => {
      expect(() =>
        validate({ ...prodBase, CORS_ORIGIN: 'https://app.foodigo.app,https://admin.foodigo.app' }),
      ).not.toThrow();
    });
  });

  describe('development — permissive defaults', () => {
    it('does not throw when CORS_ORIGIN is absent in development', () => {
      expect(() => validate(devBase)).not.toThrow();
    });

    it('does not throw when payment keys are absent in development', () => {
      expect(() => validate(devBase)).not.toThrow();
    });

    it('does not throw when SMS_PROVIDER is absent in development', () => {
      expect(() => validate(devBase)).not.toThrow();
    });
  });
});
