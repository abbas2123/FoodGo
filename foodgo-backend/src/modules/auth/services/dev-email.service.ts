import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider } from '../interfaces/email-provider.interface.js';
import { EmailUtil } from '../../../common/utils/email.util.js';

@Injectable()
export class DevEmailService implements IEmailProvider {
  private readonly logger = new Logger(DevEmailService.name);

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: DevEmailService cannot be instantiated in production. Configure a production email provider such as Resend.',
      );
    }
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    const maskedEmail = EmailUtil.mask(email);
    // Development-only logger for local developer convenience
    this.logger.log(`[DEV EMAIL OTP] For ${email} (${maskedEmail}): ${otp}`);
  }
}
