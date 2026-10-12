import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TokenService } from '../src/modules/auth/services/token.service.js';
import { OrderStatus, UserType } from '../src/generated/prisma/client.js';

describe('Phase 2A — Real Order Lifecycle + Admin/Operations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenService: TokenService;

  let adminUser: any;
  let customerA: any;
  let customerB: any;

  let adminToken: string;
  let customerAToken: string;
  let customerBToken: string;

  let restaurant: any;
  let menuItem1: any;
  let menuItem2: any;
  let addressA: any;

  const PHONE_ADMIN = '+14155558801';
  const PHONE_CUST_A = '+14155558802';
  const PHONE_CUST_B = '+14155558803';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    // Clean up test users
    const existingAuths = await prisma.userAuth.findMany({
      where: { phone: { in: [PHONE_ADMIN, PHONE_CUST_A, PHONE_CUST_B] } },
    });
    for (const auth of existingAuths) {
      await prisma.user.delete({ where: { id: auth.userId } });
    }

    // 1. Create Admin User
    adminUser = await prisma.user.create({
      data: {
        type: UserType.ADMIN,
        name: 'Super Admin',
        email: 'admin.lifecycle@foodgo.test',
        auth: {
          create: {
            phone: PHONE_ADMIN,
            phoneVerified: true,
          },
        },
      },
      include: { auth: true },
    });
    const adminTokens = await tokenService.generateTokens({
      sub: adminUser.id.toString(),
      phone: PHONE_ADMIN,
      type: UserType.ADMIN,
      status: adminUser.status,
    });
    adminToken = adminTokens.accessToken;

    // 2. Create Customer A
    customerA = await prisma.user.create({
      data: {
        type: UserType.CUSTOMER,
        name: 'Alice Customer',
        email: 'alice.lifecycle@foodgo.test',
        auth: {
          create: {
            phone: PHONE_CUST_A,
            phoneVerified: true,
          },
        },
      },
      include: { auth: true },
    });
    const tokensA = await tokenService.generateTokens({
      sub: customerA.id.toString(),
      phone: PHONE_CUST_A,
      type: UserType.CUSTOMER,
      status: customerA.status,
    });
    customerAToken = tokensA.accessToken;

    // 3. Create Customer B
    customerB = await prisma.user.create({
      data: {
        type: UserType.CUSTOMER,
        name: 'Bob Customer',
        email: 'bob.lifecycle@foodgo.test',
        auth: {
          create: {
            phone: PHONE_CUST_B,
            phoneVerified: true,
          },
        },
      },
      include: { auth: true },
    });
    const tokensB = await tokenService.generateTokens({
      sub: customerB.id.toString(),
      phone: PHONE_CUST_B,
      type: UserType.CUSTOMER,
      status: customerB.status,
    });
    customerBToken = tokensB.accessToken;

    // 4. Create Restaurant and Menu Items
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'Lifecycle Bistro',
        cuisineTypes: 'Burgers, American',
        rating: 4.8,
        reviewCount: '10',
        deliveryTimeMin: 20,
        deliveryTimeMax: 30,
        deliveryFee: 30,
        imageUrl: 'https://example.com/bistro.jpg',
        isOpen: true,
      },
    });

    menuItem1 = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryName: 'Mains',
        name: 'Truffle Burger',
        description: 'Gourmet burger with truffle oil',
        price: 250,
        imageUrl: 'https://example.com/tb.jpg',
        isAvailable: true,
      },
    });

    menuItem2 = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryName: 'Drinks',
        name: 'Iced Latte',
        description: 'Cold brew latte',
        price: 120,
        imageUrl: 'https://example.com/latte.jpg',
        isAvailable: true,
      },
    });

    // 5. Create Address for Customer A
    addressA = await prisma.addresses.create({
      data: {
        user_id: customerA.id,
        label: 'Home',
        address_line1: '100 Sunset Blvd',
        address_line2: 'Apt 4B',
        landmark: 'Near Central Park',
        city: 'Metropolis',
        state: 'CA',
        postal_code: '90001',
        country: 'USA',
        latitude: 34.0522,
        longitude: -118.2437,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    const testUserIds = [adminUser?.id, customerA?.id, customerB?.id].filter(Boolean);
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
    if (restaurant) {
      await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => {});
    }
    await app.close();
  });

  // Helper to place an order as Customer A
  async function placeTestOrder(): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        restaurantId: restaurant.id,
        addressId: addressA.id.toString(),
        items: [{ menuItemId: menuItem1.id, quantity: 1 }],
      });
    if (res.status !== 201) {
      console.error('PLACE ORDER ERROR:', res.status, res.body);
    }
    expect(res.status).toBe(201);
    return Number(res.body.data.id);
  }

  // ─── 1. Security Tests (Phase 2A.16) ─────────────────────────────────────────

  describe('1. Security & Role Authorization (Phase 2A.16)', () => {
    let testOrderId: number;

    beforeEach(async () => {
      testOrderId = await placeTestOrder();
    });

    it('CUSTOMER ❌ cannot PATCH /orders/:id/status (Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      expect(res.status).toBe(403);
    });

    it('CUSTOMER ❌ cannot access GET /admin/orders (Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
    });

    it('CUSTOMER ❌ cannot access GET /admin/orders/:id (Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
    });

    it('CUSTOMER ❌ cannot access PATCH /admin/orders/:id/status (Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      expect(res.status).toBe(403);
    });

    it('ADMIN ✅ can change PENDING -> CONFIRMED via /orders/:id/status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.CONFIRMED);
    });

    it('ADMIN ❌ cannot jump PENDING -> DELIVERED (Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.DELIVERED });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot transition order status');
    });

    it('CUSTOMER A ❌ cannot cancel Customer B order (Forbidden)', async () => {
      // Create order for Customer B
      const orderBRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ menuItemId: menuItem2.id, quantity: 1 }],
        })
        .expect(201);
      const orderBId = Number(orderBRes.body.data.id);

      // Customer A tries to cancel Customer B's order
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderBId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── 2. State Machine Tests (Phase 2A.17) ─────────────────────────────────────

  describe('2. State Machine Transitions (Phase 2A.17)', () => {
    it('executes the complete forward lifecycle: PENDING -> CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED', async () => {
      const orderId = await placeTestOrder();

      // 1. Initial status is PENDING
      const initial = await prisma.order.findUnique({ where: { id: orderId } });
      expect(initial?.status).toBe(OrderStatus.PENDING);

      // Verify initial status history recorded upon placement
      const initialHistory = await prisma.orderStatusHistory.findMany({
        where: { orderId },
      });
      expect(initialHistory.length).toBeGreaterThanOrEqual(1);
      expect(initialHistory[0].toStatus).toBe(OrderStatus.PENDING);

      // 2. PENDING -> CONFIRMED
      const res1 = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED, reason: 'Kitchen confirmed order' })
        .expect(200);

      expect(res1.body.data.status).toBe(OrderStatus.CONFIRMED);
      expect(res1.body.data.confirmedAt).toBeDefined();

      // Check DB confirmedAt
      const orderConf = await prisma.order.findUnique({ where: { id: orderId } });
      expect(orderConf?.confirmedAt).not.toBeNull();

      // 3. CONFIRMED -> PREPARING
      const res2 = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PREPARING })
        .expect(200);

      expect(res2.body.data.status).toBe(OrderStatus.PREPARING);
      expect(res2.body.data.preparingAt).toBeDefined();

      // 4. PREPARING -> OUT_FOR_DELIVERY
      const res3 = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.OUT_FOR_DELIVERY })
        .expect(200);

      expect(res3.body.data.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
      expect(res3.body.data.outForDeliveryAt).toBeDefined();

      // 5. OUT_FOR_DELIVERY -> DELIVERED
      const res4 = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(200);

      expect(res4.body.data.status).toBe(OrderStatus.DELIVERED);
      expect(res4.body.data.deliveredAt).toBeDefined();
      expect(res4.body.data.completedAt).toBeDefined();

      // Verify all timestamps exist in PostgreSQL
      const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(finalOrder?.confirmedAt).not.toBeNull();
      expect(finalOrder?.preparingAt).not.toBeNull();
      expect(finalOrder?.outForDeliveryAt).not.toBeNull();
      expect(finalOrder?.deliveredAt).not.toBeNull();
      expect(finalOrder?.completedAt).not.toBeNull();

      // Verify status history trail
      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });
      const transitions = history.map((h) => `${h.fromStatus ?? 'NULL'} -> ${h.toStatus}`);
      expect(transitions).toContain('NULL -> PENDING');
      expect(transitions).toContain('PENDING -> CONFIRMED');
      expect(transitions).toContain('CONFIRMED -> PREPARING');
      expect(transitions).toContain('PREPARING -> OUT_FOR_DELIVERY');
      expect(transitions).toContain('OUT_FOR_DELIVERY -> DELIVERED');

      // Verify in-app notifications generated for customer
      const notifs = await prisma.notification.findMany({
        where: { userId: customerA.id, orderId },
      });
      const titles = notifs.map((n) => n.title);
      expect(titles).toContain('Order Confirmed');
      expect(titles).toContain('Order Preparing');
      expect(titles).toContain('Order Out for Delivery');
      expect(titles).toContain('Order Delivered');
    });

    it('allows cancellation: PENDING -> CANCELLED by customer', async () => {
      const orderId = await placeTestOrder();

      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
      expect(res.body.data.cancelledAt).toBeDefined();

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe(OrderStatus.CANCELLED);
      expect(order?.cancelledAt).not.toBeNull();

      // Cancelled notification
      const notif = await prisma.notification.findFirst({
        where: { userId: customerA.id, orderId, title: 'Order Cancelled' },
      });
      expect(notif).not.toBeNull();
    });

    it('allows cancellation: CONFIRMED -> CANCELLED by admin', async () => {
      const orderId = await placeTestOrder();

      // PENDING -> CONFIRMED
      await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(200);

      // CONFIRMED -> CANCELLED
      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CANCELLED, reason: 'Customer requested cancellation' })
        .expect(200);

      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
      expect(res.body.data.cancelledAt).toBeDefined();
    });

    it('rejects invalid transitions: DELIVERED -> PREPARING', async () => {
      const orderId = await placeTestOrder();

      // Move to DELIVERED
      await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED });
      await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PREPARING });
      await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.OUT_FOR_DELIVERY });
      await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.DELIVERED });

      // DELIVERED -> PREPARING (must fail)
      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PREPARING });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot transition order status');
    });

    it('rejects invalid transitions: DELIVERED -> CANCELLED', async () => {
      const orderId = await placeTestOrder();

      // Fast forward to DELIVERED in DB
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
      });

      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CANCELLED });

      expect(res.status).toBe(400);
    });

    it('rejects invalid transitions: CANCELLED -> CONFIRMED', async () => {
      const orderId = await placeTestOrder();

      // Cancel order
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      // Try CANCELLED -> CONFIRMED
      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      expect(res.status).toBe(400);
    });
  });

  // ─── 3. Review Dependency (Phase 2A.10) ───────────────────────────────────────

  describe('3. Review Dependency on DELIVERED status (Phase 2A.10)', () => {
    it('rejects review when order is PENDING', async () => {
      const orderId = await placeTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: 'Premature review' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You can only review delivered orders');
    });

    it('rejects review when order is CONFIRMED', async () => {
      const orderId = await placeTestOrder();
      await request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: 'Premature review' });

      expect(res.status).toBe(400);
    });

    it('rejects review when order is PREPARING', async () => {
      const orderId = await placeTestOrder();
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PREPARING },
      });

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: 'Premature review' });

      expect(res.status).toBe(400);
    });

    it('rejects review when order is OUT_FOR_DELIVERY', async () => {
      const orderId = await placeTestOrder();
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
      });

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: 'Premature review' });

      expect(res.status).toBe(400);
    });

    it('rejects review when order is CANCELLED', async () => {
      const orderId = await placeTestOrder();
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`);

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 1, comment: 'Cancelled review' });

      expect(res.status).toBe(400);
    });

    it('allows review only when order is DELIVERED', async () => {
      const orderId = await placeTestOrder();
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
      });

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: 'Excellent food and quick delivery!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
    });
  });

  // ─── 4. Admin Order Management Endpoints (Phase 2A.12 & 2A.13) ───────────────

  describe('4. Admin Order List & Details (Phase 2A.12 & 2A.13)', () => {
    let testOrderId: number;

    beforeAll(async () => {
      testOrderId = await placeTestOrder();
    });

    it('GET /admin/orders returns paginated orders with customer info and safe fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);

      // Verify no sensitive credentials leaked
      const orderStr = JSON.stringify(res.body.data.orders);
      expect(orderStr).not.toContain('otpHash');
      expect(orderStr).not.toContain('tokenHash');
      expect(orderStr).not.toContain('password');
    });

    it('GET /admin/orders supports filtering by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/orders?status=DELIVERED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const order of res.body.data.orders) {
        expect(order.status).toBe(OrderStatus.DELIVERED);
      }
    });

    it('GET /admin/orders/:id returns full order details, customer, and status history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testOrderId.toString());
      expect(res.body.data.customer).toBeDefined();
      expect(res.body.data.customer.name).toBe('Alice Customer');
      expect(res.body.data.restaurant).toBeDefined();
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.statusHistory).toBeDefined();
      expect(Array.isArray(res.body.data.statusHistory)).toBe(true);
    });
  });

  // ─── 5. Concurrency Test (Phase 2A.18) ────────────────────────────────────────

  describe('5. Concurrency & Race Condition Protection (Phase 2A.18)', () => {
    it('safely handles simultaneous transitions (PENDING -> CONFIRMED vs PENDING -> CANCELLED)', async () => {
      const orderId = await placeTestOrder();

      // Dispatch two concurrent status transition requests
      const reqConfirm = request(app.getHttpServer())
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      const reqCancel = request(app.getHttpServer())
        .patch(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`);

      const [resConfirm, resCancel] = await Promise.all([reqConfirm, reqCancel]);

      const statuses = [resConfirm.status, resCancel.status];

      // Exactly ONE must succeed (200), and the other must be rejected (400 or 409)
      const successCount = statuses.filter((s) => s === 200).length;
      expect(successCount).toBe(1);

      // Verify the database ends in exactly ONE valid state
      const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect([OrderStatus.CONFIRMED, OrderStatus.CANCELLED]).toContain(finalOrder?.status);

      // Verify status history does not contain impossible or conflicting transitions
      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

      // Exactly 2 history records: initial PENDING, and the winning transition
      expect(history.length).toBe(2);
      expect(history[0].toStatus).toBe(OrderStatus.PENDING);
      expect([OrderStatus.CONFIRMED, OrderStatus.CANCELLED]).toContain(history[1].toStatus);
    });
  });

  // ─── 6. Customer Order Flow Regression (Phase 2A.15) ─────────────────────────

  describe('6. Customer Order Flow Regression (Phase 2A.15)', () => {
    it('customer can get user orders, get order by id, get tracking, and reorder', async () => {
      const orderId = await placeTestOrder();

      // GET /orders
      const ordersRes = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);
      expect(ordersRes.body.success).toBe(true);
      expect(ordersRes.body.data.some((o: any) => o.id === orderId.toString())).toBe(true);

      // GET /orders/:id
      const detailRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);
      expect(detailRes.body.success).toBe(true);
      expect(detailRes.body.data.id).toBe(orderId.toString());

      // GET /orders/:id/tracking
      const trackingRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}/tracking`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);
      expect(trackingRes.body.success).toBe(true);
      expect(trackingRes.body.data.orderId).toBe(orderId.toString());

      // POST /orders/:id/reorder
      const reorderRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/reorder`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(201);
      expect(reorderRes.body.success).toBe(true);
      expect(reorderRes.body.data.items.length).toBeGreaterThan(0);
    });
  });
});
