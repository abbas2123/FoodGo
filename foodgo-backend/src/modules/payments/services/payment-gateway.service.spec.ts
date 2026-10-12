import { describe, expect, it, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayService } from './payment-gateway.service.js';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;
  let configMock: any;

  beforeEach(() => {
    configMock = {
      get: (key: string) => {
        if (key === 'payment.keyId') return 'rzp_test_testkey';
        if (key === 'payment.keySecret') return 'test_secret_12345';
        if (key === 'payment.webhookSecret') return 'test_webhook_secret_67890';
        return null;
      },
    };
    service = new PaymentGatewayService(configMock as ConfigService);
  });

  describe('Order Creation', () => {
    it('generates a mock order when in mock mode', async () => {
      const order = await service.createOrder({
        amount: 250,
        currency: 'INR',
        receipt: 'FG12345678',
      });

      expect(order.providerOrderId).toMatch(/^order_mock_/);
      expect(order.amount).toBe(250);
      expect(order.currency).toBe('INR');
      expect(order.receipt).toBe('FG12345678');
    });
  });

  describe('Signature Verification', () => {
    it('validates a correct HMAC SHA256 signature', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const validSig = service.generateTestSignature(orderId, paymentId);

      expect(service.verifyPaymentSignature(orderId, paymentId, validSig)).toBe(true);
    });

    it('rejects an invalid signature', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const invalidSig = 'invalid_tampered_signature_hex_string_1234567890abcdef';

      expect(service.verifyPaymentSignature(orderId, paymentId, invalidSig)).toBe(false);
    });

    it('rejects verification if orderId or paymentId is altered', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const validSig = service.generateTestSignature(orderId, paymentId);

      expect(service.verifyPaymentSignature(orderId, 'pay_DIFFERENT', validSig)).toBe(false);
      expect(service.verifyPaymentSignature('order_DIFFERENT', paymentId, validSig)).toBe(false);
    });

    it('rejects empty or missing parameters', () => {
      expect(service.verifyPaymentSignature('', '', '')).toBe(false);
    });

    it('rejects mock signatures in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const orderId = 'order_ABC123';
        const paymentId = 'pay_XYZ789';
        const mockSig = 'mock_sig_101';

        expect(service.verifyPaymentSignature(orderId, paymentId, mockSig)).toBe(false);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('throws fatal error in production if configured with mock keys', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const mockConfig = {
          get: (key: string) => {
            if (key === 'payment.keyId') return 'rzp_test_mock_id';
            if (key === 'payment.keySecret') return 'rzp_test_mock_secret';
            return null;
          },
        };

        expect(() => new PaymentGatewayService(mockConfig as any)).toThrow(
          /cannot run in production with mock keys/,
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Webhook Signature Verification', () => {
    it('validates a correct webhook signature', () => {
      const body = JSON.stringify({ event: 'payment.captured', data: { id: 'pay_123' } });
      const signature = service.generateTestWebhookSignature(body);

      expect(service.verifyWebhookSignature(body, signature)).toBe(true);
    });

    it('rejects a tampered webhook body', () => {
      const body = JSON.stringify({ event: 'payment.captured', data: { id: 'pay_123' } });
      const signature = service.generateTestWebhookSignature(body);

      const tamperedBody = JSON.stringify({ event: 'payment.captured', data: { id: 'pay_999' } });
      expect(service.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
    });
  });
});
