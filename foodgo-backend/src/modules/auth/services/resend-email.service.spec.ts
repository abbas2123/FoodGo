import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendEmailService } from './resend-email.service.js';

describe('ResendEmailService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it('fails at startup in production if credentials are missing', () => {
    process.env.NODE_ENV = 'production';
    configService = {
      get: vi.fn().mockReturnValue(''),
    } as unknown as ConfigService;

    expect(() => new ResendEmailService(configService)).toThrow(
      /FATAL: Resend email provider cannot start in production without valid credentials/,
    );
  });

  it('initializes successfully when configured', () => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return 're_1234567890';
        if (key === 'EMAIL_FROM') return 'FoodiGo <onboarding@resend.dev>';
        return '';
      }),
    } as unknown as ConfigService;

    const service = new ResendEmailService(configService);
    expect(service.getIsConfigured()).toBe(true);
  });

  it('sends email successfully via Resend API', async () => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return 're_1234567890';
        if (key === 'EMAIL_FROM') return 'FoodiGo <onboarding@resend.dev>';
        return '';
      }),
    } as unknown as ConfigService;

    const service = new ResendEmailService(configService);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 'res_123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(service.sendOtp('customer@example.com', '123456')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_1234567890',
        }),
      }),
    );
  });

  it('handles Resend API 400 Bad Request error cleanly', async () => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return 're_1234567890';
        if (key === 'EMAIL_FROM') return 'FoodiGo <onboarding@resend.dev>';
        return '';
      }),
    } as unknown as ConfigService;

    const service = new ResendEmailService(configService);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue({ message: 'Invalid recipient email' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(service.sendOtp('bad@example.com', '123456')).rejects.toThrow(BadRequestException);
  });

  it('handles Resend API 500 error without exposing internal details', async () => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return 're_1234567890';
        if (key === 'EMAIL_FROM') return 'FoodiGo <onboarding@resend.dev>';
        return '';
      }),
    } as unknown as ConfigService;

    const service = new ResendEmailService(configService);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn().mockResolvedValue({ message: 'Database failure at Resend' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(service.sendOtp('customer@example.com', '123456')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
