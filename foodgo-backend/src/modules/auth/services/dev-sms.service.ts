import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider } from '../interfaces/sms-provider.interface.js';
import { PhoneUtil } from '../../../common/utils/phone.util.js';

@Injectable()
export class DevSmsService implements ISmsProvider {
  private readonly logger = new Logger(DevSmsService.name);

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: DevSmsService cannot be instantiated in production environment.',
      );
    }
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: DevSmsService cannot be used in production environment.',
      );
    }
    const maskedPhone = PhoneUtil.mask(phone);
    this.logger.log(`[DEV OTP] For ${phone} (${maskedPhone}): ${otp}`);
  }
}
