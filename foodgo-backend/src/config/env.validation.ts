import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  DATABASE_URL: string = 'postgresql://localhost:5432/foodgo';

  @IsString()
  @IsNotEmpty({ message: 'JWT_ACCESS_SECRET must be defined in environment variables' })
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters for security' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsNotEmpty({ message: 'JWT_REFRESH_SECRET must be defined in environment variables' })
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters for security' })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  /**
   * CORS_ORIGIN: comma-separated list of permitted browser origins.
   *
   * Development/test: may be omitted (falls back to '*' in main.ts bootstrap).
   * Production: REQUIRED. Must not be '*'.
   *
   * Example (single):   CORS_ORIGIN=https://app.foodigo.app
   * Example (multiple): CORS_ORIGIN=https://app.foodigo.app,https://admin.foodigo.app
   */
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  /**
   * TRUST_PROXY_HOPS: controls Express "trust proxy" for accurate client-IP
   * resolution when the backend is behind a reverse proxy.
   *
   * 0 (default) — trust proxy is DISABLED. Safe for direct connections and for
   *               development. The X-Forwarded-For header is ignored entirely.
   *
   * 1           — trust exactly one proxy hop (e.g. a single nginx or ALB in
   *               front of the app). Use this for Railway, Render, Fly.io, or a
   *               single nginx/ALB deployment.
   *
   * N (>1)      — trust N chained proxy hops. Required only for multi-tier
   *               reverse-proxy topologies.
   *
   * Setting this incorrectly allows clients to spoof their IP via
   * X-Forwarded-For, defeating rate limiting. Set it to the exact number of
   * trusted proxy hops in your deployment topology — no more, no less.
   *
   * This value is read by main.ts at bootstrap to configure Express.
   */
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  TRUST_PROXY_HOPS: number = 0;

  @IsNumber()
  @Min(1)
  @IsOptional()
  OTP_EXPIRY_MINUTES: number = 5;

  @IsNumber()
  @Min(1)
  @IsOptional()
  OTP_MAX_ATTEMPTS: number = 5;

  @IsNumber()
  @Min(10)
  @IsOptional()
  OTP_COOLDOWN_SECONDS: number = 60;

  @IsString()
  @IsOptional()
  GOOGLE_MAPS_API_KEY?: string;

  @IsString()
  @IsOptional()
  PAYMENT_KEY_ID?: string;

  @IsString()
  @IsOptional()
  PAYMENT_KEY_SECRET?: string;

  @IsString()
  @IsOptional()
  PAYMENT_WEBHOOK_SECRET?: string;

  /**
   * DEPLOYMENT ALIAS RISK: RAZORPAY_* variables are accepted as fallbacks
   * for PAYMENT_* variables in configuration.ts and payment-gateway.service.ts.
   * Using both sets in a deployment could silently override the intended key.
   * Prefer PAYMENT_KEY_ID, PAYMENT_KEY_SECRET, PAYMENT_WEBHOOK_SECRET consistently.
   */
  @IsString()
  @IsOptional()
  RAZORPAY_KEY_ID?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_SECRET?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  AUTH_PROVIDER?: string = 'email';

  @IsString()
  @IsOptional()
  EMAIL_PROVIDER?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string = 'smtp.gmail.com';

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  SMTP_PORT?: number = 587;

  @IsOptional()
  SMTP_SECURE?: boolean | string = false;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMS_PROVIDER?: string;

  @IsString()
  @IsOptional()
  TWILIO_ACCOUNT_SID?: string;

  @IsString()
  @IsOptional()
  TWILIO_AUTH_TOKEN?: string;

  @IsString()
  @IsOptional()
  TWILIO_FROM_PHONE?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => Object.values(error.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Config validation error: ${errorMessages}`);
  }

  if (validatedConfig.JWT_ACCESS_SECRET === validatedConfig.JWT_REFRESH_SECRET) {
    throw new Error(
      'Config validation error: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different secret keys',
    );
  }

  const authProvider = (validatedConfig.AUTH_PROVIDER || 'email').toLowerCase();
  const emailProvider = (
    validatedConfig.EMAIL_PROVIDER ||
    (validatedConfig.NODE_ENV === Environment.Production ? 'resend' : 'dev')
  ).toLowerCase();

  // ── SMTP Configuration Validation (Active when EMAIL_PROVIDER is 'smtp') ──
  if (authProvider === 'email' && emailProvider === 'smtp') {
    const smtpHost = validatedConfig.SMTP_HOST?.trim();
    if (!smtpHost) {
      throw new Error(
        'Config validation error: SMTP_HOST must be configured when EMAIL_PROVIDER is "smtp"',
      );
    }

    const smtpPort = validatedConfig.SMTP_PORT;
    if (smtpPort === undefined || smtpPort === null || isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      throw new Error(
        'Config validation error: SMTP_PORT must be a valid port number between 1 and 65535 when EMAIL_PROVIDER is "smtp"',
      );
    }

    const smtpUser = validatedConfig.SMTP_USER?.trim();
    if (!smtpUser) {
      throw new Error(
        'Config validation error: SMTP_USER must be configured when EMAIL_PROVIDER is "smtp"',
      );
    }

    const smtpPass = validatedConfig.SMTP_PASS?.trim();
    if (!smtpPass) {
      throw new Error(
        'Config validation error: SMTP_PASS must be configured when EMAIL_PROVIDER is "smtp"',
      );
    }

    const emailFrom = validatedConfig.EMAIL_FROM?.trim();
    if (!emailFrom) {
      throw new Error(
        'Config validation error: EMAIL_FROM must be configured when EMAIL_PROVIDER is "smtp"',
      );
    }

    if (validatedConfig.NODE_ENV === Environment.Production) {
      if (smtpUser.includes('mock') || smtpPass.includes('mock')) {
        throw new Error(
          'Config validation error: Real SMTP_USER and SMTP_PASS must be set in production environment (mock values are forbidden in production)',
        );
      }
    }
  }

  if (validatedConfig.NODE_ENV === Environment.Production) {
    // ── Payment credentials ──────────────────────────────────────────────────
    const keyId = validatedConfig.PAYMENT_KEY_ID || validatedConfig.RAZORPAY_KEY_ID || '';
    const keySecret = validatedConfig.PAYMENT_KEY_SECRET || validatedConfig.RAZORPAY_KEY_SECRET || '';
    const hasKeyId = Boolean(keyId);
    const hasKeySecret = Boolean(keySecret);
    if (!hasKeyId || !hasKeySecret || keyId.includes('mock') || keySecret.includes('mock')) {
      throw new Error(
        'Config validation error: Real PAYMENT_KEY_ID and PAYMENT_KEY_SECRET must be set in production environment (mock keys are forbidden in production)',
      );
    }

    const webhookSecret = validatedConfig.PAYMENT_WEBHOOK_SECRET || validatedConfig.RAZORPAY_WEBHOOK_SECRET || '';
    if (!webhookSecret || webhookSecret.includes('mock')) {
      throw new Error(
        'Config validation error: Real PAYMENT_WEBHOOK_SECRET must be set in production environment (mock webhook secrets are forbidden in production)',
      );
    }

    // ── Email credentials in production ──────────────────────────────────────
    if (authProvider === 'email') {
      if (emailProvider !== 'resend' && emailProvider !== 'smtp') {
        throw new Error(
          `Config validation error: EMAIL_PROVIDER must be "resend" or "smtp" in production environment (received "${emailProvider}"). Development or mock email providers are strictly forbidden in production.`,
        );
      }

      if (emailProvider === 'resend') {
        const resendApiKey = validatedConfig.RESEND_API_KEY || '';
        if (!resendApiKey || resendApiKey.includes('mock')) {
          throw new Error(
            'Config validation error: Real RESEND_API_KEY must be set in production environment (mock keys are forbidden in production)',
          );
        }

        const emailFrom = validatedConfig.EMAIL_FROM?.trim();
        if (!emailFrom) {
          throw new Error(
            'Config validation error: EMAIL_FROM must be configured in production environment',
          );
        }
      }
    }

    // ── SMS credentials (only enforced if authProvider is sms or SMS_PROVIDER is set) ──
    if (authProvider === 'sms' || Boolean(validatedConfig.SMS_PROVIDER)) {
      const smsProvider = (validatedConfig.SMS_PROVIDER || 'twilio').toLowerCase();
      if (smsProvider !== 'twilio') {
        throw new Error(
          `Config validation error: SMS_PROVIDER must be "twilio" in production environment (received "${smsProvider}"). Development or mock SMS providers are strictly forbidden in production.`,
        );
      }

      const hasSid = Boolean(validatedConfig.TWILIO_ACCOUNT_SID);
      const hasToken = Boolean(validatedConfig.TWILIO_AUTH_TOKEN);
      const hasFrom = Boolean(validatedConfig.TWILIO_FROM_PHONE);
      if (!hasSid || !hasToken || !hasFrom) {
        throw new Error(
          'Config validation error: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE must be configured in production environment',
        );
      }

      const sid = validatedConfig.TWILIO_ACCOUNT_SID || '';
      const token = validatedConfig.TWILIO_AUTH_TOKEN || '';
      if (sid.includes('mock') || token.includes('mock')) {
        throw new Error(
          'Config validation error: Real TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in production environment (mock credentials are forbidden in production)',
        );
      }
    }

    // ── CORS origin ──────────────────────────────────────────────────────────
    // The main.ts bootstrap also checks this, but failing here gives a clearer
    // error at startup before the HTTP server is created.
    const corsOrigin = validatedConfig.CORS_ORIGIN?.trim();
    if (!corsOrigin || corsOrigin === '*') {
      throw new Error(
        'Config validation error: CORS_ORIGIN must be set to one or more specific origins in production (wildcard "*" is not allowed). ' +
        'Example: CORS_ORIGIN=https://app.foodigo.app',
      );
    }
  }

  return validatedConfig;
}
