import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { SmtpEmailService } from './smtp-email.service.js';
import { DevEmailService } from './dev-email.service.js';

describe('SmtpEmailService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  });

  const createConfigService = (overrides: Record<string, any> = {}) => {
    const config: Record<string, any> = {
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: 'test@gmail.com',
      SMTP_PASS: 'app-password-secret-123',
      EMAIL_FROM: 'FoodiGo <test@gmail.com>',
      EMAIL_PROVIDER: 'smtp',
      ...overrides,
    };

    return {
      get: vi.fn((key: string) => config[key]),
    } as unknown as ConfigService;
  };

  describe('Configuration & Initialization', () => {
    it('initializes with correct Gmail SMTP settings', () => {
      configService = createConfigService();
      const service = new SmtpEmailService(configService);

      expect(service.getIsConfigured()).toBe(true);
      expect(service.getHost()).toBe('smtp.gmail.com');
      expect(service.getPort()).toBe(587);
      expect(service.getSecure()).toBe(false);
      expect(service.getFromAddress()).toBe('FoodiGo <test@gmail.com>');
    });

    it('identifies missing SMTP_USER as unconfigured', () => {
      configService = createConfigService({ SMTP_USER: '' });
      const service = new SmtpEmailService(configService);

      expect(service.getIsConfigured()).toBe(false);
    });

    it('identifies missing SMTP_PASS as unconfigured', () => {
      configService = createConfigService({ SMTP_PASS: '' });
      const service = new SmtpEmailService(configService);

      expect(service.getIsConfigured()).toBe(false);
    });

    it('identifies missing EMAIL_FROM and falls back to user', () => {
      configService = createConfigService({ EMAIL_FROM: '', SMTP_USER: 'user@example.com' });
      const service = new SmtpEmailService(configService);

      expect(service.getFromAddress()).toBe('FoodiGo <user@example.com>');
      expect(service.getIsConfigured()).toBe(true);
    });

    it('handles custom or invalid SMTP_PORT by falling back to 587', () => {
      configService = createConfigService({ SMTP_PORT: 'invalid' });
      const service = new SmtpEmailService(configService);

      expect(service.getPort()).toBe(587);
    });

    it('fails at startup in production when EMAIL_PROVIDER=smtp and credentials are missing', () => {
      process.env.NODE_ENV = 'production';
      configService = createConfigService({
        SMTP_USER: '',
        SMTP_PASS: '',
        EMAIL_PROVIDER: 'smtp',
      });

      expect(() => new SmtpEmailService(configService)).toThrow(
        /FATAL: SMTP email provider cannot start in production without valid credentials/,
      );
    });
  });

  describe('OTP Dispatch via Mocked Transporter', () => {
    it('dispatches email OTP successfully with correct sender and recipient', async () => {
      configService = createConfigService();

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: 'gmail-message-id-12345',
        rejected: [],
      });
      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const service = new SmtpEmailService(configService, mockTransporter);

      await expect(service.sendOtp('customer@example.com', '654321')).resolves.toBeUndefined();

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.from).toBe('FoodiGo <test@gmail.com>');
      expect(callArg.to).toBe('customer@example.com');
      expect(callArg.subject).toContain('FoodiGo Verification Code');
      expect(callArg.text).toContain('654321');
      expect(callArg.html).toContain('654321');
    });

    it('rejects with InternalServerErrorException when service is unconfigured', async () => {
      configService = createConfigService({ SMTP_USER: '', SMTP_PASS: '' });
      const service = new SmtpEmailService(configService);

      await expect(service.sendOtp('customer@example.com', '654321')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('handles SMTP send rejection (rejected recipient) with BadRequestException', async () => {
      configService = createConfigService();

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: 'gmail-msg-id',
        rejected: ['bad-address@domain.invalid'],
      });
      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const service = new SmtpEmailService(configService, mockTransporter);

      await expect(service.sendOtp('bad-address@domain.invalid', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('handles SMTP authentication failure (535 Bad Credentials)', async () => {
      configService = createConfigService();

      const mockSendMail = vi.fn().mockRejectedValue(
        new Error('535-5.7.8 Username and Password not accepted'),
      );
      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const service = new SmtpEmailService(configService, mockTransporter);

      await expect(service.sendOtp('customer@example.com', '123456')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('handles SMTP connection timeout cleanly', async () => {
      configService = createConfigService();

      const mockSendMail = vi.fn().mockRejectedValue(
        new Error('ETIMEDOUT: Connection timed out after 10000ms'),
      );
      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const service = new SmtpEmailService(configService, mockTransporter);

      await expect(service.sendOtp('customer@example.com', '123456')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('sanitizes error logging to ensure SMTP password is never leaked', async () => {
      const password = 'my-super-secret-password-xyz';
      configService = createConfigService({ SMTP_PASS: password });

      const mockSendMail = vi.fn().mockRejectedValue(
        new Error(`SMTP auth failed for password ${password}`),
      );
      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const service = new SmtpEmailService(configService, mockTransporter);

      // Verify that the exception thrown to caller does not contain the password
      try {
        await service.sendOtp('customer@example.com', '123456');
        expect.unreachable('Should have thrown an error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(InternalServerErrorException);
        expect(err.message).not.toContain(password);
      }
    });
  });

  describe('Isolation and Provider Selection', () => {
    it('isolates DevEmailService from production', () => {
      process.env.NODE_ENV = 'production';
      expect(() => new DevEmailService()).toThrow(
        /DevEmailService cannot be instantiated in production/,
      );
    });
  });
});
