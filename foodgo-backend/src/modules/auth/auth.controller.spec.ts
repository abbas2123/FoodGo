import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: {
    sendOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    sendEmailOtp: ReturnType<typeof vi.fn>;
    verifyEmailOtp: ReturnType<typeof vi.fn>;
    refreshToken: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authServiceMock = {
      sendOtp: vi.fn(),
      verifyOtp: vi.fn(),
      sendEmailOtp: vi.fn(),
      verifyEmailOtp: vi.fn(),
      refreshToken: vi.fn(),
      logout: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('email OTP endpoints', () => {
    it('should delegate sendEmailOtp to AuthService', async () => {
      authServiceMock.sendEmailOtp.mockResolvedValue({
        message: 'OTP sent successfully',
      });

      const result = await controller.sendEmailOtp({ email: 'user@example.com' });

      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(authServiceMock.sendEmailOtp).toHaveBeenCalledWith('user@example.com');
    });

    it('should delegate verifyEmailOtp to AuthService', async () => {
      const mockAuthResponse = {
        message: 'Authentication successful',
        user: {
          id: '1',
          email: 'user@example.com',
          phone: null,
          name: 'Alice',
          type: 'CUSTOMER',
          status: 'ACTIVE',
        },
        tokens: { accessToken: 'acc', refreshToken: 'ref' },
      };
      authServiceMock.verifyEmailOtp.mockResolvedValue(mockAuthResponse);

      const result = await controller.verifyEmailOtp({
        email: 'user@example.com',
        otp: '123456',
      });

      expect(result).toEqual(mockAuthResponse);
      expect(authServiceMock.verifyEmailOtp).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
      );
    });
  });

  describe('legacy phone OTP endpoints', () => {
    it('should delegate sendOtp to AuthService', async () => {
      authServiceMock.sendOtp.mockResolvedValue({
        message: 'OTP sent successfully',
      });

      const result = await controller.sendOtp({ phone: '+14155552671' });

      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(authServiceMock.sendOtp).toHaveBeenCalledWith('+14155552671');
    });

    it('should delegate verifyOtp to AuthService', async () => {
      const mockAuthResponse = {
        message: 'Authentication successful',
        user: {
          id: '1',
          phone: '+14155552671',
          name: null,
          type: 'CUSTOMER',
          status: 'ACTIVE',
        },
        tokens: { accessToken: 'acc', refreshToken: 'ref' },
      };
      authServiceMock.verifyOtp.mockResolvedValue(mockAuthResponse);

      const result = await controller.verifyOtp({
        phone: '+14155552671',
        otp: '123456',
      });

      expect(result).toEqual(mockAuthResponse);
      expect(authServiceMock.verifyOtp).toHaveBeenCalledWith(
        '+14155552671',
        '123456',
      );
    });
  });

  describe('token refresh & logout', () => {
    it('should delegate refreshToken to AuthService', async () => {
      const mockRefreshResponse = {
        message: 'Tokens refreshed successfully',
        user: {
          id: '1',
          phone: '+14155552671',
          type: 'CUSTOMER',
          status: 'ACTIVE',
        },
        tokens: { accessToken: 'new-acc', refreshToken: 'new-ref' },
      };
      authServiceMock.refreshToken.mockResolvedValue(mockRefreshResponse);

      const result = await controller.refreshToken({ refreshToken: 'ref-token' });

      expect(result).toEqual(mockRefreshResponse);
      expect(authServiceMock.refreshToken).toHaveBeenCalledWith('ref-token');
    });

    it('should delegate logout to AuthService', async () => {
      authServiceMock.logout.mockResolvedValue({
        message: 'Logged out successfully',
      });

      const result = await controller.logout({ refreshToken: 'ref-token' });

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authServiceMock.logout).toHaveBeenCalledWith('ref-token');
    });
  });
});
