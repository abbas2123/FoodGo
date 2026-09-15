import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider } from '../interfaces/sms-provider.interface.js';
import { PhoneUtil } from '../../../common/utils/phone.util.js';

@Injectable()
export class DevSmsService implements ISmsProvider {
  private readonly logger = new Logger(DevSmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    const maskedPhone = PhoneUtil.mask(phone);
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV OTP] For ${phone} (${maskedPhone}): ${otp}`);
    } else {
      this.logger.log(`[SMS DISPATCHED] OTP sent to ${maskedPhone}`);
    }
  }
}
