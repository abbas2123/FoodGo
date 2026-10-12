import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

/**
 * Parses the CORS_ORIGIN environment variable into the value expected by
 * NestJS enableCors().
 *
 * Rules:
 *  - In production, an explicit CORS_ORIGIN is required.
 *    It may be a single URL or a comma-separated list of URLs.
 *    The wildcard "*" is NOT permitted in production.
 *  - In development/test, falling back to "*" is acceptable.
 *
 * Format examples:
 *   CORS_ORIGIN=https://app.example.com
 *   CORS_ORIGIN=https://app.example.com,https://staging.example.com
 */
function resolveCorsOrigin(): string | string[] | boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawOrigin = process.env.CORS_ORIGIN?.trim();

  if (!rawOrigin) {
    if (isProduction) {
      // Startup validation in env.validation.ts will already throw; belt-and-suspenders.
      throw new Error(
        'CORS_ORIGIN must be set in production. Example: CORS_ORIGIN=https://api.foodigo.app',
      );
    }
    // Development/test fallback — allow all origins
    return '*';
  }

  if (isProduction && rawOrigin === '*') {
    throw new Error(
      'CORS_ORIGIN cannot be "*" in production. Specify the exact client origin(s).',
    );
  }

  // Parse comma-separated list
  const origins = rawOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    instrument: ObserveInstrument,
  });

  // ── Task 2: HTTP security headers via Helmet ──────────────────────────────
  // Helmet sets secure defaults (X-Frame-Options, X-Content-Type-Options,
  // Strict-Transport-Security, etc.). Content-Security-Policy is intentionally
  // disabled because this is a JSON-only REST API, not a document server.
  // Razorpay webhook processing receives JSON bodies — no CSP impact.
  app.use(
    helmet({
      contentSecurityPolicy: false, // JSON API — CSP is irrelevant
    }),
  );

  // ── Task 3: CORS with explicit allowlist ──────────────────────────────────
  // Native React Native clients do NOT send CORS preflight requests, so CORS
  // only matters for browser-based clients (e.g., an admin panel or the web
  // version of the app). The wildcard is retained for development convenience
  // and explicitly forbidden in production via resolveCorsOrigin().
  const corsOrigin = resolveCorsOrigin();
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ── Trust proxy configuration ─────────────────────────────────────────────
  // Controls how many reverse-proxy hops Express trusts for X-Forwarded-For.
  // Configured via TRUST_PROXY_HOPS environment variable (default: 0 = disabled).
  //
  //   TRUST_PROXY_HOPS=0  — trust proxy disabled; safe for direct connections
  //   TRUST_PROXY_HOPS=1  — one proxy hop (nginx, ALB, Railway, Render, Fly.io)
  //   TRUST_PROXY_HOPS=N  — N chained proxy hops
  //
  // Without this, all clients share the proxy's IP in the throttle store,
  // making per-client rate limiting ineffective.
  // With an incorrect value, clients can spoof X-Forwarded-For to evade limits.
  //
  // See: FOODIGO_REMEDIATION_TASK_5_REPORT.md §1.3 and Task 6 report §4
  const configService = app.get(ConfigService);
  const trustProxyHops = configService.get<number>('TRUST_PROXY_HOPS') ?? 0;
  if (trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
    logger.log(`Trust proxy enabled: trusting ${trustProxyHops} proxy hop(s)`);
  } else {
    logger.log('Trust proxy disabled (TRUST_PROXY_HOPS=0); set TRUST_PROXY_HOPS=1 behind a reverse proxy');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Task 1: Swagger — disabled in production ──────────────────────────────
  // Exposing the interactive API explorer in production leaks endpoint
  // details and enables unauthenticated reconnaissance. Swagger remains
  // available in development and test environments.
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('FoodGo Backend API')
      .setDescription('Production-ready API for FoodGo food delivery platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  if (!isProduction) {
    logger.log(
      `API documentation available at http://localhost:${port}/api/docs`,
    );
  }
}
bootstrap();
