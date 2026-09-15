import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './services/otp.service.js';
import { TokenService } from './services/token.service.js';
import { DevSmsService } from './services/dev-sms.service.js';
import { SMS_PROVIDER } from './interfaces/sms-provider.interface.js';

@Module({
  imports: [
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    DevSmsService,
    {
      provide: SMS_PROVIDER,
      useClass: DevSmsService,
    },
  ],
  exports: [AuthService, OtpService, TokenService, JwtModule],
})
export class AuthModule {}
