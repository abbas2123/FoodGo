import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './services/otp.service.js';
import { TokenService } from './services/token.service.js';
import { DevSmsService } from './services/dev-sms.service.js';
import { TwilioSmsService } from './services/twilio-sms.service.js';
import { SMS_PROVIDER } from './interfaces/sms-provider.interface.js';
import { DevEmailService } from './services/dev-email.service.js';
import { ResendEmailService } from './services/resend-email.service.js';
import { SmtpEmailService } from './services/smtp-email.service.js';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface.js';

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
    TwilioSmsService,
    DevEmailService,
    ResendEmailService,
    SmtpEmailService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const isProduction = process.env.NODE_ENV === 'production';
        const configuredProvider = (
          configService.get<string>('EMAIL_PROVIDER') ||
          process.env.EMAIL_PROVIDER ||
          (isProduction ? 'resend' : 'dev')
        ).toLowerCase();

        if (isProduction) {
          if (configuredProvider === 'resend') {
            return new ResendEmailService(configService);
          }
          if (configuredProvider === 'smtp') {
            return new SmtpEmailService(configService);
          }
          throw new Error(
            `FATAL: EMAIL_PROVIDER must be 'resend' or 'smtp' in production. Cannot use '${configuredProvider}'.`,
          );
        }

        if (configuredProvider === 'resend') {
          return new ResendEmailService(configService);
        }

        if (configuredProvider === 'smtp') {
          return new SmtpEmailService(configService);
        }

        return new DevEmailService();
      },
      inject: [ConfigService],
    },
    {
      provide: SMS_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const isProduction = process.env.NODE_ENV === 'production';
        const authProvider = (
          configService.get<string>('AUTH_PROVIDER') ||
          process.env.AUTH_PROVIDER ||
          'email'
        ).toLowerCase();

        const configuredProvider = (
          configService.get<string>('SMS_PROVIDER') ||
          process.env.SMS_PROVIDER ||
          (isProduction && authProvider === 'sms' ? 'twilio' : 'dev')
        ).toLowerCase();

        if (isProduction) {
          if (authProvider === 'sms' && configuredProvider !== 'twilio') {
            throw new Error(
              `FATAL: SMS_PROVIDER must be 'twilio' in production when AUTH_PROVIDER is sms. Cannot use '${configuredProvider}'.`,
            );
          }
          if (configuredProvider === 'twilio') {
            return new TwilioSmsService(configService);
          }
          return null;
        }

        if (configuredProvider === 'twilio') {
          return new TwilioSmsService(configService);
        }

        return new DevSmsService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService, OtpService, TokenService, JwtModule, EMAIL_PROVIDER, SMS_PROVIDER, SmtpEmailService],
})
export class AuthModule {}
