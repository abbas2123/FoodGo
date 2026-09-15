export interface AppConfig {
  env: string;
  port: number;
  databaseUrl: string;
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
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ??
      'foodgo-default-access-secret-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ??
      'foodgo-default-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    cooldownSeconds: parseInt(process.env.OTP_COOLDOWN_SECONDS ?? '60', 10),
  },
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
});
