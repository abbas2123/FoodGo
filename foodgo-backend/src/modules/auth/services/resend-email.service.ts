import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from '../interfaces/email-provider.interface.js';
import { EmailUtil } from '../../../common/utils/email.util.js';

@Injectable()
export class ResendEmailService implements IEmailProvider {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('RESEND_API_KEY') ||
      process.env.RESEND_API_KEY ||
      '';
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      process.env.EMAIL_FROM ||
      'FoodiGo <onboarding@resend.dev>';

    this.isConfigured = Boolean(this.apiKey && this.fromAddress);

    if (process.env.NODE_ENV === 'production' && !this.isConfigured) {
      this.logger.error(
        'FATAL: Resend credentials are missing in production. RESEND_API_KEY and EMAIL_FROM must be configured.',
      );
      throw new Error(
        'FATAL: Resend email provider cannot start in production without valid credentials.',
      );
    }
  }

  getIsConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Dispatches an OTP verification code via Resend REST API (https://api.resend.com/emails).
   * Safe in production: never logs raw OTP, secrets, or internal stack traces.
   */
  async sendOtp(email: string, otp: string): Promise<void> {
    const maskedEmail = EmailUtil.mask(email);

    if (!this.isConfigured) {
      this.logger.error(
        `Cannot send email OTP to ${maskedEmail}: Resend credentials are not configured.`,
      );
      throw new InternalServerErrorException(
        'Email service is temporarily unavailable. Please try again later.',
      );
    }

    const payload = {
      from: this.fromAddress,
      to: [email],
      subject: 'Your FoodiGo Verification Code',
      text: `Your FoodiGo verification code is: ${otp}. It expires in 5 minutes. If you did not request this code, please ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; borderRadius: 8px;">
          <h2 style="color: #E23744; margin-top: 0;">FoodiGo Verification Code</h2>
          <p style="color: #333; font-size: 16px;">Use the verification code below to complete your login or registration:</p>
          <div style="background-color: #F8F9FA; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px; margin-bottom: 0;">If you did not request this verification code, please disregard this email.</p>
        </div>
      `,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          // Non-JSON response
        }

        const errorMessage = errorData?.message || response.statusText;
        this.logger.error(
          `Resend API error for ${maskedEmail} [Status ${response.status}]: ${errorMessage}`,
        );

        if (response.status === 400 || response.status === 422) {
          throw new BadRequestException(
            'Unable to send verification email. Please check your email address and try again.',
          );
        }

        throw new InternalServerErrorException(
          'Email service provider encountered an error. Please try again later.',
        );
      }

      this.logger.log(`Email OTP successfully dispatched to ${maskedEmail}`);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }

      if (error.name === 'AbortError') {
        this.logger.error(`Resend request timed out after 10s for ${maskedEmail}`);
        throw new InternalServerErrorException(
          'Email delivery timed out. Please try again.',
        );
      }

      this.logger.error(
        `Failed to deliver email via Resend to ${maskedEmail}: ${error?.message}`,
      );
      throw new InternalServerErrorException(
        'Unable to send verification email. Please try again later.',
      );
    }
  }
}
