import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { UserStatus, UserType } from '../../../generated/prisma/client.js';

describe('TokenService', () => {
  let service: TokenService;
  let jwtServiceMock: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let prismaMock: {
    refreshToken: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let configServiceMock: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    jwtServiceMock = {
      signAsync: vi.fn(),
      verifyAsync: vi.fn(),
    };

    prismaMock = {
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'jwt.accessSecret') return 'test-access-secret';
        if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
        if (key === 'jwt.accessExpiresIn') return '15m';
        if (key === 'jwt.refreshExpiresIn') return '7d';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      jwtServiceMock.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');

      const tokens = await service.generateTokens({
        sub: '1',
        phone: '+14155552671',
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      });

      expect(tokens).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
      expect(jwtServiceMock.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('saveRefreshToken', () => {
    it('should hash the refresh token and save to database', async () => {
      prismaMock.refreshToken.create.mockResolvedValue({ id: 1n });

      await service.saveRefreshToken(1n, 'raw-token');

      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1n,
            tokenHash: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('should throw UnauthorizedException if JWT is invalid', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.rotateRefreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate token successfully when valid', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: '1',
        phone: '+14155552671',
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      });

      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 10n,
        userId: 1n,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 1n,
          type: UserType.CUSTOMER,
          status: UserStatus.ACTIVE,
          auth: { phone: '+14155552671' },
        },
      });

      jwtServiceMock.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      prismaMock.$transaction.mockResolvedValue([]);

      const result = await service.rotateRefreshToken('valid-refresh-token');

      expect(result.tokens.accessToken).toBe('new-access-token');
      expect(result.tokens.refreshToken).toBe('new-refresh-token');
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
