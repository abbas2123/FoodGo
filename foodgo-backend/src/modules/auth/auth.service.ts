import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PhoneUtil } from '../../common/utils/phone.util.js';
import { OtpService } from './services/otp.service.js';
import { TokenService } from './services/token.service.js';
import { SMS_PROVIDER } from './interfaces/sms-provider.interface.js';
import type { ISmsProvider } from './interfaces/sms-provider.interface.js';
import { AuthResponse } from './interfaces/tokens.interface.js';
import { UserStatus, UserType } from '../../generated/prisma/client.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: ISmsProvider,
  ) {}

  async sendOtp(phone: string): Promise<{ message: string }> {
    const normalizedPhone = PhoneUtil.normalize(phone);
    const otp = await this.otpService.createOtp(normalizedPhone, 'LOGIN');
    await this.smsProvider.sendOtp(normalizedPhone, otp);

    return {
      message: 'OTP sent successfully',
    };
  }

  async verifyOtp(phone: string, otp: string): Promise<AuthResponse> {
    const normalizedPhone = PhoneUtil.normalize(phone);

    await this.otpService.verifyOtp(normalizedPhone, otp, 'LOGIN');

    const existingAuth = await this.prisma.userAuth.findUnique({
      where: { phone: normalizedPhone },
      include: { user: true },
    });

    let user: {
      id: bigint;
      type: UserType;
      name: string | null;
      status: UserStatus;
    };

    if (!existingAuth) {
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            type: UserType.CUSTOMER,
            status: UserStatus.ACTIVE,
            lastLoginAt: new Date(),
          },
        });

        await tx.userAuth.create({
          data: {
            userId: newUser.id,
            phone: normalizedPhone,
            phoneVerified: true,
          },
        });

        return newUser;
      });
      this.logger.log(`New user created: ID ${user.id} with phone ${PhoneUtil.mask(normalizedPhone)}`);
    } else {
      user = existingAuth.user;

      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User account is inactive or suspended');
      }

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
        this.prisma.userAuth.update({
          where: { phone: normalizedPhone },
          data: { phoneVerified: true },
        }),
      ]);
    }

    const tokens = await this.tokenService.generateTokens({
      sub: user.id.toString(),
      phone: normalizedPhone,
      type: user.type,
      status: user.status,
    });

    await this.tokenService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Authentication successful',
      user: {
        id: user.id.toString(),
        phone: normalizedPhone,
        name: user.name,
        type: user.type,
        status: user.status,
      },
      tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    const result = await this.tokenService.rotateRefreshToken(refreshToken);
    return {
      message: 'Tokens refreshed successfully',
      ...result,
    };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokenService.revokeRefreshToken(refreshToken);
    return {
      message: 'Logged out successfully',
    };
  }
}
