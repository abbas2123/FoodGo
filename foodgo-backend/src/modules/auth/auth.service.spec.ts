import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { OtpService } from './services/otp.service.js';
import { TokenService } from './services/token.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SMS_PROVIDER } from './interfaces/sms-provider.interface.js';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface.js';
import { UserStatus, UserType } from '../../generated/prisma/client.js';

describe('AuthService', () => {
  let service: AuthService;
  let otpServiceMock: {
    createOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    createEmailOtp: ReturnType<typeof vi.fn>;
    verifyEmailOtp: ReturnType<typeof vi.fn>;
  };
  let tokenServiceMock: {
    generateTokens: ReturnType<typeof vi.fn>;
    saveRefreshToken: ReturnType<typeof vi.fn>;
    rotateRefreshToken: ReturnType<typeof vi.fn>;
    revokeRefreshToken: ReturnType<typeof vi.fn>;
  };
  let prismaMock: {
    userAuth: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let smsProviderMock: {
    sendOtp: ReturnType<typeof vi.fn>;
  };
  let emailProviderMock: {
    sendOtp: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    otpServiceMock = {
      createOtp: vi.fn(),
      verifyOtp: vi.fn(),
      createEmailOtp: vi.fn(),
      verifyEmailOtp: vi.fn(),
    };

    tokenServiceMock = {
      generateTokens: vi.fn(),
      saveRefreshToken: vi.fn(),
      rotateRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
    };

    prismaMock = {
      userAuth: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    smsProviderMock = {
      sendOtp: vi.fn(),
    };

    emailProviderMock = {
      sendOtp: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OtpService, useValue: otpServiceMock },
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: SMS_PROVIDER, useValue: smsProviderMock },
        { provide: EMAIL_PROVIDER, useValue: emailProviderMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmailOtp', () => {
    it('normalizes email, generates OTP, and dispatches via email provider', async () => {
      otpServiceMock.createEmailOtp.mockResolvedValue('654321');
      emailProviderMock.sendOtp.mockResolvedValue(undefined);

      const result = await service.sendEmailOtp('  User@Example.COM  ');

      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(otpServiceMock.createEmailOtp).toHaveBeenCalledWith('user@example.com', 'LOGIN');
      expect(emailProviderMock.sendOtp).toHaveBeenCalledWith('user@example.com', '654321');
    });

    it('rejects invalid email address with BadRequestException', async () => {
      await expect(service.sendEmailOtp('invalid-email-address')).rejects.toThrow(
        BadRequestException,
      );
      expect(otpServiceMock.createEmailOtp).not.toHaveBeenCalled();
      expect(emailProviderMock.sendOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailOtp', () => {
    it('verifies email OTP and provisions new user account with normalized email', async () => {
      otpServiceMock.verifyEmailOtp.mockResolvedValue(true);
      prismaMock.user.findUnique.mockResolvedValue(null);

      const mockNewUser = {
        id: 10n,
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        email: 'newuser@example.com',
        name: null,
      };

      prismaMock.$transaction.mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback({
            user: { create: vi.fn().mockResolvedValue(mockNewUser) },
            userAuth: { create: vi.fn().mockResolvedValue({ id: 100n }) },
          });
        }
        return [];
      });

      tokenServiceMock.generateTokens.mockResolvedValue({
        accessToken: 'access-token-10',
        refreshToken: 'refresh-token-10',
      });
      tokenServiceMock.saveRefreshToken.mockResolvedValue(undefined);

      const response = await service.verifyEmailOtp('NewUser@Example.COM', '654321');

      expect(response.message).toBe('Authentication successful');
      expect(response.user.id).toBe('10');
      expect(response.user.email).toBe('newuser@example.com');
      expect(response.tokens.accessToken).toBe('access-token-10');
      expect(tokenServiceMock.saveRefreshToken).toHaveBeenCalledWith(10n, 'refresh-token-10');
    });

    it('verifies email OTP and logs in existing user account', async () => {
      otpServiceMock.verifyEmailOtp.mockResolvedValue(true);

      const existingUser = {
        id: 25n,
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        auth: { phone: '+14155551234' },
      };

      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.$transaction.mockResolvedValue([]);

      tokenServiceMock.generateTokens.mockResolvedValue({
        accessToken: 'access-token-sarah',
        refreshToken: 'refresh-token-sarah',
      });
      tokenServiceMock.saveRefreshToken.mockResolvedValue(undefined);

      const response = await service.verifyEmailOtp('sarah@example.com', '654321');

      expect(response.message).toBe('Authentication successful');
      expect(response.user.id).toBe('25');
      expect(response.user.name).toBe('Sarah Connor');
      expect(response.user.email).toBe('sarah@example.com');
      expect(response.user.phone).toBe('+14155551234');
    });

    it('rejects authentication if user account is suspended', async () => {
      otpServiceMock.verifyEmailOtp.mockResolvedValue(true);

      const suspendedUser = {
        id: 30n,
        name: 'Bad Actor',
        email: 'bad@example.com',
        type: UserType.CUSTOMER,
        status: UserStatus.SUSPENDED,
      };

      prismaMock.user.findUnique.mockResolvedValue(suspendedUser);

      await expect(service.verifyEmailOtp('bad@example.com', '654321')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('sendOtp (legacy phone)', () => {
    it('should create OTP and dispatch via SMS provider', async () => {
      otpServiceMock.createOtp.mockResolvedValue('123456');
      smsProviderMock.sendOtp.mockResolvedValue(undefined);

      const result = await service.sendOtp('+14155552671');

      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(otpServiceMock.createOtp).toHaveBeenCalledWith('+14155552671', 'LOGIN');
      expect(smsProviderMock.sendOtp).toHaveBeenCalledWith('+14155552671', '123456');
    });
  });

  describe('verifyOtp (legacy phone)', () => {
    it('should verify OTP and authenticate existing user', async () => {
      otpServiceMock.verifyOtp.mockResolvedValue(true);

      const existingAuth = {
        phone: '+14155552671',
        user: {
          id: 5n,
          name: 'Jane Doe',
          type: UserType.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
      };

      prismaMock.userAuth.findUnique.mockResolvedValue(existingAuth);
      prismaMock.$transaction.mockResolvedValue([]);

      tokenServiceMock.generateTokens.mockResolvedValue({
        accessToken: 'access-token-existing',
        refreshToken: 'refresh-token-existing',
      });
      tokenServiceMock.saveRefreshToken.mockResolvedValue(undefined);

      const response = await service.verifyOtp('+14155552671', '123456');

      expect(response.message).toBe('Authentication successful');
      expect(response.tokens.accessToken).toBe('access-token-existing');
      expect(response.user.id).toBe('5');
      expect(response.user.name).toBe('Jane Doe');
    });
  });

  describe('refreshToken', () => {
    it('should rotate tokens and return new credentials', async () => {
      tokenServiceMock.rotateRefreshToken.mockResolvedValue({
        tokens: { accessToken: 'new-acc', refreshToken: 'new-ref' },
        user: { id: '1', email: 'user@example.com', phone: '+14155552671', type: 'CUSTOMER', status: 'ACTIVE' },
      });

      const response = await service.refreshToken('old-refresh-token');

      expect(response.message).toBe('Tokens refreshed successfully');
      expect(response.tokens.accessToken).toBe('new-acc');
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      tokenServiceMock.revokeRefreshToken.mockResolvedValue(undefined);

      const response = await service.logout('refresh-token-to-revoke');

      expect(response).toEqual({ message: 'Logged out successfully' });
      expect(tokenServiceMock.revokeRefreshToken).toHaveBeenCalledWith(
        'refresh-token-to-revoke',
      );
    });
  });
});
