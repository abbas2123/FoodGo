import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface CreateProviderOrderParams {
  amount: number; // in standard currency units (e.g. 250.00 INR)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface ProviderOrderResult {
  providerOrderId: string;
  amount: number; // in standard currency units
  currency: string;
  receipt: string;
}

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly isMockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.keyId =
      this.configService.get<string>('payment.keyId') ||
      process.env.PAYMENT_KEY_ID ||
      process.env.RAZORPAY_KEY_ID ||
      'rzp_test_mock_id';

    this.keySecret =
      this.configService.get<string>('payment.keySecret') ||
      process.env.PAYMENT_KEY_SECRET ||
      process.env.RAZORPAY_KEY_SECRET ||
      'rzp_test_mock_secret';

    this.webhookSecret =
      this.configService.get<string>('payment.webhookSecret') ||
      process.env.PAYMENT_WEBHOOK_SECRET ||
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      'rzp_test_mock_webhook_secret';

    // Mock mode active only outside production when using test mock keys or when explicitly running offline tests
    this.isMockMode =
      process.env.NODE_ENV !== 'production' &&
      (this.keyId.includes('mock') ||
        this.keySecret.includes('mock') ||
        process.env.NODE_ENV === 'test');

    if (
      process.env.NODE_ENV === 'production' &&
      (this.isMockMode || this.keyId.includes('mock') || this.keySecret.includes('mock'))
    ) {
      throw new Error(
        'FATAL: PaymentGatewayService cannot run in production with mock keys. Please configure valid PAYMENT_KEY_ID and PAYMENT_KEY_SECRET.',
      );
    }
  }

  getPublicKeyId(): string {
    return this.keyId;
  }

  isMock(): boolean {
    return this.isMockMode;
  }

  /**
   * Creates an order with Razorpay or deterministic test generator
   */
  async createOrder(
    params: CreateProviderOrderParams,
  ): Promise<ProviderOrderResult> {
    const currency = params.currency || 'INR';
    const amountInSubunits = Math.round(params.amount * 100); // INR to paise

    if (this.isMockMode) {
      this.logger.debug(
        `Mock mode active: Generating test provider order for receipt ${params.receipt}`,
      );
      const randomSuffix = Math.random().toString(36).slice(2, 9);
      return {
        providerOrderId: `order_mock_${Date.now()}_${randomSuffix}`,
        amount: params.amount,
        currency,
        receipt: params.receipt,
      };
    }

    try {
      const authHeader = Buffer.from(
        `${this.keyId}:${this.keySecret}`,
      ).toString('base64');

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          amount: amountInSubunits,
          currency,
          receipt: params.receipt,
          notes: params.notes,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`Razorpay order creation failed: ${errText}`);
        throw new Error(`Razorpay API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { id: string; amount: number; currency: string; receipt: string };
      return {
        providerOrderId: data.id,
        amount: data.amount / 100,
        currency: data.currency,
        receipt: data.receipt,
      };
    } catch (err: any) {
      this.logger.error(`Error connecting to Razorpay: ${err.message}`);
      throw err;
    }
  }

  /**
   * Verifies payment signature using HMAC SHA256
   * Razorpay signature formula: HMAC_SHA256(order_id + "|" + payment_id, secret)
   */
  verifyPaymentSignature(
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
  ): boolean {
    if (!providerOrderId || !providerPaymentId || !signature) {
      return false;
    }

    // In production or when real gateway credentials are used, mock signatures are strictly forbidden
    if (signature.startsWith('mock_sig_')) {
      if (process.env.NODE_ENV === 'production' || !this.isMockMode) {
        return false;
      }
      return true;
    }

    try {
      const payload = `${providerOrderId}|${providerPaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(payload)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      if (expectedSignature.length !== signature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Verifies Razorpay webhook signature
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!rawBody || !signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature.length !== signature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Helper to generate a valid test signature for automated tests & sandboxes
   */
  generateTestSignature(
    providerOrderId: string,
    providerPaymentId: string,
  ): string {
    const payload = `${providerOrderId}|${providerPaymentId}`;
    return crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Helper to generate a valid test webhook signature for automated tests
   */
  generateTestWebhookSignature(rawBody: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
  }
}
