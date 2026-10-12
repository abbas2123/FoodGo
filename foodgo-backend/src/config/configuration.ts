export interface AppConfig {
  env: string;
  port: number;
  databaseUrl: string;
  corsOrigin: string | undefined;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  otp: {
    expiryMinutes: number;
    maxAttempts: number;
    cooldownSeconds: number;
  };
  googleMapsApiKey: string;
  payment: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  };
  auth: {
    provider: string;
  };
  email: {
    provider: string;
    resendApiKey: string;
    from: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  // CORS_ORIGIN is intentionally optional here; bootstrap (main.ts) applies
  // the production enforcement logic using resolveCorsOrigin().
  corsOrigin: process.env.CORS_ORIGIN,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    cooldownSeconds: parseInt(process.env.OTP_COOLDOWN_SECONDS ?? '60', 10),
  },
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  payment: {
    // ALIAS RISK: RAZORPAY_* are legacy aliases. Use PAYMENT_* consistently.
    // If both are set, PAYMENT_* takes precedence.
    keyId: process.env.PAYMENT_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_id',
    keySecret: process.env.PAYMENT_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_secret',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_test_mock_webhook_secret',
  },
  auth: {
    provider: process.env.AUTH_PROVIDER || 'email',
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'production' ? 'resend' : 'dev'),
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'FoodiGo <onboarding@resend.dev>',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
});
