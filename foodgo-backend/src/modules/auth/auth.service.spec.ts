import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { OtpService } from './services/otp.service.js';
import { TokenService } from './services/token.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SMS_PROVIDER } from './interfaces/sms-provider.interface.js';
import { UserStatus, UserType } from '../../generated/prisma/client.js';

describe('AuthService', () => {
  let service: AuthService;
  let otpServiceMock: {
    createOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
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
    };
    user: {
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let smsProviderMock: {
    sendOtp: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    otpServiceMock = {
      createOtp: vi.fn(),
      verifyOtp: vi.fn(),
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
      },
      user: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    smsProviderMock = {
      sendOtp: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OtpService, useValue: otpServiceMock },
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: SMS_PROVIDER, useValue: smsProviderMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOtp', () => {
    it('should create OTP and dispatch via SMS provider', async () => {
      otpServiceMock.createOtp.mockResolvedValue('123456');
      smsProviderMock.sendOtp.mockResolvedValue(undefined);

      const result = await service.sendOtp('+14155552671');

      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(otpServiceMock.createOtp).toHaveBeenCalledWith('+14155552671', 'LOGIN');
      expect(smsProviderMock.sendOtp).toHaveBeenCalledWith('+14155552671', '123456');
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and provision a new user if not exists', async () => {
      otpServiceMock.verifyOtp.mockResolvedValue(true);
      prismaMock.userAuth.findUnique.mockResolvedValue(null);

      const mockNewUser = {
        id: 1n,
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        name: null,
      };

      prismaMock.$transaction.mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback({
            user: { create: vi.fn().mockResolvedValue(mockNewUser) },
            userAuth: { create: vi.fn().mockResolvedValue({ id: 1n }) },
          });
        }
        return [];
      });

      tokenServiceMock.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      tokenServiceMock.saveRefreshToken.mockResolvedValue(undefined);

      const response = await service.verifyOtp('+14155552671', '123456');

      expect(response.message).toBe('Authentication successful');
      expect(response.tokens.accessToken).toBe('access-token');
      expect(response.user.id).toBe('1');
      expect(response.user.phone).toBe('+14155552671');
    });

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
        user: { id: '1', phone: '+14155552671', type: 'CUSTOMER', status: 'ACTIVE' },
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
