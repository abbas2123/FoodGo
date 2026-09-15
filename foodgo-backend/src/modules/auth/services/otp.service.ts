import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { PhoneUtil } from '../../../common/utils/phone.util.js';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createOtp(phone: string, purpose = 'LOGIN'): Promise<string> {
    const normalizedPhone = PhoneUtil.normalize(phone);

    const expiryMinutes =
      this.configService.get<number>('otp.expiryMinutes') ?? 5;
    const maxAttempts = this.configService.get<number>('otp.maxAttempts') ?? 5;
    const cooldownSeconds =
      this.configService.get<number>('otp.cooldownSeconds') ?? 60;

    // 1. Check existing cooldown
    const recentOtp = await this.prisma.otpVerification.findFirst({
      where: {
        phone: normalizedPhone,
        purpose,
        createdAt: {
          gte: new Date(Date.now() - cooldownSeconds * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      const waitTime = Math.ceil(
        (recentOtp.createdAt.getTime() + cooldownSeconds * 1000 - Date.now()) /
          1000,
      );
      throw new BadRequestException(
        `Please wait ${waitTime > 0 ? waitTime : 1} seconds before requesting a new OTP.`,
      );
    }

    // 2. Invalidate any previous active/pending OTP for this phone number and purpose
    await this.prisma.otpVerification.deleteMany({
      where: {
        phone: normalizedPhone,
        purpose,
      },
    });

    // 3. Generate secure 6-digit OTP using crypto.randomInt
    const otp = crypto.randomInt(100000, 1000000).toString();
    const saltRounds = 10;
    const otpHash = await bcrypt.hash(otp, saltRounds);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // 4. Store hashed OTP with expiration and attempt constraints
    await this.prisma.otpVerification.create({
      data: {
        phone: normalizedPhone,
        purpose,
        otpHash,
        attempts: 0,
        maxAttempts,
        expiresAt,
      },
    });

    this.logger.log(
      `OTP generated successfully for ${PhoneUtil.mask(normalizedPhone)} (purpose: ${purpose})`,
    );

    return otp;
  }

  async verifyOtp(
    phone: string,
    otp: string,
    purpose = 'LOGIN',
  ): Promise<boolean> {
    const normalizedPhone = PhoneUtil.normalize(phone);

    // 1. Find the latest pending OTP for the normalized phone number and purpose
    const record = await this.prisma.otpVerification.findFirst({
      where: {
        phone: normalizedPhone,
        purpose,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'No pending OTP found. Please request a new one.',
      );
    }

    // 2. Check whether the OTP has expired; if expired, delete and reject
    if (new Date() > record.expiresAt) {
      await this.prisma.otpVerification.deleteMany({
        where: { id: record.id },
      });

      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }

    // 3. Check maximum attempt count before verification
    if (record.attempts >= record.maxAttempts) {
      await this.prisma.otpVerification.deleteMany({
        where: { id: record.id },
      });

      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
    }

    // 4. Compare supplied OTP against bcrypt hash
    const isMatch = await bcrypt.compare(otp, record.otpHash);

    if (!isMatch) {
      let updated: { attempts: number; maxAttempts: number };
      try {
        updated = await this.prisma.otpVerification.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
          select: { attempts: true, maxAttempts: true },
        });
      } catch {
        throw new BadRequestException(
          'No pending OTP found. Please request a new one.',
        );
      }

      if (updated.attempts >= updated.maxAttempts) {
        await this.prisma.otpVerification.deleteMany({
          where: { id: record.id },
        });

        throw new BadRequestException(
          'Maximum verification attempts exceeded. Please request a new OTP.',
        );
      }

      const remainingAttempts = updated.maxAttempts - updated.attempts;
      throw new BadRequestException(
        `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
      );
    }

    // 5. Correct OTP: Atomically claim and delete the OTP record from PostgreSQL.
    // In PostgreSQL, `DELETE FROM otp_verifications WHERE id = $1` acquires an exclusive row lock.
    // When concurrent requests execute this statement:
    // - Exactly one request will delete the row and receive count = 1.
    // - Any concurrent request targeting the same row will find it already deleted and receive count = 0.
    // This provides true atomic single-use semantics without risk of double-spend or replay.
    const deleteResult = await this.prisma.otpVerification.deleteMany({
      where: {
        id: record.id,
      },
    });

    if (deleteResult.count === 0) {
      // Record was already consumed by a concurrent verification request
      throw new BadRequestException(
        'No pending OTP found. Please request a new one.',
      );
    }

    this.logger.log(
      `OTP verified successfully for ${PhoneUtil.mask(normalizedPhone)} (purpose: ${purpose})`,
    );

    return true;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanExpiredOtps(): Promise<number> {
    try {
      const result = await this.prisma.otpVerification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Expired OTP cleanup: removed ${result.count} expired OTP record(s)`,
        );
      }

      return result.count;
    } catch (error: any) {
      this.logger.error(
        `Expired OTP cleanup failed: ${error?.message}`,
        error?.stack,
      );
      return 0;
    }
  }
}
