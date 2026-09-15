import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { AuthTokens } from '../interfaces/tokens.interface.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessSecret =
      this.configService.get<string>('jwt.accessSecret') ||
      this.configService.get<string>('JWT_ACCESS_SECRET');
    const accessExpiresIn =
      this.configService.get<string>('jwt.accessExpiresIn') ||
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ||
      '15m';

    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ||
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ||
      '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async saveRefreshToken(userId: bigint, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async rotateRefreshToken(rawRefreshToken: string): Promise<{
    tokens: AuthTokens;
    user: { id: string; phone: string; type: string; status: string };
  }> {
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      this.configService.get<string>('JWT_REFRESH_SECRET');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(rawRefreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { auth: true } } },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token has been revoked or is invalid');
    }

    if (storedToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token reuse detected. Please log in again.');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = storedToken.user;
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or suspended');
    }

    const newPayload: JwtPayload = {
      sub: user.id.toString(),
      phone: user.auth?.phone ?? payload.phone,
      type: user.type,
      status: user.status,
    };

    const newTokens = await this.generateTokens(newPayload);
    const newTokenHash = this.hashToken(newTokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt,
        },
      }),
    ]);

    return {
      tokens: newTokens,
      user: {
        id: user.id.toString(),
        phone: user.auth?.phone ?? payload.phone,
        type: user.type,
        status: user.status,
      },
    };
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
