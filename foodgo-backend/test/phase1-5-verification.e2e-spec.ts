import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TokenService } from '../src/modules/auth/services/token.service.js';
import { validate } from '../src/config/env.validation.js';

describe('Phase 1.5 Integration & Security Verification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenService: TokenService;

  // Test entities
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let addressA: any;
  let addressB: any;
  let restaurant1: any;
  let restaurant2: any;
  let menuItem1: any;
  let unavailableItem: any;
  let otherMenuItem: any;
  let orderA: any;
  let orderB: any;

  const PHONE_A = '+14155557701';
  const PHONE_B = '+14155557702';

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

    // Sync sequence numbers in case seeds inserted explicit IDs
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('restaurants', 'id'), COALESCE(MAX(id), 1)) FROM "restaurants";`
    );
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('menu_items', 'id'), COALESCE(MAX(id), 1)) FROM "menu_items";`
    );

    // Initial clean-up for test phones
    const auths = await prisma.userAuth.findMany({
      where: { phone: { in: [PHONE_A, PHONE_B] } },
    });
    for (const auth of auths) {
      // Cascade deletes user's orders, addresses, etc.
      await prisma.user.delete({ where: { id: auth.userId } });
    }

    // Clean up test restaurants if leftover
    await prisma.restaurant.deleteMany({
      where: { name: { in: ['Phase1.5 Test Burger Joint', 'Phase1.5 Other Bistro'] } },
    });

    // 1. Seed User A and User B
    userA = await prisma.user.create({
      data: {
        type: 'CUSTOMER',
        name: 'Phase1.5 User A',
        auth: {
          create: {
            phone: PHONE_A,
            phoneVerified: true,
          },
        },
      },
    });

    userB = await prisma.user.create({
      data: {
        type: 'CUSTOMER',
        name: 'Phase1.5 User B',
        auth: {
          create: {
            phone: PHONE_B,
            phoneVerified: true,
          },
        },
      },
    });

    const tokensA = await tokenService.generateTokens({
      sub: userA.id.toString(),
      phone: PHONE_A,
    });
    tokenA = `Bearer ${tokensA.accessToken}`;

    const tokensB = await tokenService.generateTokens({
      sub: userB.id.toString(),
      phone: PHONE_B,
    });
    tokenB = `Bearer ${tokensB.accessToken}`;

    // 2. Seed Addresses
    addressA = await prisma.addresses.create({
      data: {
        user_id: userA.id,
        label: 'User A Home',
        address_line1: '100 User A Street',
        address_line2: 'Suite 1',
        landmark: 'Near Landmark A',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400001',
        country: 'India',
        latitude: 19.076,
        longitude: 72.8777,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    addressB = await prisma.addresses.create({
      data: {
        user_id: userB.id,
        label: 'User B Home',
        address_line1: '200 User B Road',
        address_line2: 'Apt 2B',
        landmark: 'Near Landmark B',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400002',
        country: 'India',
        latitude: 19.078,
        longitude: 72.88,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // 3. Seed Restaurants and Menu Items
    restaurant1 = await prisma.restaurant.create({
      data: {
        name: 'Phase1.5 Test Burger Joint',
        cuisineTypes: 'Burgers, American',
        deliveryTimeMin: 20,
        deliveryTimeMax: 30,
        deliveryFee: 40.0,
        isOpen: true,
        imageUrl: 'https://example.com/burger-joint.jpg',
      },
    });

    restaurant2 = await prisma.restaurant.create({
      data: {
        name: 'Phase1.5 Other Bistro',
        cuisineTypes: 'Italian',
        deliveryTimeMin: 25,
        deliveryTimeMax: 40,
        deliveryFee: 50.0,
        isOpen: true,
        imageUrl: 'https://example.com/bistro.jpg',
      },
    });

    menuItem1 = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant1.id,
        categoryName: 'Burgers',
        name: 'Classic Cheeseburger',
        description: 'Double cheese, fresh lettuce',
        price: 250.0,
        imageUrl: 'https://example.com/cheeseburger.jpg',
        isAvailable: true,
      },
    });

    unavailableItem = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant1.id,
        categoryName: 'Burgers',
        name: 'Truffle Burger (Sold Out)',
        description: 'Unavailable luxury burger',
        price: 450.0,
        imageUrl: 'https://example.com/truffle.jpg',
        isAvailable: false,
      },
    });

    otherMenuItem = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant2.id,
        categoryName: 'Pasta',
        name: 'Truffle Tagliatelle',
        description: 'From other restaurant',
        price: 350.0,
        imageUrl: 'https://example.com/pasta.jpg',
        isAvailable: true,
      },
    });
  });

  afterAll(async () => {
    // Thorough database cleanup
    try {
      if (userA?.id) {
        await prisma.order.deleteMany({ where: { userId: userA.id } });
        await prisma.addresses.deleteMany({ where: { user_id: userA.id } });
        await prisma.userAuth.deleteMany({ where: { userId: userA.id } });
        await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
      }
      if (userB?.id) {
        await prisma.order.deleteMany({ where: { userId: userB.id } });
        await prisma.addresses.deleteMany({ where: { user_id: userB.id } });
        await prisma.userAuth.deleteMany({ where: { userId: userB.id } });
        await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
      }
      if (restaurant1?.id) {
        await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant1.id } });
        await prisma.restaurant.delete({ where: { id: restaurant1.id } }).catch(() => {});
      }
      if (restaurant2?.id) {
        await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant2.id } });
        await prisma.restaurant.delete({ where: { id: restaurant2.id } }).catch(() => {});
      }
    } catch (err) {
      console.warn('Cleanup error:', err);
    }
    await app.close();
  });

  // ==========================================================================
  // 1. DATABASE MIGRATION VERIFICATION
  // ==========================================================================
  describe('1. Database Migration & Foreign Key Constraint', () => {
    it('verifies orders_address_id_fkey constraint has ON DELETE SET NULL and ON UPDATE CASCADE', async () => {
      const constraints: any[] = await prisma.$queryRawUnsafe(`
        SELECT 
          c.conname, 
          c.confdeltype, 
          c.confupdtype,
          t.relname AS tablename
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'orders_address_id_fkey';
      `);

      expect(constraints.length).toBe(1);
      const fk = constraints[0];
      expect(fk.conname).toBe('orders_address_id_fkey');
      expect(fk.tablename).toBe('orders');
      // PostgreSQL confdeltype: 'n' means SET NULL, 'c' means CASCADE, 'a' means RESTRICT/NO ACTION
      expect(fk.confdeltype).toBe('n');
      // confupdtype: 'c' means CASCADE
      expect(fk.confupdtype).toBe('c');
    });
  });

  // ==========================================================================
  // 2. REAL ADDRESS DELETE INTEGRATION TEST
  // ==========================================================================
  describe('2. Real Address Delete Integration Test', () => {
    it('deleting an address that is referenced by an existing order sets order.addressId to null without foreign key error', async () => {
      // 1. Create an address specifically for deletion test
      const tempAddress = await prisma.addresses.create({
        data: {
          user_id: userA.id,
          label: 'Temporary Address',
          address_line1: '999 Deletion Way',
          address_line2: 'Apt 9',
          landmark: 'Near Water Tower',
          city: 'Mumbai',
          state: 'Maharashtra',
          postal_code: '400099',
          country: 'India',
          latitude: 19.01,
          longitude: 72.82,
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // 2. Create an order referencing this address
      const testOrder = await prisma.order.create({
        data: {
          orderNumber: `DEL${Date.now().toString().slice(-8)}`,
          userId: userA.id,
          restaurantId: restaurant1.id,
          subtotal: 250.0,
          deliveryFee: 40.0,
          taxAmount: 12.5,
          grandTotal: 302.5,
          addressId: tempAddress.id,
          deliveryAddressText: '999 Deletion Way, Mumbai',
        },
      });

      // Verify order references tempAddress
      expect(testOrder.addressId).toEqual(tempAddress.id);

      // 3. Delete the address via API (DELETE /Address/:id)
      const res = await request(app.getHttpServer())
        .delete(`/Address/${tempAddress.id}`)
        .set('Authorization', tokenA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 4. Verify address is removed from database
      const deletedAddr = await prisma.addresses.findUnique({
        where: { id: tempAddress.id },
      });
      expect(deletedAddr).toBeNull();

      // 5. Verify order still exists and addressId became NULL
      const updatedOrder = await prisma.order.findUnique({
        where: { id: testOrder.id },
      });
      expect(updatedOrder).not.toBeNull();
      expect(updatedOrder!.addressId).toBeNull();

      // Clean up test order
      await prisma.order.delete({ where: { id: testOrder.id } });
    });
  });

  // ==========================================================================
  // 3. ADDRESS OWNERSHIP / IDOR TEST
  // ==========================================================================
  describe('3. Address Ownership / IDOR Protection', () => {
    it('allows User A to place an order with their own Address A', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressA.id.toString(),
          items: [{ menuItemId: menuItem1.id, quantity: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();

      orderA = await prisma.order.findUnique({
        where: { id: Number(res.body.data.id) },
      });
      expect(orderA).not.toBeNull();
      expect(orderA.userId).toEqual(userA.id);
      expect(orderA.addressId).toEqual(addressA.id);
    });

    it('rejects User A attempting to place an order with User B Address B (IDOR)', async () => {
      const ordersCountBefore = await prisma.order.count();

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressB.id.toString(),
          items: [{ menuItemId: menuItem1.id, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain(
        'Delivery address not found or does not belong to the authenticated user',
      );

      // Verify no order created
      const ordersCountAfter = await prisma.order.count();
      expect(ordersCountAfter).toBe(ordersCountBefore);

      // Verify no User B data was leaked in response
      const resText = JSON.stringify(res.body);
      expect(resText).not.toContain(PHONE_B);
      expect(resText).not.toContain('User B Home');
      expect(resText).not.toContain('200 User B Road');
    });
  });

  // ==========================================================================
  // 4. CROSS-USER ORDER ACCESS TEST
  // ==========================================================================
  describe('4. Cross-User Order Access Protection', () => {
    beforeAll(async () => {
      // User B creates an order
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenB)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressB.id.toString(),
          items: [{ menuItemId: menuItem1.id, quantity: 2 }],
        });
      expect(res.status).toBe(201);
      orderB = await prisma.order.findUnique({
        where: { id: Number(res.body.data.id) },
      });
      expect(orderB).not.toBeNull();
    });

    it('rejects User A attempting GET /orders/:orderBId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderB.id}`)
        .set('Authorization', tokenA);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('You do not have permission to view this order');
    });

    it('rejects User A attempting PATCH /orders/:orderBId/cancel', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderB.id}/cancel`)
        .set('Authorization', tokenA);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('You do not have permission to cancel this order');

      // Verify order status was NOT changed
      const orderBCheck = await prisma.order.findUnique({ where: { id: orderB.id } });
      expect(orderBCheck!.status).toBe('PENDING');
    });

    it('rejects User A attempting GET /orders/:orderBId/tracking', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderB.id}/tracking`)
        .set('Authorization', tokenA);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('rejects User A attempting POST /orders/:orderBId/reorder', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orders/${orderB.id}/reorder`)
        .set('Authorization', tokenA);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('rejects User A attempting POST /orders/:orderBId/review', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orders/${orderB.id}/review`)
        .set('Authorization', tokenA)
        .send({ rating: 5, comment: 'Malicious review from User A' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');

      // Verify no review was created
      const reviews = await prisma.review.findMany({ where: { orderId: orderB.id } });
      expect(reviews.length).toBe(0);
    });
  });

  // ==========================================================================
  // 5. PRICE INTEGRITY INTEGRATION TEST
  // ==========================================================================
  describe('5. Price Integrity Integration Test', () => {
    it('rejects or ignores manipulated client-provided prices, calculating exclusively from database', async () => {
      // Menu item 1 price in DB: 250.00
      // Restaurant 1 delivery fee in DB: 40.00
      // Quantity: 2 => Subtotal: 500.00, Tax (5%): 25.00, Delivery: 40.00 => GrandTotal: 565.00
      // Client attempts to inject 1.00 for all price fields:
      const manipulatedPayload = {
        restaurantId: restaurant1.id,
        addressId: addressA.id.toString(),
        items: [{ menuItemId: menuItem1.id, quantity: 2 }],
        unitPrice: 1.0,
        subtotal: 1.0,
        taxAmount: 0.0,
        deliveryFee: 0.0,
        grandTotal: 1.0,
      };

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send(manipulatedPayload);

      if (res.status === 400) {
        // Whitelist validation rejected client price injection fields
        expect(res.body.success).toBe(false);
      } else {
        // If accepted, verify persisted amounts strictly match DB calculations, NOT client 1.00
        expect(res.status).toBe(201);
        const orderId = Number(res.body.data.id);
        const persisted = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        expect(persisted).not.toBeNull();
        expect(Number(persisted!.subtotal)).toBe(500.0);
        expect(Number(persisted!.taxAmount)).toBe(25.0);
        expect(Number(persisted!.deliveryFee)).toBe(40.0);
        expect(Number(persisted!.grandTotal)).toBe(565.0);
        expect(Number(persisted!.items[0].price)).toBe(250.0);

        // Clean up
        await prisma.order.delete({ where: { id: orderId } });
      }
    });
  });

  // ==========================================================================
  // 6. CART / ORDER VALIDATION
  // ==========================================================================
  describe('6. Cart / Order Validation', () => {
    it('rejects order with quantity = 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressA.id.toString(),
          items: [{ menuItemId: menuItem1.id, quantity: 0 }],
        });

      expect(res.status).toBe(400);
    });

    it('rejects order with negative quantity', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressA.id.toString(),
          items: [{ menuItemId: menuItem1.id, quantity: -2 }],
        });

      expect(res.status).toBe(400);
    });

    it('rejects order with unavailable item (isAvailable: false)', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressA.id.toString(),
          items: [{ menuItemId: unavailableItem.id, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('unavailable or do not belong to this restaurant');
    });

    it('rejects order with menu item belonging to another restaurant', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressA.id.toString(),
          items: [{ menuItemId: otherMenuItem.id, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('unavailable or do not belong to this restaurant');
    });

    it('rejects order with nonexistent menu item (id: 999999)', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressA.id.toString(),
          items: [{ menuItemId: 999999, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('unavailable or do not belong to this restaurant');
    });

    it('tests empty items array behavior', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', tokenA)
        .send({
          restaurantId: restaurant1.id,
          addressId: addressA.id.toString(),
          items: [],
        });

      console.log('EMPTY ITEMS RESPONSE STATUS:', res.status, JSON.stringify(res.body));

      if (res.status === 201) {
        const createdId = Number(res.body.data.id);
        await prisma.order.delete({ where: { id: createdId } });
      }
      expect([201, 400]).toContain(res.status);
    });
  });

  // ==========================================================================
  // 7. JWT ENVIRONMENT SECURITY
  // ==========================================================================
  describe('7. JWT Environment Security Verification', () => {
    it('refuses to start / throws error when JWT_ACCESS_SECRET is missing', () => {
      expect(() => {
        validate({
          JWT_REFRESH_SECRET: 'super-secure-refresh-key-minimum-entropy',
        });
      }).toThrow('JWT_ACCESS_SECRET must be defined in environment variables');
    });

    it('refuses to start / throws error when JWT_REFRESH_SECRET is missing', () => {
      expect(() => {
        validate({
          JWT_ACCESS_SECRET: 'super-secure-access-key-minimum-entropy',
        });
      }).toThrow('JWT_REFRESH_SECRET must be defined in environment variables');
    });

    it('refuses to start / throws error when both secrets are identical', () => {
      const sharedSecret = 'identical-secret-shared-between-access-and-refresh';
      expect(() => {
        validate({
          JWT_ACCESS_SECRET: sharedSecret,
          JWT_REFRESH_SECRET: sharedSecret,
        });
      }).toThrow(
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different secret keys',
      );
    });

    it('accepts valid distinct secrets successfully', () => {
      const result = validate({
        JWT_ACCESS_SECRET: 'distinct-production-grade-access-secret-123456',
        JWT_REFRESH_SECRET: 'distinct-production-grade-refresh-secret-789012',
      });
      expect(result).toBeDefined();
      expect(result.JWT_ACCESS_SECRET).toBeDefined();
      expect(result.JWT_REFRESH_SECRET).toBeDefined();
    });
  });

  // ==========================================================================
  // 10. RATE LIMITING VERIFICATION
  // ==========================================================================
  describe('10. Sensitive Endpoint Rate Limiting', () => {
    it('enforces rate limit: accepts requests within limit, returns 429 on exceeding limit', async () => {
      // Endpoint /auth/phone/send-otp is decorated with @Throttle({ default: { limit: 5, ttl: 60000 } })
      // Send 5 rapid requests with invalid body (returns 400 validation error, not throttled)
      const responses: any[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(app.getHttpServer())
          .post('/auth/phone/send-otp')
          .send({ phone: '+14155558888' });
        responses.push(res);
      }

      const statuses = responses.map((r) => r.status);
      // The 6th or 7th request must trigger HTTP 429 Too Many Requests
      const has429 = statuses.includes(429);
      expect(has429).toBe(true);
    });
  });
});
