import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';
import { PaymentFailureDto } from './dto/payment-failure.dto.js';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsServiceMock: {
    createPaymentOrder: ReturnType<typeof vi.fn>;
    verifyPayment: ReturnType<typeof vi.fn>;
    recordPaymentFailure: ReturnType<typeof vi.fn>;
    getOrderPayments: ReturnType<typeof vi.fn>;
    handleWebhook: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    paymentsServiceMock = {
      createPaymentOrder: vi.fn(),
      verifyPayment: vi.fn(),
      recordPaymentFailure: vi.fn(),
      getOrderPayments: vi.fn(),
      handleWebhook: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: paymentsServiceMock },
        { provide: JwtService, useValue: { verifyAsync: vi.fn() } },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: vi.fn() } },
        { provide: PrismaService, useValue: { user: { findUnique: vi.fn() } } },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createPaymentOrder should extract userId and call service', async () => {
    const mockReq = { user: { sub: '12' } };
    paymentsServiceMock.createPaymentOrder.mockResolvedValue({ success: true });

    const result = await controller.createPaymentOrder(mockReq, { orderId: 5 });

    expect(paymentsServiceMock.createPaymentOrder).toHaveBeenCalledWith(12n, {
      orderId: 5,
    });
    expect(result).toEqual({ success: true });
  });

  it('verifyPayment should extract userId and call service', async () => {
    const mockReq = { user: { userId: '12' } };
    const dto = {
      orderId: 5,
      providerOrderId: 'order_123',
      providerPaymentId: 'pay_123',
      providerSignature: 'sig_123',
    };
    paymentsServiceMock.verifyPayment.mockResolvedValue({ success: true });

    const result = await controller.verifyPayment(mockReq, dto);

    expect(paymentsServiceMock.verifyPayment).toHaveBeenCalledWith(12n, dto);
    expect(result).toEqual({ success: true });
  });

  it('recordFailure should extract userId and call service', async () => {
    const mockReq = { user: { sub: '12' } };
    const dto = {
      orderId: 5,
      providerOrderId: 'order_123',
      code: 'ERR',
      description: 'cancelled',
    };
    paymentsServiceMock.recordPaymentFailure.mockResolvedValue({ success: true });

    const result = await controller.recordFailure(mockReq, dto);

    expect(paymentsServiceMock.recordPaymentFailure).toHaveBeenCalledWith(
      12n,
      dto,
    );
    expect(result).toEqual({ success: true });
  });

  it('getOrderPayments should call service with orderId', async () => {
    const mockReq = { user: { sub: '12' } };
    paymentsServiceMock.getOrderPayments.mockResolvedValue({ success: true });

    const result = await controller.getOrderPayments(mockReq, 42);

    expect(paymentsServiceMock.getOrderPayments).toHaveBeenCalledWith(12n, 42);
    expect(result).toEqual({ success: true });
  });

  describe('handleWebhook', () => {
    it('should throw BadRequestException if signature is missing', async () => {
      await expect(
        controller.handleWebhook({ body: {} }, '', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass signature, raw body, event data, and event id header to service', async () => {
      const mockReq = {
        rawBody: Buffer.from(JSON.stringify({ event: 'order.paid' })),
        body: { event: 'order.paid' },
        headers: {},
      };
      paymentsServiceMock.handleWebhook.mockResolvedValue({ status: 'success' });

      const result = await controller.handleWebhook(
        mockReq,
        'valid_sig',
        mockReq.body,
        'evt_hdr_123',
      );

      expect(paymentsServiceMock.handleWebhook).toHaveBeenCalledWith(
        'valid_sig',
        mockReq.rawBody.toString('utf-8'),
        mockReq.body,
        'evt_hdr_123',
      );
      expect(result).toEqual({ status: 'success' });
    });

    it('should fall back to req.headers when eventIdHeader param is absent', async () => {
      const mockReq = {
        rawBody: Buffer.from(JSON.stringify({ event: 'order.paid' })),
        body: { event: 'order.paid' },
        headers: { 'x-razorpay-event-id': 'evt_from_req_headers' },
      };
      paymentsServiceMock.handleWebhook.mockResolvedValue({ status: 'success' });

      await controller.handleWebhook(
        mockReq,
        'valid_sig',
        mockReq.body,
      );

      expect(paymentsServiceMock.handleWebhook).toHaveBeenCalledWith(
        'valid_sig',
        mockReq.rawBody.toString('utf-8'),
        mockReq.body,
        'evt_from_req_headers',
      );
    });
  });

  describe('Payment DTO Strict Validation Contracts', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('CreatePaymentOrderDto accepts valid orderId and rejects checkoutGroupId', async () => {
      const valid = await pipe.transform(
        { orderId: 42 },
        { type: 'body', metatype: CreatePaymentOrderDto },
      );
      expect(valid.orderId).toBe(42);

      try {
        await pipe.transform(
          { orderId: 42, checkoutGroupId: 'CG12345678' },
          { type: 'body', metatype: CreatePaymentOrderDto },
        );
        expect.fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.message).toContain('property checkoutGroupId should not exist');
      }
    });

    it('VerifyPaymentDto accepts valid signature payload and rejects checkoutGroupId', async () => {
      const valid = await pipe.transform(
        {
          orderId: 42,
          providerOrderId: 'order_123',
          providerPaymentId: 'pay_123',
          providerSignature: 'sig_123',
        },
        { type: 'body', metatype: VerifyPaymentDto },
      );
      expect(valid.orderId).toBe(42);

      try {
        await pipe.transform(
          {
            orderId: 42,
            providerOrderId: 'order_123',
            providerPaymentId: 'pay_123',
            providerSignature: 'sig_123',
            checkoutGroupId: 'CG12345678',
          },
          { type: 'body', metatype: VerifyPaymentDto },
        );
        expect.fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.message).toContain('property checkoutGroupId should not exist');
      }
    });

    it('PaymentFailureDto accepts valid failure payload and rejects checkoutGroupId', async () => {
      const valid = await pipe.transform(
        {
          orderId: 42,
          providerOrderId: 'order_123',
          code: 'USER_CANCELLED',
          description: 'User dismissed modal',
        },
        { type: 'body', metatype: PaymentFailureDto },
      );
      expect(valid.orderId).toBe(42);

      try {
        await pipe.transform(
          {
            orderId: 42,
            providerOrderId: 'order_123',
            checkoutGroupId: 'CG12345678',
          },
          { type: 'body', metatype: PaymentFailureDto },
        );
        expect.fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.message).toContain('property checkoutGroupId should not exist');
      }
    });
  });

  describe('Throttling Policies and Rate Limits', () => {
    const reflector = new Reflector();

    it('createPaymentOrder has endpoint-specific limit of 20 req / 60s to prevent order creation spam while allowing retries', () => {
      const limit = reflector.get('THROTTLER:LIMITdefault', controller.createPaymentOrder);
      const ttl = reflector.get('THROTTLER:TTLdefault', controller.createPaymentOrder);
      expect(limit).toBe(20);
      expect(ttl).toBe(60000);
    });

    it('verifyPayment has endpoint-specific limit of 20 req / 60s to permit legitimate mobile retries while blocking brute force', () => {
      const limit = reflector.get('THROTTLER:LIMITdefault', controller.verifyPayment);
      const ttl = reflector.get('THROTTLER:TTLdefault', controller.verifyPayment);
      expect(limit).toBe(20);
      expect(ttl).toBe(60000);
    });

    it('recordFailure has endpoint-specific limit of 20 req / 60s to record cancellation telemetry safely', () => {
      const limit = reflector.get('THROTTLER:LIMITdefault', controller.recordFailure);
      const ttl = reflector.get('THROTTLER:TTLdefault', controller.recordFailure);
      expect(limit).toBe(20);
      expect(ttl).toBe(60000);
    });

    it('getOrderPayments has polling limit of 30 req / 60s to accommodate client status checks', () => {
      const limit = reflector.get('THROTTLER:LIMITdefault', controller.getOrderPayments);
      const ttl = reflector.get('THROTTLER:TTLdefault', controller.getOrderPayments);
      expect(limit).toBe(30);
      expect(ttl).toBe(60000);
    });

    it('handleWebhook has high-capacity limit of 120 req / 60s and is NOT skipped, protecting from DoS while preventing false 429s for Razorpay bursts', () => {
      const limit = reflector.get('THROTTLER:LIMITdefault', controller.handleWebhook);
      const ttl = reflector.get('THROTTLER:TTLdefault', controller.handleWebhook);
      const skip = reflector.get('THROTTLER:SKIPdefault', controller.handleWebhook);
      expect(limit).toBe(120);
      expect(ttl).toBe(60000);
      expect(skip).toBeFalsy();
    });
  });
});

