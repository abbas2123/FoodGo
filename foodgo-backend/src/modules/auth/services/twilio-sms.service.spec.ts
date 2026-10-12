import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TwilioSmsService } from './twilio-sms.service.js';
import { DevSmsService } from './dev-sms.service.js';

describe('TwilioSmsService', () => {
  let service: TwilioSmsService;
  let configServiceMock: { get: ReturnType<typeof vi.fn> };
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    configServiceMock = {
      get: vi.fn(),
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('should initialize successfully when credentials are provided', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'TWILIO_ACCOUNT_SID') return 'AC1234567890';
      if (key === 'TWILIO_AUTH_TOKEN') return 'authtoken123';
      if (key === 'TWILIO_FROM_PHONE') return '+15551234567';
      return null;
    });

    service = new TwilioSmsService(configServiceMock as unknown as ConfigService);
    expect(service.getIsConfigured()).toBe(true);
  });

  it('should throw error on construction in production when credentials are missing', () => {
    process.env.NODE_ENV = 'production';
    configServiceMock.get.mockReturnValue('');

    expect(() => {
      new TwilioSmsService(configServiceMock as unknown as ConfigService);
    }).toThrow('FATAL: Twilio SMS provider cannot start in production without valid credentials.');
  });

  it('should not throw on construction in non-production even if credentials missing', () => {
    process.env.NODE_ENV = 'development';
    configServiceMock.get.mockReturnValue('');

    service = new TwilioSmsService(configServiceMock as unknown as ConfigService);
    expect(service.getIsConfigured()).toBe(false);
  });

  it('should throw InternalServerErrorException if sendOtp is called when unconfigured', async () => {
    process.env.NODE_ENV = 'development';
    configServiceMock.get.mockReturnValue('');
    service = new TwilioSmsService(configServiceMock as unknown as ConfigService);

    await expect(service.sendOtp('+14155552671', '123456')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should successfully send OTP via Twilio REST API', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'TWILIO_ACCOUNT_SID') return 'AC_VALID_SID';
      if (key === 'TWILIO_AUTH_TOKEN') return 'SECRET_AUTH_TOKEN';
      if (key === 'TWILIO_FROM_PHONE') return '+15550001111';
      return null;
    });

    service = new TwilioSmsService(configServiceMock as unknown as ConfigService);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({ sid: 'SM_MESSAGE_ID' }),
    });
    globalThis.fetch = mockFetch;

    await expect(service.sendOtp('+14155552671', '654321')).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];

    expect(calledUrl).toContain('AC_VALID_SID/Messages.json');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers.Authorization).toContain('Basic ');
    expect(calledInit.body).toContain('To=%2B14155552671');
    expect(calledInit.body).toContain('From=%2B15550001111');
    expect(calledInit.body).toContain('Body=Your+FoodiGo+verification+code+is%3A+654321');
  });

  it('should map Twilio 400 response to BadRequestException', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'TWILIO_ACCOUNT_SID') return 'AC_VALID_SID';
      if (key === 'TWILIO_AUTH_TOKEN') return 'SECRET_AUTH_TOKEN';
      if (key === 'TWILIO_FROM_PHONE') return '+15550001111';
      return null;
    });

    service = new TwilioSmsService(configServiceMock as unknown as ConfigService);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        code: 21211,
        message: 'Invalid phone number format',
      }),
    });

    await expect(service.sendOtp('+1000', '123456')).rejects.toThrow(BadRequestException);
  });

  it('should map Twilio 500 server error to InternalServerErrorException', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'TWILIO_ACCOUNT_SID') return 'AC_VALID_SID';
      if (key === 'TWILIO_AUTH_TOKEN') return 'SECRET_AUTH_TOKEN';
      if (key === 'TWILIO_FROM_PHONE') return '+15550001111';
      return null;
    });

    service = new TwilioSmsService(configServiceMock as unknown as ConfigService);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        message: 'Internal server error at Twilio',
      }),
    });

    await expect(service.sendOtp('+14155552671', '123456')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should map request abort/timeout to InternalServerErrorException', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'TWILIO_ACCOUNT_SID') return 'AC_VALID_SID';
      if (key === 'TWILIO_AUTH_TOKEN') return 'SECRET_AUTH_TOKEN';
      if (key === 'TWILIO_FROM_PHONE') return '+15550001111';
      return null;
    });

    service = new TwilioSmsService(configServiceMock as unknown as ConfigService);

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(service.sendOtp('+14155552671', '123456')).rejects.toThrow(
      'SMS delivery provider timed out. Please try again.',
    );
  });
});

describe('DevSmsService production safeguard', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('throws on construction if NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new DevSmsService()).toThrow(
      'FATAL: DevSmsService cannot be instantiated in production environment.',
    );
  });

  it('allows construction and masks phone in development', async () => {
    process.env.NODE_ENV = 'development';
    const devService = new DevSmsService();
    await expect(devService.sendOtp('+14155552671', '123456')).resolves.toBeUndefined();
  });
});
