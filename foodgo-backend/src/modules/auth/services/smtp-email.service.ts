import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { IEmailProvider } from '../interfaces/email-provider.interface.js';
import { EmailUtil } from '../../../common/utils/email.util.js';

@Injectable()
export class SmtpEmailService implements IEmailProvider {
  private readonly logger = new Logger(SmtpEmailService.name);
  private transporter: Transporter;
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user: string;
  private readonly pass: string;
  private readonly fromAddress: string;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject('CUSTOM_SMTP_TRANSPORTER')
    customTransporter?: Transporter,
  ) {
    this.host =
      this.configService.get<string>('SMTP_HOST') ||
      process.env.SMTP_HOST ||
      'smtp.gmail.com';

    const portVal =
      this.configService.get<string | number>('SMTP_PORT') ??
      process.env.SMTP_PORT ??
      587;
    this.port = typeof portVal === 'number' ? portVal : parseInt(String(portVal), 10) || 587;

    const secureVal =
      this.configService.get<string | boolean>('SMTP_SECURE') ??
      process.env.SMTP_SECURE ??
      false;
    this.secure = secureVal === true || secureVal === 'true';

    this.user =
      this.configService.get<string>('SMTP_USER') ||
      process.env.SMTP_USER ||
      '';

    this.pass =
      this.configService.get<string>('SMTP_PASS') ||
      process.env.SMTP_PASS ||
      '';

    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      process.env.EMAIL_FROM ||
      (this.user ? `FoodiGo <${this.user}>` : '');

    this.isConfigured = Boolean(
      this.host &&
      this.port &&
      this.user &&
      this.pass &&
      this.fromAddress,
    );

    const emailProvider = (
      this.configService.get<string>('EMAIL_PROVIDER') ||
      process.env.EMAIL_PROVIDER ||
      (process.env.NODE_ENV === 'production' ? 'resend' : 'dev')
    ).toLowerCase();

    if (process.env.NODE_ENV === 'production' && emailProvider === 'smtp' && !this.isConfigured) {
      this.logger.error(
        'FATAL: SMTP credentials are missing in production. SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM must be configured.',
      );
      throw new Error(
        'FATAL: SMTP email provider cannot start in production without valid credentials.',
      );
    }

    if (customTransporter) {
      this.transporter = customTransporter;
    } else if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.secure,
        auth: {
          user: this.user,
          pass: this.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    } else {
      this.transporter = null as any;
    }
  }

  getIsConfigured(): boolean {
    return this.isConfigured;
  }

  getHost(): string {
    return this.host;
  }

  getPort(): number {
    return this.port;
  }

  getSecure(): boolean {
    return this.secure;
  }

  getFromAddress(): string {
    return this.fromAddress;
  }

  /**
   * Dispatches an OTP verification code via Gmail SMTP transport.
   * Safe in production: never logs raw OTP, passwords, or authentication secrets.
   */
  async sendOtp(email: string, otp: string): Promise<void> {
    const maskedEmail = EmailUtil.mask(email);

    if (!this.isConfigured || !this.transporter) {
      this.logger.error(
        `Cannot send email OTP to ${maskedEmail}: SMTP credentials are not configured.`,
      );
      throw new InternalServerErrorException(
        'Email service is temporarily unavailable. Please configure SMTP credentials.',
      );
    }

    const mailOptions = {
      from: this.fromAddress,
      to: email,
      subject: 'Your FoodiGo Verification Code',
      text: `Your FoodiGo verification code is: ${otp}. It expires in 5 minutes. If you did not request this code, please ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 8px;">
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

    try {
      const info = await this.transporter.sendMail(mailOptions);
      if (info?.rejected && Array.isArray(info.rejected) && info.rejected.length > 0) {
        this.logger.warn(`SMTP rejected recipient ${maskedEmail}`);
        throw new BadRequestException('Recipient address was rejected by the email service.');
      }
      this.logger.log(
        `Email OTP accepted by SMTP server for ${maskedEmail} (Message ID: ${info?.messageId ?? 'unknown'})`,
      );
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      const safeErrorMsg = this.sanitizeErrorMessage(error?.message || 'Unknown SMTP transport error');
      this.logger.error(`SMTP delivery failed for ${maskedEmail}: ${safeErrorMsg}`);
      throw new InternalServerErrorException(
        'Failed to deliver verification code. Please try again later.',
      );
    }
  }

  private sanitizeErrorMessage(msg: string): string {
    let sanitized = msg;
    if (this.pass) {
      sanitized = sanitized.replace(new RegExp(this.escapeRegExp(this.pass), 'g'), '***REDACTED***');
    }
    return sanitized;
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
