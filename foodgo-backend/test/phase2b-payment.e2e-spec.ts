import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TokenService } from '../src/modules/auth/services/token.service.js';
import {
  OrderStatus,
  PaymentStatus,
  UserType,
} from '../src/generated/prisma/client.js';

describe('Phase 2B — Real Payment System + Payment/Order Integrity (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let configService: ConfigService;

  let customerA: any;
  let customerB: any;
  let customerAToken: string;
  let customerBToken: string;

  let restaurant: any;
  let menuItem: any;
  let addressA: any;

  let keySecret: string;
  let webhookSecret: string;

  const PHONE_CUST_A = '+14155557701';
  const PHONE_CUST_B = '+14155557702';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);
    configService = app.get(ConfigService);

    keySecret =
      configService.get<string>('payment.keySecret') ??
      'mock_secret_key_for_testing';
    webhookSecret =
      configService.get<string>('payment.webhookSecret') ??
      'mock_webhook_secret_for_testing';

    // Clean up existing test records
    const existingAuths = await prisma.userAuth.findMany({
      where: { phone: { in: [PHONE_CUST_A, PHONE_CUST_B] } },
    });
    for (const auth of existingAuths) {
      await prisma.user.delete({ where: { id: auth.userId } });
    }

    // 1. Create Customer A
    customerA = await prisma.user.create({
      data: {
        type: UserType.CUSTOMER,
        name: 'Payment Customer A',
        email: 'custA.pay@foodgo.test',
        auth: {
          create: {
            phone: PHONE_CUST_A,
            phoneVerified: true,
          },
        },
      },
    });
    const tokensA = await tokenService.generateTokens({
      sub: customerA.id.toString(),
      phone: PHONE_CUST_A,
      type: UserType.CUSTOMER,
      status: customerA.status,
    });
    customerAToken = tokensA.accessToken;

    // 2. Create Customer B
    customerB = await prisma.user.create({
      data: {
        type: UserType.CUSTOMER,
        name: 'Payment Customer B',
        email: 'custB.pay@foodgo.test',
        auth: {
          create: {
            phone: PHONE_CUST_B,
            phoneVerified: true,
          },
        },
      },
    });
    const tokensB = await tokenService.generateTokens({
      sub: customerB.id.toString(),
      phone: PHONE_CUST_B,
      type: UserType.CUSTOMER,
      status: customerB.status,
    });
    customerBToken = tokensB.accessToken;

    // 3. Create Restaurant & Menu Item
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'Payment Test Kitchen',
        cuisineTypes: 'Burgers, Gourmet',
        rating: 4.5,
        reviewCount: '5',
        deliveryTimeMin: 25,
        deliveryTimeMax: 40,
        deliveryFee: 30,
        imageUrl: 'https://example.com/ptk.jpg',
        isOpen: true,
      },
    });

    menuItem = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryName: 'Mains',
        name: 'Premium Burger',
        description: 'A premium quality burger',
        price: 250.0,
        imageUrl: 'https://example.com/burger.jpg',
        isAvailable: true,
      },
    });

    // 4. Create Address for Customer A
    addressA = await prisma.addresses.create({
      data: {
        user_id: customerA.id,
        label: 'Home',
        address_line1: '123 Pay Lane',
        address_line2: '',
        landmark: 'Near station',
        city: 'Metropolis',
        state: 'CA',
        postal_code: '94105',
        country: 'USA',
        latitude: 37.775,
        longitude: -122.419,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Cleanup in correct dependency order
    if (restaurant) {
      await prisma.orderStatusHistory.deleteMany({
        where: { order: { restaurantId: restaurant.id } },
      });
      await prisma.paymentTransaction.deleteMany({
        where: { order: { restaurantId: restaurant.id } },
      });
      await prisma.orderItem.deleteMany({
        where: { order: { restaurantId: restaurant.id } },
      });
      await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id } });
      await prisma.restaurant.delete({ where: { id: restaurant.id } });
    }

    const testUserIds = [customerA?.id, customerB?.id].filter(Boolean);
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }

    await app.close();
  });

  function generateSignature(orderId: string, paymentId: string): string {
    return crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  function generateWebhookSignature(body: string): string {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
  }

  async function createTestOrder() {
    // Use the REST API to create orders correctly (avoids schema field name issues)
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        restaurantId: restaurant.id,
        addressId: addressA.id.toString(),
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      });
    if (res.status !== 201) {
      throw new Error(`placeOrder failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const orderId = Number(res.body.data.id);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    return order!;
  }

  // =========================================================================
  // 1. PAYMENT ORDER CREATION (SERVER-AUTHORITATIVE)
  // =========================================================================

  describe('POST /payments/create-order', () => {
    it('should create a server-authoritative payment order successfully', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(order.id);
      expect(res.body.data.providerOrderId).toBeDefined();
      expect(res.body.data.keyId).toBeDefined();

      // Verify payment transaction in database
      const tx = await prisma.paymentTransaction.findFirst({
        where: { orderId: order.id },
      });
      expect(tx).toBeDefined();
      expect(tx?.status).toBe(PaymentStatus.PENDING);
    });

    it('should forbid user from creating payment for another user order', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ orderId: order.id })
        .expect(403);

      expect(res.body.message).toMatch(/permission/i);
    });

    it('should return 404 for nonexistent order', async () => {
      await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: 999999 })
        .expect(404);
    });

    it('should reject payment creation for already confirmed order', async () => {
      const order = await createTestOrder();
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED, paymentStatus: 'PAID' },
      });

      const res = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(400);

      expect(res.body.message).toMatch(/already been paid/i);
    });

    it('should reject unknown properties such as checkoutGroupId with 400 Bad Request', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id, checkoutGroupId: 'CG12345678' })
        .expect(400);

      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : String(res.body.message);
      expect(msg).toMatch(/property checkoutGroupId should not exist/i);
    });
  });

  // =========================================================================
  // 2. PAYMENT VERIFICATION & ORDER CONFIRMATION
  // =========================================================================

  describe('POST /payments/verify', () => {
    it('should reject invalid / tampered cryptographic signature', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;

      const res = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.id,
          providerOrderId,
          providerPaymentId: 'pay_tampered_123',
          providerSignature:
            'invalid_sha256_tampered_signature_hex_value_00000000000000000000',
        })
        .expect(400);

      expect(res.body.message).toMatch(/invalid payment signature/i);

      // Verify transaction was marked FAILED
      const tx = await prisma.paymentTransaction.findFirst({
        where: { orderId: order.id },
      });
      expect(tx?.status).toBe(PaymentStatus.FAILED);
      expect(tx?.failureCode).toBe('INVALID_SIGNATURE');

      // Verify order is still PENDING
      const checkOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(checkOrder?.status).toBe(OrderStatus.PENDING);
    });

    it('should verify valid signature, mark SUCCESS, and confirm order atomically', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_test_${Date.now()}`;
      const validSignature = generateSignature(providerOrderId, providerPaymentId);

      const res = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.id,
          providerOrderId,
          providerPaymentId,
          providerSignature: validSignature,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(OrderStatus.CONFIRMED);
      expect(res.body.data.paymentStatus).toBe('PAID');

      // Database verification
      const tx = await prisma.paymentTransaction.findFirst({
        where: { orderId: order.id },
      });
      expect(tx?.status).toBe(PaymentStatus.SUCCESS);
      expect(tx?.providerPaymentId).toBe(providerPaymentId);
      expect(tx?.paidAt).toBeDefined();

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder?.status).toBe(OrderStatus.CONFIRMED);
      expect(updatedOrder?.paymentStatus).toBe('PAID');
      expect(updatedOrder?.confirmedAt).toBeDefined();

      // OrderStatusHistory record
      const history = await prisma.orderStatusHistory.findFirst({
        where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED },
      });
      expect(history).toBeDefined();
      expect(history?.fromStatus).toBe(OrderStatus.PENDING);

      // Customer notification
      const notif = await prisma.notification.findFirst({
        where: { userId: customerA.id, type: 'ORDER_UPDATE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(notif).toBeDefined();
      expect(notif?.title).toBe('Order Confirmed');
    });

    it('should handle duplicate verification calls idempotently', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_idem_${Date.now()}`;
      const validSignature = generateSignature(providerOrderId, providerPaymentId);

      const dto = {
        orderId: order.id,
        providerOrderId,
        providerPaymentId,
        providerSignature: validSignature,
      };

      // 1st call
      await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send(dto)
        .expect(200);

      // 2nd identical call (same providerPaymentId)
      const res2 = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send(dto)
        .expect(200);

      expect(res2.body.success).toBe(true);
      expect(res2.body.message).toMatch(/already verified/i);

      // Ensure no duplicate status history entries
      const count = await prisma.orderStatusHistory.count({
        where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED },
      });
      expect(count).toBe(1);
    });

    it('should reject payment verification if transaction amount mismatches order total', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_amt_${Date.now()}`;
      const validSignature = generateSignature(providerOrderId, providerPaymentId);

      // Tamper with transaction amount in DB
      await prisma.paymentTransaction.updateMany({
        where: { providerOrderId },
        data: { amount: 1.00 }, // order is for much more
      });

      const res = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.id,
          providerOrderId,
          providerPaymentId,
          providerSignature: validSignature,
        })
        .expect(400);

      expect(res.body.message).toMatch(/amount mismatch/i);

      // Verify transaction was marked FAILED with AMOUNT_MISMATCH
      const tx = await prisma.paymentTransaction.findFirst({
        where: { providerOrderId },
      });
      expect(tx?.status).toBe(PaymentStatus.FAILED);
      expect(tx?.failureCode).toBe('AMOUNT_MISMATCH');
    });

    it('should reject payment verification if transaction currency is not INR', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_curr_${Date.now()}`;
      const validSignature = generateSignature(providerOrderId, providerPaymentId);

      // Tamper with currency in DB
      await prisma.paymentTransaction.updateMany({
        where: { providerOrderId },
        data: { currency: 'USD' },
      });

      const res = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.id,
          providerOrderId,
          providerPaymentId,
          providerSignature: validSignature,
        })
        .expect(400);

      expect(res.body.message).toMatch(/currency mismatch/i);
    });

    it('should reject unknown properties such as checkoutGroupId with 400 Bad Request', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.id,
          providerOrderId: 'order_dummy_123',
          providerPaymentId: 'pay_dummy_123',
          providerSignature: 'sig_dummy_123',
          checkoutGroupId: 'CG12345678',
        })
        .expect(400);

      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : String(res.body.message);
      expect(msg).toMatch(/property checkoutGroupId should not exist/i);
    });
  });

  // =========================================================================
  // 3. PAYMENT FAILURE RECORDING
  // =========================================================================

  describe('POST /payments/failure', () => {
    it('should record payment failure when user cancels', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;

      const res = await request(app.getHttpServer())
        .post('/payments/failure')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.id,
          providerOrderId,
          code: 'USER_CANCELLED',
          description: 'User dismissed payment modal',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const tx = await prisma.paymentTransaction.findFirst({
        where: { orderId: order.id },
      });
      expect(tx?.status).toBe(PaymentStatus.FAILED);
    });

    it('should reject unknown properties such as checkoutGroupId with 400 Bad Request', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post('/payments/failure')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.id,
          providerOrderId: 'order_dummy_123',
          checkoutGroupId: 'CG12345678',
        })
        .expect(400);

      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : String(res.body.message);
      expect(msg).toMatch(/property checkoutGroupId should not exist/i);
    });
  });

  // =========================================================================
  // 4. GET ORDER PAYMENTS & ACCESS CONTROL
  // =========================================================================

  describe('GET /payments/order/:orderId', () => {
    it('should retrieve payment transactions for order owner', async () => {
      const order = await createTestOrder();

      await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/payments/order/${order.id}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(order.id);
      expect(res.body.data.transactions).toHaveLength(1);
    });

    it('should return 403 when another user tries to view payment records', async () => {
      const order = await createTestOrder();

      await request(app.getHttpServer())
        .get(`/payments/order/${order.id}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .expect(403);
    });
  });

  // =========================================================================
  // 5. WEBHOOK ASYNCHRONOUS RECONCILIATION
  // =========================================================================

  describe('POST /payments/webhook', () => {
    it('should reject webhook request with invalid signature', async () => {
      const payload = JSON.stringify({ event: 'order.paid' });

      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', 'invalid_signature_hex')
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(400);
    });

    it('should successfully reconcile order.paid webhook event', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_wh_${Date.now()}`;

      const webhookPayload = JSON.stringify({
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              id: providerPaymentId,
              order_id: providerOrderId,
              amount: 30000,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      const signature = generateWebhookSignature(webhookPayload);

      const res = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload)
        .expect(200);

      // Webhook response is wrapped by TransformInterceptor
      const responseStatus = res.body?.data?.status ?? res.body?.status;
      expect(responseStatus).toBe('success');

      // Verify DB
      const tx = await prisma.paymentTransaction.findFirst({
        where: { providerOrderId },
      });
      expect(tx?.status).toBe(PaymentStatus.SUCCESS);
      expect(tx?.providerPaymentId).toBe(providerPaymentId);

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder?.status).toBe(OrderStatus.CONFIRMED);
      expect(updatedOrder?.paymentStatus).toBe('PAID');
    });

    it('should handle duplicate webhook safely (idempotent)', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_wh_dup_${Date.now()}`;

      const webhookPayload = JSON.stringify({
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              id: providerPaymentId,
              order_id: providerOrderId,
            },
          },
        },
      });
      const signature = generateWebhookSignature(webhookPayload);

      // 1st webhook call
      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload)
        .expect(200);

      // 2nd duplicate webhook call
      const res2 = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload)
        .expect(200);

      const status2 = res2.body?.data?.status ?? res2.body?.status;
      expect(status2).toBe('already_processed');

      // Ensure no duplicate status history entries
      const count = await prisma.orderStatusHistory.count({
        where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED },
      });
      expect(count).toBe(1);
    });

    it('should reject malformed JSON payload with 400 Bad Request', async () => {
      const malformed = '{"event": "order.paid", invalid_json';
      const signature = generateWebhookSignature(malformed);

      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(malformed)
        .expect(400);
    });

    it('should return transaction_not_found for unknown providerOrderId', async () => {
      const payload = JSON.stringify({
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              id: 'pay_unknown_123',
              order_id: 'order_nonexistent_999999',
            },
          },
        },
      });
      const signature = generateWebhookSignature(payload);

      const res = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(200);

      const status = res.body?.data?.status ?? res.body?.status;
      expect(status).toBe('transaction_not_found');
    });

    it('should record payment.failed event via webhook', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;

      const failPayload = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              order_id: providerOrderId,
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Card declined by issuing bank',
            },
          },
        },
      });
      const signature = generateWebhookSignature(failPayload);

      const res = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(failPayload)
        .expect(200);

      const status = res.body?.data?.status ?? res.body?.status;
      expect(status).toBe('failure_recorded');

      const tx = await prisma.paymentTransaction.findFirst({
        where: { providerOrderId },
      });
      expect(tx?.status).toBe(PaymentStatus.FAILED);
      expect(tx?.failureCode).toBe('BAD_REQUEST_ERROR');
    });

    it('should reconcile payment success webhook even after local failure state', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;

      // 1. Locally mark transaction as failed
      await prisma.paymentTransaction.updateMany({
        where: { providerOrderId },
        data: { status: PaymentStatus.FAILED, failureCode: 'LOCAL_TIMEOUT' },
      });

      // 2. Gateway sends order.paid webhook
      const providerPaymentId = `pay_recovery_${Date.now()}`;
      const webhookPayload = JSON.stringify({
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              id: providerPaymentId,
              order_id: providerOrderId,
            },
          },
        },
      });
      const signature = generateWebhookSignature(webhookPayload);

      const res = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload)
        .expect(200);

      const status = res.body?.data?.status ?? res.body?.status;
      expect(status).toBe('success');

      // Transaction is recovered to SUCCESS and order is CONFIRMED
      const tx = await prisma.paymentTransaction.findFirst({
        where: { providerOrderId },
      });
      expect(tx?.status).toBe(PaymentStatus.SUCCESS);

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder?.status).toBe(OrderStatus.CONFIRMED);
      expect(updatedOrder?.paymentStatus).toBe('PAID');
    });

    it('should handle verification + webhook race condition safely (exactly 1 confirmation)', async () => {
      const order = await createTestOrder();

      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId: order.id })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_race_${Date.now()}`;
      const validSignature = generateSignature(providerOrderId, providerPaymentId);

      const verifyDto = {
        orderId: order.id,
        providerOrderId,
        providerPaymentId,
        providerSignature: validSignature,
      };

      const webhookPayload = JSON.stringify({
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              id: providerPaymentId,
              order_id: providerOrderId,
            },
          },
        },
      });
      const webhookSig = generateWebhookSignature(webhookPayload);

      // Concurrent execution: simulate verifyPayment and webhook at the exact same moment
      const [verifyRes, webhookRes] = await Promise.all([
        request(app.getHttpServer())
          .post('/payments/verify')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send(verifyDto),
        request(app.getHttpServer())
          .post('/payments/webhook')
          .set('x-razorpay-signature', webhookSig)
          .set('Content-Type', 'application/json')
          .send(webhookPayload),
      ]);

      expect(verifyRes.status).toBe(200);
      expect(webhookRes.status).toBe(200);

      // Verify order is CONFIRMED and has exactly 1 OrderStatusHistory entry
      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder?.status).toBe(OrderStatus.CONFIRMED);
      expect(updatedOrder?.paymentStatus).toBe('PAID');

      const historyCount = await prisma.orderStatusHistory.count({
        where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED },
      });
      expect(historyCount).toBe(1);
    });
  });

  // =========================================================================
  // 6. COD & CART INTEGRITY AUDIT
  // =========================================================================

  describe('COD & Cart Integrity Audit', () => {
    it('should place COD order without Razorpay and keep status PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          restaurantId: restaurant.id,
          addressId: addressA.id.toString(),
          paymentMethod: 'COD',
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
        })
        .expect(201);

      const orderId = Number(res.body.data.id);
      const codOrder = await prisma.order.findUnique({ where: { id: orderId } });

      expect(codOrder?.status).toBe(OrderStatus.PENDING);
      expect(codOrder?.paymentStatus).toBe('PENDING');
      expect(codOrder?.paymentMethod).toBe('COD');

      // No successful payment transaction created
      const successfulTx = await prisma.paymentTransaction.findFirst({
        where: { orderId, status: PaymentStatus.SUCCESS },
      });
      expect(successfulTx).toBeNull();
    });

    it('should preserve server cart for online orders until payment verification succeeds', async () => {
      // 1. Create a cart with an item for customerA
      let cart = await prisma.cart.findUnique({ where: { userId: customerA.id } });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId: customerA.id, restaurantId: restaurant.id },
        });
      }
      await prisma.cartItem.create({
        data: { cartId: cart.id, menuItemId: menuItem.id, quantity: 2 },
      });

      // 2. Place an order for CARD payment
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          restaurantId: restaurant.id,
          addressId: addressA.id.toString(),
          paymentMethod: 'CARD',
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
        })
        .expect(201);

      const orderId = Number(orderRes.body.data.id);

      // Cart items must STILL be intact in database before payment!
      const cartItemsBefore = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });
      expect(cartItemsBefore.length).toBeGreaterThan(0);

      // 3. Initiate and verify payment
      const createRes = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ orderId })
        .expect(201);

      const providerOrderId = createRes.body.data.providerOrderId;
      const providerPaymentId = `pay_cart_${Date.now()}`;
      const sig = generateSignature(providerOrderId, providerPaymentId);

      await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId,
          providerOrderId,
          providerPaymentId,
          providerSignature: sig,
        })
        .expect(200);

      // Cart items must NOW be cleared from database!
      const cartItemsAfter = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });
      expect(cartItemsAfter).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 10. PAYMENT RATE LIMITING & WEBHOOK THROTTLING ENFORCEMENT
  // ==========================================================================
  describe('10. Payment Endpoint Rate Limiting and Throttle Policy Enforcement', () => {
    it('allows legitimate verification retries within limit and returns 429 when limit is exceeded', async () => {
      // Endpoint /payments/verify is decorated with @Throttle({ default: { limit: 20, ttl: 60000 } })
      // Rapid verification calls with unknown order will pass through guard until throttled.
      const responses: any[] = [];
      for (let i = 0; i < 22; i++) {
        const res = await request(app.getHttpServer())
          .post('/payments/verify')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({
            orderId: 999999,
            providerOrderId: 'order_fake',
            providerPaymentId: 'pay_fake',
            providerSignature: 'sig_fake',
          });
        responses.push(res);
      }

      const statuses = responses.map((r) => r.status);
      // The initial requests are processed by handler (returning 404 order not found), not 429
      expect(statuses[0]).toBe(404);
      // Requests exceeding the limit of 20 must return HTTP 429
      const has429 = statuses.includes(429);
      expect(has429).toBe(true);
      expect(statuses[statuses.length - 1]).toBe(429);
    });

    it('rejects unauthenticated requests before payment processing without leaking data', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/create-order')
        .send({ orderId: 1 })
        .expect(401);
      expect(res.body.statusCode).toBe(401);
    });

    it('enforces mandatory webhook signature validation before processing', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/webhook')
        .send({ event: 'payment.captured' })
        .expect(400);
      expect(res.body.message).toContain('Missing x-razorpay-signature');
    });
  });
});
