import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, InternalServerErrorException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { EMAIL_PROVIDER } from './../src/modules/auth/interfaces/email-provider.interface.js';
import type { IEmailProvider } from './../src/modules/auth/interfaces/email-provider.interface.js';

describe('App & Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('should return wrapped Hello World!', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBe('Hello World!');
        });
    });
  });

  describe('GET /health', () => {
    it('should return 200 and health check payload', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.uptime).toBeDefined();
          expect(res.body.data.timestamp).toBeDefined();
        });
    });
  });

  describe('POST /auth/phone/send-otp', () => {
    it('should reject invalid phone format with 400', () => {
      return request(app.getHttpServer())
        .post('/auth/phone/send-otp')
        .send({ phone: 'invalid-phone' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.statusCode).toBe(400);
        });
    });

    it('should reject non-whitelisted payload properties with 400', () => {
      return request(app.getHttpServer())
        .post('/auth/phone/send-otp')
        .send({ phone: '+14155552671', malicious: 'property' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });
  });

  describe('POST /auth/phone/verify-otp', () => {
    it('should reject short OTP code with 400', () => {
      return request(app.getHttpServer())
        .post('/auth/phone/verify-otp')
        .send({ phone: '+14155552671', otp: '123' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.statusCode).toBe(400);
        });
    });

    it('concurrent verification race: exactly one of simultaneous requests succeeds and generates tokens', async () => {
      const prisma = app.get(PrismaService);
      const phone = '+14155559999';
      const plainOtp = '654321';
      const saltRounds = 10;
      const otpHash = await bcrypt.hash(plainOtp, saltRounds);

      // Clean any existing records for test phone
      const existingAuth = await prisma.userAuth.findUnique({ where: { phone } });
      if (existingAuth) {
        await prisma.user.delete({ where: { id: existingAuth.userId } });
      }
      await prisma.otpVerification.deleteMany({ where: { phone } });

      // Seed valid OTP record
      await prisma.otpVerification.create({
        data: {
          phone,
          purpose: 'LOGIN',
          otpHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // Fire 2 simultaneous verify requests
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/phone/verify-otp')
          .send({ phone, otp: plainOtp }),
        request(app.getHttpServer())
          .post('/auth/phone/verify-otp')
          .send({ phone, otp: plainOtp }),
      ]);

      const responses = [resA, resB];
      const successResponses = responses.filter(
        (r) => r.status === 200 || r.status === 201,
      );
      const failureResponses = responses.filter((r) => r.status === 400);

      // Exactly ONE request succeeds, and the other is rejected
      expect(successResponses).toHaveLength(1);
      expect(failureResponses).toHaveLength(1);

      expect(successResponses[0].body.data.tokens).toBeDefined();
      expect(successResponses[0].body.data.tokens.accessToken).toBeDefined();

      expect(failureResponses[0].body.message).toBe(
        'No pending OTP found. Please request a new one.',
      );

      // Cleanup
      const createdAuth = await prisma.userAuth.findUnique({ where: { phone } });
      if (createdAuth) {
        await prisma.user.delete({ where: { id: createdAuth.userId } });
      }
      await prisma.otpVerification.deleteMany({ where: { phone } });
    });
  });

  describe('POST /auth/email/send-otp', () => {
    it('should reject invalid email format with 400', () => {
      return request(app.getHttpServer())
        .post('/auth/email/send-otp')
        .send({ email: 'not-an-email' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.statusCode).toBe(400);
        });
    });

    it('should reject non-whitelisted payload properties with 400', () => {
      return request(app.getHttpServer())
        .post('/auth/email/send-otp')
        .send({ email: 'valid@example.com', malicious: 'property' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('should successfully generate and dispatch email OTP in dev environment', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/email/send-otp')
        .send({ email: 'customer.test@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('OTP sent successfully');

      const prisma = app.get(PrismaService);
      const record = await prisma.otpVerification.findFirst({
        where: { email: 'customer.test@example.com' },
      });
      expect(record).toBeDefined();

      await prisma.otpVerification.deleteMany({
        where: { email: 'customer.test@example.com' },
      });
    });

    it('handles provider delivery failure without false success', async () => {
      const emailProvider = app.get<IEmailProvider>(EMAIL_PROVIDER);
      const originalSendOtp = emailProvider.sendOtp;
      emailProvider.sendOtp = vi.fn().mockRejectedValue(
        new InternalServerErrorException('Failed to deliver verification code. Please try again later.'),
      );

      try {
        await request(app.getHttpServer())
          .post('/auth/email/send-otp')
          .send({ email: 'provider-failure@example.com' })
          .expect(500)
          .expect((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.statusCode).toBe(500);
            expect(res.body.message).toContain('Failed to deliver verification code');
          });
      } finally {
        emailProvider.sendOtp = originalSendOtp;
      }
    });
  });

  describe('POST /auth/email/verify-otp', () => {
    it('should reject short or malformed OTP code with 400', () => {
      return request(app.getHttpServer())
        .post('/auth/email/verify-otp')
        .send({ email: 'customer@example.com', otp: '12' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.statusCode).toBe(400);
        });
    });

    it('concurrent email OTP verification race: exactly one request succeeds and authenticates user', async () => {
      const prisma = app.get(PrismaService);
      const email = 'e2e.concurrent@foodigo.app';
      const plainOtp = '789123';
      const saltRounds = 10;
      const otpHash = await bcrypt.hash(plainOtp, saltRounds);

      // Clean any existing records
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        await prisma.user.delete({ where: { id: existingUser.id } });
      }
      await prisma.otpVerification.deleteMany({ where: { email } });

      // Seed valid OTP record
      await prisma.otpVerification.create({
        data: {
          email,
          purpose: 'LOGIN',
          otpHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // Fire 2 simultaneous verify requests
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/email/verify-otp')
          .send({ email, otp: plainOtp }),
        request(app.getHttpServer())
          .post('/auth/email/verify-otp')
          .send({ email, otp: plainOtp }),
      ]);

      const responses = [resA, resB];
      const successResponses = responses.filter((r) => r.status === 200 || r.status === 201);
      const failureResponses = responses.filter((r) => r.status === 400);

      expect(successResponses).toHaveLength(1);
      expect(failureResponses).toHaveLength(1);

      expect(successResponses[0].body.data.tokens).toBeDefined();
      expect(successResponses[0].body.data.tokens.accessToken).toBeDefined();
      expect(successResponses[0].body.data.user.email).toBe(email);

      expect(failureResponses[0].body.message).toBe(
        'No pending OTP found. Please request a new one.',
      );

      // Cleanup
      const createdUser = await prisma.user.findUnique({ where: { email } });
      if (createdUser) {
        await prisma.user.delete({ where: { id: createdUser.id } });
      }
      await prisma.otpVerification.deleteMany({ where: { email } });
    });
  });
});
