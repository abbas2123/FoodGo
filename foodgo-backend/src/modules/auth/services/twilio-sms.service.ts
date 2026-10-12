import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../interfaces/sms-provider.interface.js';
import { PhoneUtil } from '../../../common/utils/phone.util.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromPhone: string;
}

@Injectable()
export class TwilioSmsService implements ISmsProvider {
  private readonly logger = new Logger(TwilioSmsService.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromPhone: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.accountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID') ||
      process.env.TWILIO_ACCOUNT_SID ||
      '';
    this.authToken =
      this.configService.get<string>('TWILIO_AUTH_TOKEN') ||
      process.env.TWILIO_AUTH_TOKEN ||
      '';
    this.fromPhone =
      this.configService.get<string>('TWILIO_FROM_PHONE') ||
      process.env.TWILIO_FROM_PHONE ||
      '';

    this.isConfigured = Boolean(
      this.accountSid && this.authToken && this.fromPhone,
    );

    if (process.env.NODE_ENV === 'production' && !this.isConfigured) {
      this.logger.error(
        'FATAL: Twilio credentials are missing in production. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE must be set.',
      );
      throw new Error(
        'FATAL: Twilio SMS provider cannot start in production without valid credentials.',
      );
    }
  }

  getIsConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Sends OTP via Twilio Programmable Messaging REST API.
   * Never logs raw OTP or credentials.
   */
  async sendOtp(phone: string, otp: string): Promise<void> {
    const maskedPhone = PhoneUtil.mask(phone);

    if (!this.isConfigured) {
      this.logger.error(
        `Cannot send SMS to ${maskedPhone}: Twilio credentials are not configured.`,
      );
      throw new InternalServerErrorException(
        'SMS delivery service is not configured. Please contact support.',
      );
    }

    const messageBody = `Your FoodiGo verification code is: ${otp}. It expires in 5 minutes. Do not share this code with anyone.`;
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`;

    const authHeader = Buffer.from(
      `${this.accountSid}:${this.authToken}`,
    ).toString('base64');

    const params = new URLSearchParams();
    params.append('To', phone);
    params.append('From', this.fromPhone);
    params.append('Body', messageBody);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        let twilioError: any = null;
        try {
          twilioError = await response.json();
        } catch {
          twilioError = { message: response.statusText };
        }

        const errorCode = twilioError?.code;
        const errorMessage = twilioError?.message || 'Twilio delivery failure';

        this.logger.error(
          `Twilio SMS dispatch failed for ${maskedPhone} [Status ${response.status}, Code ${errorCode || 'N/A'}]: ${errorMessage}`,
        );

        if (response.status === 400) {
          throw new BadRequestException(
            'Unable to send SMS to the provided phone number. Please verify the phone number format.',
          );
        }

        throw new InternalServerErrorException(
          'Failed to deliver SMS verification code. Please try again later.',
        );
      }

      this.logger.log(`SMS OTP successfully dispatched to ${maskedPhone}`);
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
        throw err;
      }

      if (err.name === 'AbortError') {
        this.logger.error(`Twilio request timed out after 10s for ${maskedPhone}`);
        throw new InternalServerErrorException(
          'SMS delivery provider timed out. Please try again.',
        );
      }

      this.logger.error(
        `Network error during Twilio SMS dispatch for ${maskedPhone}: ${err.message}`,
      );
      throw new InternalServerErrorException(
        'SMS gateway communication error. Please try again later.',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
