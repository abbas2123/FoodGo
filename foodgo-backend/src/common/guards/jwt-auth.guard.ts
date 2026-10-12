import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus } from '../../generated/prisma/client.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    let payload: { sub: string; phone: string; type: string; status: string };
    try {
      const secret =
        this.configService.get<string>('jwt.accessSecret') ||
        this.configService.get<string>('JWT_ACCESS_SECRET');

      payload = await this.jwtService.verifyAsync(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    // ── Task 4: Deleted-account access guard ─────────────────────────────────
    // A JWT remains cryptographically valid until its exp claim elapses
    // (15 min by default). After account deletion the refresh tokens are
    // revoked, but an existing access token could still be used for up to
    // 15 minutes. This single indexed PK lookup prevents that window.
    //
    // We only execute this query when the JWT carries a sub (user ID). The
    // query is on the primary key — a single B-tree lookup, sub-millisecond
    // under normal load.
    if (payload.sub) {
      let userStatus: UserStatus | null = null;
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: BigInt(payload.sub) },
          select: { status: true },
        });
        userStatus = user?.status ?? null;
      } catch {
        // If the DB is momentarily unreachable we fail-closed (deny access)
        // rather than allowing a potentially deleted account through.
        throw new UnauthorizedException('Authentication could not be verified. Please try again.');
      }

      if (!userStatus || userStatus === UserStatus.DELETED) {
        throw new UnauthorizedException('This account has been deleted and can no longer be used.');
      }

      if (userStatus === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('This account has been suspended. Please contact support.');
      }
    }

    (request as unknown as { user: unknown }).user = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
