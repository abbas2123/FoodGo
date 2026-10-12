import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { UserStatus } from '../../generated/prisma/client.js';

const makeContext = (authHeader?: string) => {
  const mockRequest: any = {
    headers: {
      authorization: authHeader,
    },
  };
  return {
    switchToHttp: () => ({ getRequest: () => mockRequest }),
    getHandler: () => ({}),
    getClass: () => ({}),
    _request: mockRequest,
  } as unknown as ExecutionContext;
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtServiceMock: any;
  let reflectorMock: any;
  let configServiceMock: any;
  let prismaMock: any;

  beforeEach(() => {
    jwtServiceMock = { verifyAsync: vi.fn() };
    reflectorMock = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    configServiceMock = { get: vi.fn().mockReturnValue('test_secret_of_at_least_32_chars_xxxx') };
    prismaMock = { user: { findUnique: vi.fn() } };

    guard = new JwtAuthGuard(jwtServiceMock, reflectorMock, configServiceMock, prismaMock);
  });

  describe('public routes', () => {
    it('allows public routes without a token', async () => {
      reflectorMock.getAllAndOverride.mockReturnValue(true);
      const result = await guard.canActivate(makeContext(undefined));
      expect(result).toBe(true);
      expect(jwtServiceMock.verifyAsync).not.toHaveBeenCalled();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('missing / invalid token', () => {
    it('rejects a request with no Authorization header', async () => {
      await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the Authorization scheme is not Bearer', async () => {
      await expect(guard.canActivate(makeContext('Basic sometoken'))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an invalid or expired JWT', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      await expect(guard.canActivate(makeContext('Bearer bad.token'))).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Task 4 — deleted / suspended account checks', () => {
    const validPayload = { sub: '42', phone: '+911234567890', type: 'CUSTOMER', status: 'ACTIVE' };

    it('rejects a DELETED account even when the JWT is cryptographically valid', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue(validPayload);
      prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.DELETED });
      const err = await guard.canActivate(makeContext('Bearer valid.token')).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toMatch(/deleted/i);
    });

    it('rejects a SUSPENDED account even when the JWT is cryptographically valid', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue(validPayload);
      prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.SUSPENDED });
      const err = await guard.canActivate(makeContext('Bearer valid.token')).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toMatch(/suspended/i);
    });

    it('rejects when the user row does not exist (null result)', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue(validPayload);
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(guard.canActivate(makeContext('Bearer valid.token'))).rejects.toThrow(UnauthorizedException);
    });

    it('allows an ACTIVE user and attaches payload to request', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue(validPayload);
      prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
      const ctx = makeContext('Bearer valid.token');
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect((ctx as any)._request.user).toEqual(validPayload);
    });

    it('fails closed (rejects) when the DB is momentarily unreachable', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue(validPayload);
      prismaMock.user.findUnique.mockRejectedValue(new Error('Connection refused'));
      await expect(guard.canActivate(makeContext('Bearer valid.token'))).rejects.toThrow(UnauthorizedException);
    });

    it('queries only status via the primary key — minimal DB footprint', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue(validPayload);
      prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
      await guard.canActivate(makeContext('Bearer valid.token'));
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(validPayload.sub) },
        select: { status: true },
      });
    });
  });
});
