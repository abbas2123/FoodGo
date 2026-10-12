import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentGatewayService } from './services/payment-gateway.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '../../generated/prisma/client.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaMock: any;
  let gatewayMock: any;
  let notificationsMock: any;

  beforeEach(async () => {
    prismaMock = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      paymentTransaction: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      orderStatusHistory: {
        create: vi.fn(),
      },
      processedWebhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prismaMock);
        }
        return Promise.all(callback);
      }),
    };

    gatewayMock = {
      createOrder: vi.fn(),
      verifyPaymentSignature: vi.fn(),
      verifyWebhookSignature: vi.fn(),
      getPublicKeyId: vi.fn().mockReturnValue('rzp_test_mock_key'),
    };

    notificationsMock = {
      createNotification: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PaymentGatewayService, useValue: gatewayMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentOrder', () => {
    it('should create a payment order with Razorpay successfully', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        grandTotal: 450.0,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      gatewayMock.createOrder.mockResolvedValue({
        providerOrderId: 'order_rzp_123',
        amount: 45000,
        currency: 'INR',
      });
      prismaMock.paymentTransaction.create.mockResolvedValue({
        id: 'pt_1',
        orderId: 101,
        userId: 1n,
        amount: 450.0,
        currency: 'INR',
        provider: PaymentProvider.RAZORPAY,
        status: PaymentStatus.PENDING,
        providerOrderId: 'order_rzp_123',
      });

      const result = await service.createPaymentOrder(1n, { orderId: 101 });

      expect(result.success).toBe(true);
      expect(result.data.providerOrderId).toBe('order_rzp_123');
      expect(result.data.amount).toBe(450.0);
      expect(result.data.keyId).toBe('rzp_test_mock_key');
      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 101,
          userId: 1n,
          amount: 450.0,
          currency: 'INR',
          provider: PaymentProvider.RAZORPAY,
          status: PaymentStatus.PENDING,
          providerOrderId: 'order_rzp_123',
        }),
      });
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createPaymentOrder(1n, { orderId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order belongs to another user', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 2n, // different user
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      });

      await expect(
        service.createPaymentOrder(1n, { orderId: 101 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order is already paid or confirmed', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1n,
        status: OrderStatus.CONFIRMED,
        paymentStatus: 'PAID',
      });

      await expect(
        service.createPaymentOrder(1n, { orderId: 101 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order is cancelled', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1n,
        status: OrderStatus.CANCELLED,
        paymentStatus: 'FAILED',
      });

      await expect(
        service.createPaymentOrder(1n, { orderId: 101 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recover active session if pending transaction already exists (interrupted checkout recovery)', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        grandTotal: 450.0,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      };

      const existingTransaction = {
        id: 'pt_existing_1',
        orderId: 101,
        userId: 1n,
        amount: 450.0,
        currency: 'INR',
        providerOrderId: 'order_rzp_existing',
        status: PaymentStatus.PENDING,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockResolvedValue(existingTransaction);

      const result = await service.createPaymentOrder(1n, { orderId: 101 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Active payment session retrieved');
      expect(result.data.providerOrderId).toBe('order_rzp_existing');
      expect(gatewayMock.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('should verify signature and atomically confirm order', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        grandTotal: 450.0,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      };

      const mockTransaction = {
        id: 'pt_1',
        orderId: 101,
        userId: 1n,
        amount: 450.0,
        currency: 'INR',
        provider: PaymentProvider.RAZORPAY,
        status: PaymentStatus.PENDING,
        providerOrderId: 'order_rzp_123',
        order: mockOrder,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockImplementation(async ({ where }: any) => {
        if (where?.orderId && typeof where.orderId === 'object' && where.orderId.not) {
          return null;
        }
        if (where?.status === PaymentStatus.SUCCESS) {
          return null;
        }
        return mockTransaction;
      });
      gatewayMock.verifyPaymentSignature.mockReturnValue(true);
      prismaMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        paymentStatus: 'PAID',
      });

      const result = await service.verifyPayment(1n, {
        orderId: 101,
        providerOrderId: 'order_rzp_123',
        providerPaymentId: 'pay_rzp_abc',
        providerSignature: 'valid_signature',
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(OrderStatus.CONFIRMED);
      expect(result.data.paymentStatus).toBe('PAID');
      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalled();
      expect(notificationsMock.createNotification).toHaveBeenCalled();
    });

    it('should throw BadRequestException on invalid cryptographic signature', async () => {
      const mockOrder = {
        id: 101,
        userId: 1n,
        status: OrderStatus.PENDING,
      };

      const mockTransaction = {
        id: 'pt_1',
        orderId: 101,
        userId: 1n,
        providerOrderId: 'order_rzp_123',
        status: PaymentStatus.PENDING,
        order: mockOrder,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockImplementation(async ({ where }: any) => {
        if (where?.orderId && typeof where.orderId === 'object' && where.orderId.not) {
          return null;
        }
        if (where?.status === PaymentStatus.SUCCESS) {
          return null;
        }
        return mockTransaction;
      });
      gatewayMock.verifyPaymentSignature.mockReturnValue(false);

      await expect(
        service.verifyPayment(1n, {
          orderId: 101,
          providerOrderId: 'order_rzp_123',
          providerPaymentId: 'pay_rzp_abc',
          providerSignature: 'tampered_signature',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pt_1' },
          data: expect.objectContaining({
            status: PaymentStatus.FAILED,
            failureCode: 'INVALID_SIGNATURE',
          }),
        }),
      );
    });

    it('should handle idempotent duplicate verification gracefully', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        status: OrderStatus.CONFIRMED,
        paymentStatus: 'PAID',
      };

      const mockTransaction = {
        id: 'pt_1',
        orderId: 101,
        userId: 1n,
        providerOrderId: 'order_rzp_123',
        providerPaymentId: 'pay_rzp_abc',
        status: PaymentStatus.SUCCESS,
        order: mockOrder,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockResolvedValue(mockTransaction);
      gatewayMock.verifyPaymentSignature.mockReturnValue(true);

      const result = await service.verifyPayment(1n, {
        orderId: 101,
        providerOrderId: 'order_rzp_123',
        providerPaymentId: 'pay_rzp_abc',
        providerSignature: 'valid_signature',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already verified');
      expect(prismaMock.paymentTransaction.updateMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if matching transaction is not found', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      // No transaction found on the order
      prismaMock.paymentTransaction.findFirst
        .mockResolvedValueOnce(null) // alreadyVerifiedTx check
        .mockResolvedValueOnce(null) // existingPaymentForOtherOrder check
        .mockResolvedValueOnce(null); // transaction lookup

      await expect(
        service.verifyPayment(1n, {
          orderId: 101,
          providerOrderId: 'order_nonexistent',
          providerPaymentId: 'pay_xyz',
          providerSignature: 'sig_xyz',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if payment transaction belongs to another user', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      };

      const mockTransaction = {
        id: 'pt_1',
        orderId: 101,
        userId: 2n, // belongs to user 2
        providerOrderId: 'order_rzp_123',
        status: PaymentStatus.PENDING,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst
        .mockResolvedValueOnce(null) // alreadyVerifiedTx
        .mockResolvedValueOnce(null) // existingPaymentForOtherOrder
        .mockResolvedValueOnce(mockTransaction); // transaction lookup

      await expect(
        service.verifyPayment(1n, {
          orderId: 101,
          providerOrderId: 'order_rzp_123',
          providerPaymentId: 'pay_xyz',
          providerSignature: 'sig_xyz',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent payment replay when providerPaymentId was already applied to another order', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      };

      // Payment ID already used on order 99
      const existingPaymentForOtherOrder = {
        id: 'pt_other_order',
        orderId: 99,
        providerPaymentId: 'pay_already_used',
        status: PaymentStatus.SUCCESS,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst
        .mockResolvedValueOnce(null) // alreadyVerifiedTx for order 101
        .mockResolvedValueOnce(existingPaymentForOtherOrder); // replay detected!

      await expect(
        service.verifyPayment(1n, {
          orderId: 101,
          providerOrderId: 'order_rzp_123',
          providerPaymentId: 'pay_already_used',
          providerSignature: 'sig_xyz',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate database transaction failure if confirmation fails', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        grandTotal: 450.0,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
      };

      const mockTransaction = {
        id: 'pt_1',
        orderId: 101,
        userId: 1n,
        amount: 450.0,
        currency: 'INR',
        providerOrderId: 'order_rzp_123',
        status: PaymentStatus.PENDING,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockImplementation(async ({ where }: any) => {
        if (where?.orderId && typeof where.orderId === 'object' && where.orderId.not) {
          return null;
        }
        if (where?.status === PaymentStatus.SUCCESS) {
          return null;
        }
        return mockTransaction;
      });
      gatewayMock.verifyPaymentSignature.mockReturnValue(true);

      prismaMock.$transaction.mockRejectedValue(new Error('DB Connection Timeout'));

      await expect(
        service.verifyPayment(1n, {
          orderId: 101,
          providerOrderId: 'order_rzp_123',
          providerPaymentId: 'pay_rzp_abc',
          providerSignature: 'valid_signature',
        }),
      ).rejects.toThrow('DB Connection Timeout');
    });
  });

  describe('recordPaymentFailure', () => {
    it('should mark transaction as FAILED with error details', async () => {
      const mockOrder = {
        id: 101,
        userId: 1n,
        status: OrderStatus.PENDING,
      };

      const mockTransaction = {
        id: 'pt_1',
        orderId: 101,
        userId: 1n,
        status: PaymentStatus.PENDING,
        providerOrderId: 'order_rzp_123',
        order: mockOrder,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.recordPaymentFailure(1n, {
        orderId: 101,
        providerOrderId: 'order_rzp_123',
        code: 'BAD_REQUEST_ERROR',
        description: 'User cancelled transaction',
      });

      expect(result.success).toBe(true);
      expect(prismaMock.paymentTransaction.update).toHaveBeenCalledWith({
        where: { id: 'pt_1' },
        data: expect.objectContaining({
          status: PaymentStatus.FAILED,
          failureCode: 'BAD_REQUEST_ERROR',
          failureMessage: 'User cancelled transaction',
        }),
      });
    });

    it('should not overwrite an already SUCCESS transaction when late failure or dismiss callback arrives', async () => {
      const mockOrder = {
        id: 101,
        userId: 1n,
        status: OrderStatus.CONFIRMED,
        paymentStatus: 'PAID',
      };

      const mockTransaction = {
        id: 'pt_1',
        orderId: 101,
        userId: 1n,
        status: PaymentStatus.SUCCESS, // already succeeded
        providerOrderId: 'order_rzp_123',
        order: mockOrder,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.recordPaymentFailure(1n, {
        orderId: 101,
        providerOrderId: 'order_rzp_123',
        code: 'USER_DISMISSED',
        description: 'Modal closed after payment',
      });

      expect(result.success).toBe(true);
      // Ensure update is NOT called because status was already SUCCESS
      expect(prismaMock.paymentTransaction.update).not.toHaveBeenCalled();
    });

    it('should record sanitized Netbanking/gateway failure details when provider rejects method', async () => {
      const mockOrder = {
        id: 101,
        userId: 1n,
        status: OrderStatus.PENDING,
      };

      const mockTransaction = {
        id: 'pt_netbanking_fail',
        orderId: 101,
        userId: 1n,
        status: PaymentStatus.PENDING,
        providerOrderId: 'order_rzp_123',
        order: mockOrder,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.recordPaymentFailure(1n, {
        orderId: 101,
        providerOrderId: 'order_rzp_123',
        code: 'PAYMENT_FAILED',
        description: 'Please use another method',
      });

      expect(result.success).toBe(true);
      expect(prismaMock.paymentTransaction.update).toHaveBeenCalledWith({
        where: { id: 'pt_netbanking_fail' },
        data: expect.objectContaining({
          status: PaymentStatus.FAILED,
          failureCode: 'PAYMENT_FAILED',
          failureMessage: 'Please use another method',
        }),
      });
    });
  });

  describe('getOrderPayments', () => {
    it('should return transactions for the authenticated user', async () => {
      const mockOrder = {
        id: 101,
        orderNumber: 'ORD-101',
        userId: 1n,
        paymentStatus: 'PAID',
        paymentMethod: 'RAZORPAY',
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.paymentTransaction.findMany.mockResolvedValue([
        {
          id: 'pt_1',
          amount: 450,
          currency: 'INR',
          status: PaymentStatus.SUCCESS,
          createdAt: new Date(),
          paidAt: new Date(),
        },
      ]);

      const result = await service.getOrderPayments(1n, 101);

      expect(result.success).toBe(true);
      expect(result.data.orderId).toBe(101);
      expect(result.data.transactions).toHaveLength(1);
    });

    it('should throw ForbiddenException if order belongs to another user', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 2n, // other user
      });

      await expect(service.getOrderPayments(1n, 101)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('handleWebhook', () => {
    const baseOrder = {
      id: 101,
      status: OrderStatus.PENDING,
      paymentStatus: 'PENDING',
    };

    const baseTx = {
      id: 'pt_1',
      orderId: 101,
      userId: 1n,
      status: PaymentStatus.PENDING,
      providerOrderId: 'order_rzp_123',
      providerPaymentId: null,
      order: baseOrder,
    };

    const makePayload = (opts?: {
      eventId?: string;
      orderId?: string;
      paymentId?: string;
      event?: string;
    }) => ({
      event_id: opts?.eventId ?? 'evt_test_123',
      event: opts?.event ?? 'order.paid',
      payload: {
        payment: {
          entity: {
            id: opts?.paymentId ?? 'pay_wh_123',
            order_id: opts?.orderId ?? 'order_rzp_123',
            status: 'captured',
          },
        },
      },
    });

    beforeEach(() => {
      gatewayMock.verifyWebhookSignature.mockReturnValue(true);
      prismaMock.processedWebhookEvent.findUnique.mockResolvedValue(null);
      prismaMock.processedWebhookEvent.create.mockResolvedValue({ id: 1n });
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({ ...baseTx });
      prismaMock.paymentTransaction.update.mockResolvedValue({ ...baseTx, status: PaymentStatus.SUCCESS });
      prismaMock.order.findUnique.mockResolvedValue({ ...baseOrder });
      prismaMock.order.update.mockResolvedValue({ ...baseOrder, status: OrderStatus.CONFIRMED, paymentStatus: 'PAID' });
      prismaMock.orderStatusHistory.create.mockResolvedValue({ id: 1 });
    });

    it('1. should accept valid webhook signature and process valid event', async () => {
      const payload = makePayload({ eventId: 'evt_valid_1' });
      const result = await service.handleWebhook('valid_sig', JSON.stringify(payload), payload);

      expect(result.status).toBe('success');
      expect(result.eventId).toBe('evt_valid_1');
      expect(prismaMock.processedWebhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: PaymentProvider.RAZORPAY,
          eventId: 'evt_valid_1',
          eventType: 'order.paid',
        }),
      });
      expect(prismaMock.order.update).toHaveBeenCalled();
    });

    it('2. should reject invalid webhook signature with BadRequestException', async () => {
      gatewayMock.verifyWebhookSignature.mockReturnValue(false);
      const payload = makePayload();

      await expect(
        service.handleWebhook('invalid_sig', JSON.stringify(payload), payload),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.processedWebhookEvent.create).not.toHaveBeenCalled();
    });

    it('3. should reject request with missing event identifier with BadRequestException', async () => {
      // Payload with no top-level event_id, no id, no entity id, and no header
      const emptyPayload = { event: 'order.paid', payload: {} };

      await expect(
        service.handleWebhook('valid_sig', JSON.stringify(emptyPayload), emptyPayload, undefined),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.processedWebhookEvent.create).not.toHaveBeenCalled();
    });

    it('4. should successfully process first delivery and atomically register event', async () => {
      const payload = makePayload({ eventId: 'evt_first_delivery' });
      const result = await service.handleWebhook('valid_sig', JSON.stringify(payload), payload);

      expect(result.status).toBe('success');
      expect(result.eventId).toBe('evt_first_delivery');
      expect(prismaMock.processedWebhookEvent.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCESS }),
        }),
      );
    });

    it('5. should safely ignore repeated delivery without repeating side effects', async () => {
      prismaMock.processedWebhookEvent.findUnique.mockResolvedValue({
        id: 10n,
        provider: PaymentProvider.RAZORPAY,
        eventId: 'evt_dup_repeated',
        eventType: 'order.paid',
        processedAt: new Date(),
      });

      const payload = makePayload({ eventId: 'evt_dup_repeated' });
      const result = await service.handleWebhook('valid_sig', JSON.stringify(payload), payload);

      expect(result.status).toBe('already_processed');
      expect(result.eventId).toBe('evt_dup_repeated');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });

    it('6. should intercept concurrent deliveries via unique constraint violation and not duplicate side effects', async () => {
      // Simulate concurrent delivery: findUnique found null, but inside $transaction create hits P2002 on provider_event_id
      const p2002Error: any = new Error('Unique constraint failed on provider_event_id');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['provider', 'event_id'] };

      prismaMock.$transaction.mockRejectedValueOnce(p2002Error);

      const payload = makePayload({ eventId: 'evt_concurrent_123' });
      const result = await service.handleWebhook('valid_sig', JSON.stringify(payload), payload);

      expect(result.status).toBe('already_processed');
      expect(result.eventId).toBe('evt_concurrent_123');
    });

    it('7. should process a different event normally with independent eventId', async () => {
      const payload1 = makePayload({ eventId: 'evt_alpha' });
      const payload2 = makePayload({ eventId: 'evt_beta' });

      const res1 = await service.handleWebhook('valid_sig', JSON.stringify(payload1), payload1);
      const res2 = await service.handleWebhook('valid_sig', JSON.stringify(payload2), payload2);

      expect(res1.status).toBe('success');
      expect(res1.eventId).toBe('evt_alpha');
      expect(res2.status).toBe('success');
      expect(res2.eventId).toBe('evt_beta');
      expect(prismaMock.processedWebhookEvent.create).toHaveBeenCalledTimes(2);
    });

    it('8. should roll back event registration and rethrow error on processing failure so retry is permitted', async () => {
      prismaMock.$transaction.mockRejectedValueOnce(new Error('Transient DB timeout'));

      const payload = makePayload({ eventId: 'evt_failing_transient' });
      await expect(
        service.handleWebhook('valid_sig', JSON.stringify(payload), payload),
      ).rejects.toThrow('Transient DB timeout');
    });

    it('9. should not regress a payment already verified via client endpoint', async () => {
      // Transaction was already marked SUCCESS by /payments/verify endpoint
      prismaMock.paymentTransaction.findFirst.mockResolvedValue({
        ...baseTx,
        status: PaymentStatus.SUCCESS,
      });

      const payload = makePayload({ eventId: 'evt_already_verified_client' });
      const result = await service.handleWebhook('valid_sig', JSON.stringify(payload), payload);

      expect(result.status).toBe('already_processed');
      expect(result.eventId).toBe('evt_already_verified_client');
      // Should not call update on order
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });

    it('10. should handle failure, capture, refund, and other events preserving valid transitions', async () => {
      // payment.failed
      const failPayload = {
        event_id: 'evt_fail_1',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_1',
              order_id: 'order_rzp_123',
              error_code: 'BAD_REQUEST',
              error_description: 'Card declined',
            },
          },
        },
      };
      const failResult = await service.handleWebhook('valid_sig', JSON.stringify(failPayload), failPayload);
      expect(failResult.status).toBe('failure_recorded');
      expect(failResult.eventId).toBe('evt_fail_1');

      // refund.processed
      const refundPayload = {
        event_id: 'evt_refund_1',
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_1',
              order_id: 'order_rzp_123',
            },
          },
        },
      };
      const refundResult = await service.handleWebhook('valid_sig', JSON.stringify(refundPayload), refundPayload);
      expect(refundResult.status).toBe('refund_recorded');
      expect(refundResult.eventId).toBe('evt_refund_1');

      // unknown / ignored event
      const ignoredPayload = {
        event_id: 'evt_ignored_1',
        event: 'invoice.paid',
        payload: {},
      };
      const ignoredResult = await service.handleWebhook('valid_sig', JSON.stringify(ignoredPayload), ignoredPayload);
      expect(ignoredResult.status).toBe('event_ignored');
      expect(ignoredResult.eventId).toBe('evt_ignored_1');
    });

    it('11. should rethrow unrelated Prisma P2002 errors and not swallow them as duplicate webhooks', async () => {
      // P2002 on an unrelated constraint (e.g., users table email conflict)
      const unrelatedP2002: any = new Error('Unique constraint failed on email');
      unrelatedP2002.code = 'P2002';
      unrelatedP2002.meta = { target: ['email'] };

      prismaMock.$transaction.mockRejectedValueOnce(unrelatedP2002);

      const payload = makePayload({ eventId: 'evt_unrelated_p2002' });
      await expect(
        service.handleWebhook('valid_sig', JSON.stringify(payload), payload),
      ).rejects.toThrow('Unique constraint failed on email');
    });

    it('12. should not bypass signature verification for duplicate events', async () => {
      gatewayMock.verifyWebhookSignature.mockReturnValue(false);

      // Even if event exists in processed table
      prismaMock.processedWebhookEvent.findUnique.mockResolvedValue({
        id: 10n,
        provider: PaymentProvider.RAZORPAY,
        eventId: 'evt_duplicate_attempt',
        eventType: 'order.paid',
        processedAt: new Date(),
      });

      const payload = makePayload({ eventId: 'evt_duplicate_attempt' });
      await expect(
        service.handleWebhook('tampered_sig', JSON.stringify(payload), payload),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
