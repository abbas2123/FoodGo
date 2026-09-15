import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { OtpService } from './otp.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

describe('OtpService', () => {
  let service: OtpService;
  let prismaMock: {
    otpVerification: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let configServiceMock: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prismaMock = {
      otpVerification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'otp.expiryMinutes') return 5;
        if (key === 'otp.maxAttempts') return 5;
        if (key === 'otp.cooldownSeconds') return 60;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOtp', () => {
    it('1. should create OTP successfully as a 6-digit numeric string', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue(null);
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.otpVerification.create.mockResolvedValue({ id: 1n });

      const otp = await service.createOtp('+14155552671');

      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      expect(prismaMock.otpVerification.create).toHaveBeenCalledTimes(1);
    });

    it('2. OTP is stored as a bcrypt hash, not plaintext', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue(null);
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.otpVerification.create.mockResolvedValue({ id: 1n });

      const otp = await service.createOtp('+14155552671');

      const createCall = prismaMock.otpVerification.create.mock.calls[0][0];
      expect(createCall.data.otpHash).not.toBe(otp);
      expect(createCall.data.otpHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      const isMatch = await bcrypt.compare(otp, createCall.data.otpHash);
      expect(isMatch).toBe(true);
    });

    it('3. OTP expires after configured duration (5 minutes)', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue(null);
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.otpVerification.create.mockResolvedValue({ id: 1n });

      const before = Date.now();
      await service.createOtp('+14155552671');
      const after = Date.now();

      const createCall = prismaMock.otpVerification.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      const expectedMin = before + 5 * 60 * 1000;
      const expectedMax = after + 5 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('11. New OTP invalidates any previous active OTP for the same phone & purpose', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue(null);
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.otpVerification.create.mockResolvedValue({ id: 2n });

      await service.createOtp('+14155552671', 'LOGIN');

      expect(prismaMock.otpVerification.deleteMany).toHaveBeenCalledWith({
        where: {
          phone: '+14155552671',
          purpose: 'LOGIN',
        },
      });
    });

    it('12. Cooldown prevents rapid OTP requests', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 1n,
        createdAt: new Date(),
      });

      await expect(service.createOtp('+14155552671')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOtp('+14155552671')).rejects.toThrow(
        /Please wait \d+ seconds before requesting a new OTP\./,
      );
      expect(prismaMock.otpVerification.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('6. Correct OTP verifies successfully', async () => {
      const plainOtp = '123456';
      const hash = await bcrypt.hash(plainOtp, 10);

      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 1n,
        otpHash: hash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.verifyOtp('+14155552671', plainOtp);
      expect(result).toBe(true);
    });

    it('7. Correct OTP is deleted immediately from database after successful verification', async () => {
      const plainOtp = '123456';
      const hash = await bcrypt.hash(plainOtp, 10);

      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 10n,
        otpHash: hash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 1 });

      await service.verifyOtp('+14155552671', plainOtp);

      expect(prismaMock.otpVerification.deleteMany).toHaveBeenCalledWith({
        where: { id: 10n },
      });
      expect(prismaMock.otpVerification.update).not.toHaveBeenCalled();
    });

    it('8. Same OTP cannot be reused after verification because it is deleted', async () => {
      // First verification succeeded and deleted the record.
      // Next call for the same phone will find no pending OTP.
      prismaMock.otpVerification.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp('+14155552671', '123456')).rejects.toThrow(
        'No pending OTP found. Please request a new one.',
      );
    });

    it('4. Expired OTP cannot be verified and throws appropriate error', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 1n,
        otpHash: 'somehash',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() - 1000), // in the past
      });
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.verifyOtp('+14155552671', '123456')).rejects.toThrow(
        'OTP has expired. Please request a new one.',
      );
    });

    it('5. Expired OTP record is deleted upon failed verification', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 42n,
        otpHash: 'somehash',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() - 1000),
      });
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.verifyOtp('+14155552671', '123456')).rejects.toThrow();

      expect(prismaMock.otpVerification.deleteMany).toHaveBeenCalledWith({
        where: { id: 42n },
      });
    });

    it('9. Incorrect OTP increments attempt counter and returns remaining attempts', async () => {
      const hash = await bcrypt.hash('654321', 10);
      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 1n,
        otpHash: hash,
        attempts: 1,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });
      prismaMock.otpVerification.update.mockResolvedValue({
        attempts: 2,
        maxAttempts: 5,
      });

      await expect(service.verifyOtp('+14155552671', '111111')).rejects.toThrow(
        'Invalid OTP code. 3 attempt(s) remaining.',
      );
      expect(prismaMock.otpVerification.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { attempts: { increment: 1 } },
        select: { attempts: true, maxAttempts: true },
      });
    });

    it('10. Maximum attempts invalidates/deletes the OTP', async () => {
      const hash = await bcrypt.hash('654321', 10);
      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 1n,
        otpHash: hash,
        attempts: 4,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });
      prismaMock.otpVerification.update.mockResolvedValue({
        attempts: 5,
        maxAttempts: 5,
      });
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.verifyOtp('+14155552671', '111111')).rejects.toThrow(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
      expect(prismaMock.otpVerification.deleteMany).toHaveBeenCalledWith({
        where: { id: 1n },
      });
    });

    it('10b. Rejects and deletes if OTP is already at or past maximum attempts on entry', async () => {
      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 1n,
        otpHash: 'somehash',
        attempts: 5,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.verifyOtp('+14155552671', '111111')).rejects.toThrow(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
      expect(prismaMock.otpVerification.deleteMany).toHaveBeenCalledWith({
        where: { id: 1n },
      });
    });

    it('16. Concurrent verification: two simultaneous requests with valid OTP cannot both succeed', async () => {
      const plainOtp = '123456';
      const hash = await bcrypt.hash(plainOtp, 10);

      // Both requests find the exact same record concurrently
      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 1n,
        otpHash: hash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });

      // PostgreSQL atomic delete: Request A gets count 1, Request B gets count 0
      prismaMock.otpVerification.deleteMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const verifyPromiseA = service.verifyOtp('+14155552671', plainOtp);
      const verifyPromiseB = service.verifyOtp('+14155552671', plainOtp);

      const [resultA, resultB] = await Promise.allSettled([
        verifyPromiseA,
        verifyPromiseB,
      ]);

      const results = [resultA, resultB];
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<boolean>).value).toBe(true);

      expect(rejected).toHaveLength(1);
      const rejError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejError).toBeInstanceOf(BadRequestException);
      expect(rejError.message).toBe(
        'No pending OTP found. Please request a new one.',
      );
    });

    it('17. Concurrent burst: 5 simultaneous requests with valid OTP result in exactly 1 success and 4 rejections', async () => {
      const plainOtp = '654321';
      const hash = await bcrypt.hash(plainOtp, 10);

      prismaMock.otpVerification.findFirst.mockResolvedValue({
        id: 99n,
        otpHash: hash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });

      // Exactly 1 caller gets count: 1, remaining 4 callers get count: 0
      prismaMock.otpVerification.deleteMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      const promises = Array.from({ length: 5 }, () =>
        service.verifyOtp('+14155552671', plainOtp),
      );

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<boolean>).value).toBe(true);

      expect(rejected).toHaveLength(4);
      for (const rej of rejected) {
        const error = (rej as PromiseRejectedResult).reason;
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('No pending OTP found. Please request a new one.');
      }
    });
  });

  describe('cleanExpiredOtps (Scheduled cleanup)', () => {
    it('13. Scheduled cleanup deletes expired OTPs and returns count', async () => {
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 7 });

      const deletedCount = await service.cleanExpiredOtps();

      expect(deletedCount).toBe(7);
      expect(prismaMock.otpVerification.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('14. Scheduled cleanup does not delete valid OTPs (only filters expiresAt < now)', async () => {
      prismaMock.otpVerification.deleteMany.mockResolvedValue({ count: 0 });

      const deletedCount = await service.cleanExpiredOtps();

      expect(deletedCount).toBe(0);
      const callArg = prismaMock.otpVerification.deleteMany.mock.calls[0][0];
      expect(callArg.where.expiresAt.lt).toBeInstanceOf(Date);
      expect(callArg.where.expiresAt.lt.getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });
  });
});
