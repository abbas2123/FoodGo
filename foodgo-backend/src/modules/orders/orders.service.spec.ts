import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrderStatus, UserType } from '../../generated/prisma/client.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaMock: any;
  let notificationsMock: any;

  const mockUserAId = 100n;
  const mockUserBId = 200n;

  const mockAddressUserA = {
    id: 10n,
    user_id: mockUserAId,
    label: 'Home',
    address_line1: '123 Main St',
    city: 'Metropolis',
    state: 'NY',
    postal_code: '10001',
    country: 'USA',
    latitude: 40.7128,
    longitude: -74.006,
    is_default: true,
  };

  const mockRestaurant = {
    id: 1,
    name: 'Test Burger Shack',
    isOpen: true,
    deliveryFee: 40,
    isFreeDelivery: false,
    imageUrl: 'https://example.com/burger.jpg',
  };

  const mockMenuItem1 = {
    id: 101,
    restaurantId: 1,
    name: 'Classic Cheeseburger',
    price: 150,
    isAvailable: true,
    imageUrl: 'https://example.com/cheese.jpg',
  };

  beforeEach(async () => {
    prismaMock = {
      restaurant: {
        findUnique: vi.fn(),
      },
      menuItem: {
        findMany: vi.fn(),
      },
      addresses: {
        findFirst: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      orderStatusHistory: {
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      cart: {
        findUnique: vi.fn(),
      },
      cartItem: {
        deleteMany: vi.fn(),
      },
      review: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prismaMock)),
    };

    notificationsMock = {
      createNotification: vi.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('placeOrder - Address Ownership & IDOR Protection', () => {
    it('should place order successfully when address belongs to authenticated user', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);

      const createdOrder = {
        id: 1,
        orderNumber: 'FG12345678',
        userId: mockUserAId,
        restaurantId: 1,
        status: OrderStatus.PENDING,
        subtotal: 150,
        taxAmount: 7.5,
        deliveryFee: 40,
        grandTotal: 197.5,
        addressId: 10n,
        createdAt: new Date(),
        items: [{ id: 1, name: 'Classic Cheeseburger', price: 150, quantity: 1, imageUrl: 'https://example.com/img.jpg' }],
        restaurant: { name: 'Test Burger Shack', imageUrl: 'https://example.com/burger.jpg' },
      };
      prismaMock.order.create.mockResolvedValue(createdOrder);
      prismaMock.cart.findUnique.mockResolvedValue(null);

      const dto = {
        restaurantId: 1,
        addressId: '10',
        items: [{ menuItemId: 101, quantity: 1 }],
      };

      const result = await service.placeOrder(mockUserAId, dto);

      expect(prismaMock.addresses.findFirst).toHaveBeenCalledWith({
        where: { id: 10n, user_id: mockUserAId },
      });
      expect(result).toBeDefined();
      expect(result.data.id).toBe('1');
    });

    it('should reject order if address belongs to another user (User A trying User B address)', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      // findFirst with user_id: mockUserAId returns null because address 20n belongs to User B
      prismaMock.addresses.findFirst.mockResolvedValue(null);

      const dto = {
        restaurantId: 1,
        addressId: '20', // User B address ID
        items: [{ menuItemId: 101, quantity: 1 }],
      };

      await expect(service.placeOrder(mockUserAId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.order.create).not.toHaveBeenCalled();
    });

    it('should calculate order prices server-side ignoring client prices', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]); // DB price = 150

      const createdOrder = {
        id: 2,
        orderNumber: 'FG12345679',
        userId: mockUserAId,
        restaurantId: 1,
        status: OrderStatus.PENDING,
        subtotal: 300, // 150 * 2
        taxAmount: 15, // 5% of 300
        deliveryFee: 40,
        grandTotal: 355,
        createdAt: new Date(),
        items: [{ id: 2, name: 'Classic Cheeseburger', price: 150, quantity: 2, imageUrl: 'https://example.com/img.jpg' }],
        restaurant: { name: 'Test Burger Shack', imageUrl: 'https://example.com/burger.jpg' },
      };
      prismaMock.order.create.mockResolvedValue(createdOrder);
      prismaMock.cart.findUnique.mockResolvedValue(null);

      const dto = {
        restaurantId: 1,
        // Client sends bogus price field attempt
        items: [{ menuItemId: 101, quantity: 2, price: 10 } as any],
      };

      const result = await service.placeOrder(mockUserAId, dto);

      expect(result.data.bill.grandTotal).toBe(355);
      expect(prismaMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 300,
            taxAmount: 15,
            deliveryFee: 40,
            grandTotal: 355,
          }),
        }),
      );
    });

    it('should reject order if restaurant is closed', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue({
        ...mockRestaurant,
        isOpen: false,
      });

      const dto = {
        restaurantId: 1,
        items: [{ menuItemId: 101, quantity: 1 }],
      };

      await expect(service.placeOrder(mockUserAId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject order if one or more menu items are unavailable', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([]); // item not found or unavailable

      const dto = {
        restaurantId: 1,
        items: [{ menuItemId: 101, quantity: 1 }],
      };

      await expect(service.placeOrder(mockUserAId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Order Access Control & Cross-User Security', () => {
    const mockOrderUserB = {
      id: 50,
      orderNumber: 'FG99999999',
      userId: mockUserBId,
      restaurantId: 1,
      status: OrderStatus.PENDING,
      subtotal: 200,
      taxAmount: 10,
      deliveryFee: 40,
      grandTotal: 250,
      currencySymbol: '₹',
      createdAt: new Date(),
      items: [],
      restaurant: { name: 'Test Burger Shack', imageUrl: 'https://example.com/img.jpg' },
      address: null,
    };

    it('should reject User A requesting User B order details (getOrderById)', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderUserB);

      await expect(service.getOrderById(mockUserAId, 50)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject User A trying to cancel User B order (cancelOrder)', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderUserB);

      await expect(service.cancelOrder(mockUserAId, 50)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject User A requesting User B order tracking (getOrderTracking)', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderUserB);

      await expect(service.getOrderTracking(mockUserAId, UserType.CUSTOMER, 50)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject User A reordering User B order (reorder)', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderUserB);

      await expect(service.reorder(mockUserAId, 50)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateOrderStatus - Order Lifecycle & State Machine', () => {
    const mockPendingOrder = {
      id: 1,
      orderNumber: 'FG12345678',
      userId: mockUserAId,
      restaurantId: 1,
      status: OrderStatus.PENDING,
      subtotal: 150,
      taxAmount: 7.5,
      deliveryFee: 40,
      grandTotal: 197.5,
      currencySymbol: '₹',
      createdAt: new Date(),
      items: [],
      restaurant: { name: 'Burger Shack', imageUrl: 'https://example.com/b.jpg' },
      statusHistory: [],
    };

    it('allows Admin to transition PENDING -> CONFIRMED', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockPendingOrder);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...mockPendingOrder,
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
      });

      const res = await service.updateOrderStatus(999n, 1, OrderStatus.CONFIRMED);

      expect(res.success).toBe(true);
      expect(res.data.status).toBe(OrderStatus.CONFIRMED);
      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 1,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CONFIRMED,
          changedByUserId: 999n,
        }),
      });
      expect(notificationsMock.createNotification).toHaveBeenCalled();
    });

    it('rejects invalid jump PENDING -> DELIVERED', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockPendingOrder);

      await expect(
        service.updateOrderStatus(999n, 1, OrderStatus.DELIVERED),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid transition DELIVERED -> PREPARING', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...mockPendingOrder,
        status: OrderStatus.DELIVERED,
      });

      await expect(
        service.updateOrderStatus(999n, 1, OrderStatus.PREPARING),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid transition CANCELLED -> CONFIRMED', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...mockPendingOrder,
        status: OrderStatus.CANCELLED,
      });

      await expect(
        service.updateOrderStatus(999n, 1, OrderStatus.CONFIRMED),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles concurrent race condition by throwing ConflictException when count === 0', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockPendingOrder);
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 }); // another request updated status first

      await expect(
        service.updateOrderStatus(999n, 1, OrderStatus.CONFIRMED),
      ).rejects.toThrow();
    });
  });

  describe('cancelOrder - Cancellation Validation', () => {
    const mockDeliveredOrder = {
      id: 2,
      orderNumber: 'FG87654321',
      userId: mockUserAId,
      status: OrderStatus.DELIVERED,
    };

    const mockPreparingOrder = {
      id: 3,
      orderNumber: 'FG11223344',
      userId: mockUserAId,
      status: OrderStatus.PREPARING,
    };

    it('rejects cancelling a DELIVERED order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockDeliveredOrder);

      await expect(service.cancelOrder(mockUserAId, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects cancelling a PREPARING order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockPreparingOrder);

      await expect(service.cancelOrder(mockUserAId, 3)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submitReview - DELIVERED status prerequisite', () => {
    it('rejects review submission for PENDING order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 1,
        userId: mockUserAId,
        status: OrderStatus.PENDING,
        review: null,
      });

      await expect(
        service.submitReview(mockUserAId, 1, 5, 'Great!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects review submission for CONFIRMED order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 1,
        userId: mockUserAId,
        status: OrderStatus.CONFIRMED,
        review: null,
      });

      await expect(
        service.submitReview(mockUserAId, 1, 5, 'Great!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects review submission for PREPARING order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 1,
        userId: mockUserAId,
        status: OrderStatus.PREPARING,
        review: null,
      });

      await expect(
        service.submitReview(mockUserAId, 1, 5, 'Great!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects review submission for OUT_FOR_DELIVERY order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 1,
        userId: mockUserAId,
        status: OrderStatus.OUT_FOR_DELIVERY,
        review: null,
      });

      await expect(
        service.submitReview(mockUserAId, 1, 5, 'Great!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects review submission for CANCELLED order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 1,
        userId: mockUserAId,
        status: OrderStatus.CANCELLED,
        review: null,
      });

      await expect(
        service.submitReview(mockUserAId, 1, 5, 'Great!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAdminOrders & getAdminOrderById', () => {
    it('returns paginated admin orders with customer and item details', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 1,
          orderNumber: 'FG12345678',
          userId: mockUserAId,
          status: OrderStatus.CONFIRMED,
          grandTotal: 250,
          currencySymbol: '₹',
          paymentStatus: 'PAID',
          createdAt: new Date(),
          updatedAt: new Date(),
          restaurant: { id: 1, name: 'Burger Shack' },
          items: [{ id: 1, name: 'Burger', quantity: 2, price: 100 }],
        },
      ]);
      prismaMock.order.count.mockResolvedValue(1);
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: mockUserAId,
          name: 'Alice',
          email: 'alice@example.com',
          auth: { phone: '+919876543210' },
        },
      ]);

      const result = await service.getAdminOrders({ page: 1, limit: 10 });
      expect(result.success).toBe(true);
      expect(result.data.orders).toHaveLength(1);
      expect(result.data.orders[0].customer.name).toBe('Alice');
      expect(result.data.pagination.total).toBe(1);
    });

    it('returns admin order details with statusHistory and timestamps', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 1,
        orderNumber: 'FG12345678',
        userId: mockUserAId,
        status: OrderStatus.CONFIRMED,
        subtotal: 200,
        taxAmount: 10,
        deliveryFee: 40,
        grandTotal: 250,
        currencySymbol: '₹',
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmedAt: new Date(),
        restaurant: { id: 1, name: 'Burger Shack', imageUrl: 'https://example.com/b.jpg' },
        address: null,
        items: [{ id: 1, name: 'Burger', quantity: 2, price: 100 }],
        statusHistory: [
          {
            id: 101n,
            fromStatus: OrderStatus.PENDING,
            toStatus: OrderStatus.CONFIRMED,
            reason: 'Confirmed by operator',
            changedByUserId: 999n,
            changedByUser: { id: 999n, name: 'Admin User', type: 'ADMIN' },
            createdAt: new Date(),
          },
        ],
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: mockUserAId,
        name: 'Alice',
        email: 'alice@example.com',
        auth: { phone: '+919876543210' },
      });

      const result = await service.getAdminOrderById(1);
      expect(result.success).toBe(true);
      expect(result.data.customer.name).toBe('Alice');
      expect(result.data.statusHistory).toHaveLength(1);
      expect(result.data.statusHistory[0].toStatus).toBe(OrderStatus.CONFIRMED);
    });
  });

  describe('checkout - Multi-Restaurant Order Split', () => {
    const mockRestaurant2 = {
      id: 2,
      name: 'Pizza Spot',
      isOpen: true,
      deliveryFee: 50,
      isFreeDelivery: false,
      imageUrl: 'https://example.com/pizza.jpg',
    };

    const mockMenuItem2 = {
      id: 201,
      restaurantId: 2,
      name: 'Margherita',
      price: 300,
      isAvailable: true,
      imageUrl: 'https://example.com/margherita.jpg',
    };

    it('should split cart items into separate orders per restaurant in one transaction', async () => {
      prismaMock.restaurant.findUnique
        .mockResolvedValueOnce(mockRestaurant)
        .mockResolvedValueOnce(mockRestaurant2);

      prismaMock.menuItem.findMany
        .mockResolvedValueOnce([mockMenuItem1])
        .mockResolvedValueOnce([mockMenuItem2]);

      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);

      const createdOrder1 = {
        id: 1,
        orderNumber: 'FG10000001',
        userId: mockUserAId,
        restaurantId: 1,
        status: OrderStatus.PENDING,
        subtotal: 150,
        taxAmount: 7.5,
        deliveryFee: 40,
        grandTotal: 197.5,
        currencySymbol: '₹',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        checkoutGroupId: 'CG12345678',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [{ id: 1, menuItemId: 101, name: 'Classic Cheeseburger', price: 150, quantity: 1 }],
        restaurant: { name: 'Test Burger Shack', imageUrl: 'https://example.com/burger.jpg' },
      };

      const createdOrder2 = {
        id: 2,
        orderNumber: 'FG10000002',
        userId: mockUserAId,
        restaurantId: 2,
        status: OrderStatus.PENDING,
        subtotal: 300,
        taxAmount: 15,
        deliveryFee: 50,
        grandTotal: 365,
        currencySymbol: '₹',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        checkoutGroupId: 'CG12345678',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [{ id: 2, menuItemId: 201, name: 'Margherita', price: 300, quantity: 1 }],
        restaurant: { name: 'Pizza Spot', imageUrl: 'https://example.com/pizza.jpg' },
      };

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          order: {
            create: vi.fn()
              .mockResolvedValueOnce(createdOrder1)
              .mockResolvedValueOnce(createdOrder2),
          },
          cart: {
            findUnique: vi.fn().mockResolvedValue({ id: 1 }),
            update: vi.fn().mockResolvedValue({}),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return cb(tx);
      });

      const result = await service.checkout(mockUserAId, {
        addressId: '10',
        paymentMethod: 'COD',
        orders: [
          {
            restaurantId: 1,
            items: [{ menuItemId: 101, quantity: 1 }],
          },
          {
            restaurantId: 2,
            items: [{ menuItemId: 201, quantity: 1 }],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.orders).toHaveLength(2);
      expect(result.data.orders[0].restaurantId).toBe(1);
      expect(result.data.orders[1].restaurantId).toBe(2);
      // Ensure total combined amount: 197.5 + 365 = 562.5
      expect(result.data.totalAmount).toBe(562.5);
      // Both orders share the same checkoutGroupId
      expect(result.data.checkoutGroupId).toBeDefined();
    });
  });

  describe('Order Tracking & Real-Time Driver Location', () => {
    const mockDriverId = 300n;
    const mockActiveOrder = {
      id: 10,
      orderNumber: 'FG100010',
      userId: mockUserAId,
      restaurantId: 1,
      status: OrderStatus.OUT_FOR_DELIVERY,
      driverId: 'drv_300',
      driverName: 'Ramesh Courier',
      driverPhone: '+919876543210',
      driverRating: 4.9,
      driverLat: 12.9716,
      driverLng: 77.5946,
      driverHeading: 90,
      driverUpdatedAt: new Date(Date.now() - 60000), // 1 min ago
      createdAt: new Date('2026-10-11T10:00:00Z'),
      subtotal: 100,
      taxAmount: 5,
      deliveryFee: 40,
      grandTotal: 145,
      currencySymbol: '₹',
      restaurant: { id: 1, name: 'Burger Shack', latitude: 12.9700, longitude: 77.5900, imageUrl: 'img.jpg' },
      address: { latitude: 12.9800, longitude: 77.6000, address_line1: '123 Tech Park', city: 'Bangalore' },
      items: [],
    };

    it('allows customer owner to retrieve tracking info', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockActiveOrder);

      const result = await service.getOrderTracking(mockUserAId, UserType.CUSTOMER, 10);

      expect(result.success).toBe(true);
      expect(result.data.orderId).toBe('10');
      expect(result.data.isDriverAssigned).toBe(true);
      expect(result.data.hasDriverLocation).toBe(true);
      expect(result.data.isLocationStale).toBe(false);
      expect(result.data.driver?.name).toBe('Ramesh Courier');
      expect(result.data.driver?.location?.latitude).toBe(12.9716);
    });

    it('allows admin and assigned driver to retrieve tracking info', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockActiveOrder);

      // Admin access
      const adminResult = await service.getOrderTracking(999n, UserType.ADMIN, 10);
      expect(adminResult.success).toBe(true);

      // Assigned driver access
      const driverResult = await service.getOrderTracking(mockDriverId, UserType.DRIVER, 10);
      expect(driverResult.success).toBe(true);
    });

    it('rejects another user from retrieving tracking data', async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockActiveOrder);

      await expect(service.getOrderTracking(mockUserBId, UserType.CUSTOMER, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('flags stale location when driver update is older than 5 minutes', async () => {
      const staleOrder = {
        ...mockActiveOrder,
        driverUpdatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      };
      prismaMock.order.findUnique.mockResolvedValue(staleOrder);

      const result = await service.getOrderTracking(mockUserAId, UserType.CUSTOMER, 10);

      expect(result.data.isLocationStale).toBe(true);
    });

    it('handles order with no driver assigned', async () => {
      const unassignedOrder = {
        ...mockActiveOrder,
        driverId: null,
        driverName: null,
        driverPhone: null,
        driverLat: null,
        driverLng: null,
        driverUpdatedAt: null,
      };
      prismaMock.order.findUnique.mockResolvedValue(unassignedOrder);

      const result = await service.getOrderTracking(mockUserAId, UserType.CUSTOMER, 10);

      expect(result.data.isDriverAssigned).toBe(false);
      expect(result.data.hasDriverLocation).toBe(false);
      expect(result.data.driver).toBeNull();
    });

    describe('updateDriverTracking', () => {
      it('allows assigned driver to update GPS location with valid coordinates', async () => {
        prismaMock.order.findUnique.mockResolvedValue(mockActiveOrder);
        prismaMock.order.update.mockResolvedValue({
          ...mockActiveOrder,
          driverLat: 12.9750,
          driverLng: 77.5980,
          driverHeading: 120,
        });

        const dto = {
          latitude: 12.9750,
          longitude: 77.5980,
          heading: 120,
        };

        const result = await service.updateDriverTracking(mockDriverId, UserType.DRIVER, 10, dto);

        expect(result.success).toBe(true);
        expect(prismaMock.order.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 10 },
            data: expect.objectContaining({
              driverLat: 12.9750,
              driverLng: 77.5980,
              driverHeading: 120,
            }),
          }),
        );
      });

      it('allows admin to update GPS location', async () => {
        prismaMock.order.findUnique.mockResolvedValue(mockActiveOrder);
        prismaMock.order.update.mockResolvedValue(mockActiveOrder);

        const dto = { latitude: 12.9750, longitude: 77.5980 };
        const result = await service.updateDriverTracking(999n, UserType.ADMIN, 10, dto);

        expect(result.success).toBe(true);
      });

      it('rejects update if caller is a customer or unassigned driver', async () => {
        prismaMock.order.findUnique.mockResolvedValue(mockActiveOrder);

        const dto = { latitude: 12.9750, longitude: 77.5980 };

        // Customer
        await expect(service.updateDriverTracking(mockUserAId, UserType.CUSTOMER, 10, dto)).rejects.toThrow(
          ForbiddenException,
        );

        // Different driver (id 999 instead of mockDriverId)
        await expect(service.updateDriverTracking(999n, UserType.DRIVER, 10, dto)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('rejects invalid latitude and longitude out of bounds', async () => {
        prismaMock.order.findUnique.mockResolvedValue(mockActiveOrder);

        await expect(
          service.updateDriverTracking(mockDriverId, UserType.DRIVER, 10, { latitude: 95.0, longitude: 77.59 }),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.updateDriverTracking(mockDriverId, UserType.DRIVER, 10, { latitude: 12.97, longitude: 185.0 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects stale or out-of-order timestamp', async () => {
        prismaMock.order.findUnique.mockResolvedValue({
          ...mockActiveOrder,
          driverUpdatedAt: new Date('2026-10-11T12:00:00Z'),
        });

        const staleDto = {
          latitude: 12.97,
          longitude: 77.59,
          timestamp: '2026-10-11T11:50:00Z', // 10 minutes older than stored record!
        };

        await expect(
          service.updateDriverTracking(mockDriverId, UserType.DRIVER, 10, staleDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects location update on completed or cancelled order', async () => {
        prismaMock.order.findUnique.mockResolvedValue({
          ...mockActiveOrder,
          status: OrderStatus.DELIVERED,
        });

        await expect(
          service.updateDriverTracking(mockDriverId, UserType.DRIVER, 10, { latitude: 12.97, longitude: 77.59 }),
        ).rejects.toThrow(BadRequestException);

        prismaMock.order.findUnique.mockResolvedValue({
          ...mockActiveOrder,
          status: OrderStatus.CANCELLED,
        });

        await expect(
          service.updateDriverTracking(mockDriverId, UserType.DRIVER, 10, { latitude: 12.97, longitude: 77.59 }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('assignDriver', () => {
      it('assigns driver to confirmed order and dispatches notification', async () => {
        prismaMock.order.findUnique.mockResolvedValue({
          ...mockActiveOrder,
          status: OrderStatus.CONFIRMED,
          driverId: null,
          driverName: null,
        });
        prismaMock.order.update.mockResolvedValue({
          ...mockActiveOrder,
          status: OrderStatus.CONFIRMED,
          items: [],
          restaurant: { name: 'Burger Shack', imageUrl: 'img.jpg' },
        });

        const dto = {
          driverId: 'drv_200',
          driverName: 'Suresh Express',
          driverPhone: '+919123456789',
          driverRating: 4.7,
        };

        const result = await service.assignDriver(999n, 10, dto);

        expect(result.success).toBe(true);
        expect(prismaMock.order.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 10 },
            data: expect.objectContaining({
              driverId: 'drv_200',
              driverName: 'Suresh Express',
            }),
          }),
        );
        expect(notificationsMock.createNotification).toHaveBeenCalled();
      });

      it('rejects assigning driver to terminal order', async () => {
        prismaMock.order.findUnique.mockResolvedValue({
          ...mockActiveOrder,
          status: OrderStatus.CANCELLED,
        });

        await expect(
          service.assignDriver(999n, 10, { driverId: 'drv_1', driverName: 'Test' }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Collision-Resistant Order Numbering & Conflict Retries', () => {
    it('should generate a collision-resistant orderNumber fitting VarChar(20) during placeOrder', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);
      prismaMock.cart.findUnique.mockResolvedValue(null);

      let capturedOrderNumber: string | undefined;
      prismaMock.order.create.mockImplementation((args: any) => {
        capturedOrderNumber = args.data.orderNumber;
        return {
          id: 50,
          orderNumber: capturedOrderNumber,
          userId: mockUserAId,
          restaurantId: 1,
          status: OrderStatus.PENDING,
          subtotal: 150,
          taxAmount: 7.5,
          deliveryFee: 40,
          grandTotal: 197.5,
          addressId: 10n,
          createdAt: new Date(),
          items: [],
          restaurant: { name: 'Test Burger Shack' },
        };
      });

      const result = await service.placeOrder(mockUserAId, {
        restaurantId: 1,
        addressId: '10',
        items: [{ menuItemId: 101, quantity: 1 }],
      });

      expect(result.success).toBe(true);
      expect(capturedOrderNumber).toBeDefined();
      expect(capturedOrderNumber!.startsWith('FG-')).toBe(true);
      expect(capturedOrderNumber!.length).toBeLessThanOrEqual(20);
      expect(/^FG-[0-9A-Z]{8}-[0-9A-F]{8}$/.test(capturedOrderNumber!)).toBe(true);
    });

    it('should generate unique collision-resistant orderNumbers and checkoutGroupId during checkout', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);

      const capturedNumbers: string[] = [];
      let capturedCheckoutGroupId: string | undefined;

      prismaMock.order.create.mockImplementation((args: any) => {
        capturedNumbers.push(args.data.orderNumber);
        capturedCheckoutGroupId = args.data.checkoutGroupId;
        return {
          id: 51,
          orderNumber: args.data.orderNumber,
          userId: mockUserAId,
          restaurantId: 1,
          status: OrderStatus.PENDING,
          subtotal: 150,
          taxAmount: 7.5,
          deliveryFee: 40,
          grandTotal: 197.5,
          addressId: 10n,
          createdAt: new Date(),
          items: [],
          restaurant: { name: 'Test Burger Shack' },
        };
      });

      const result = await service.checkout(mockUserAId, {
        addressId: '10',
        orders: [
          {
            restaurantId: 1,
            items: [{ menuItemId: 101, quantity: 1 }],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(capturedNumbers.length).toBe(1);
      expect(capturedNumbers[0].startsWith('FG-')).toBe(true);
      expect(capturedNumbers[0].length).toBeLessThanOrEqual(20);
      expect(capturedCheckoutGroupId).toBeDefined();
      expect(capturedCheckoutGroupId!.startsWith('CG-')).toBe(true);
    });

    it('should retry order creation when Prisma throws P2002 on order_number and succeed on retry', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);
      prismaMock.cart.findUnique.mockResolvedValue(null);

      const p2002Error: any = new Error('Unique constraint failed on order_number');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['order_number'] };

      let attemptCount = 0;
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw p2002Error;
        }
        return callback(prismaMock);
      });

      prismaMock.order.create.mockImplementation((args: any) => ({
        id: 52,
        orderNumber: args.data.orderNumber,
        userId: mockUserAId,
        restaurantId: 1,
        status: OrderStatus.PENDING,
        subtotal: 150,
        taxAmount: 7.5,
        deliveryFee: 40,
        grandTotal: 197.5,
        addressId: 10n,
        createdAt: new Date(),
        items: [],
        restaurant: { name: 'Test Burger Shack' },
      }));

      const result = await service.placeOrder(mockUserAId, {
        restaurantId: 1,
        addressId: '10',
        items: [{ menuItemId: 101, quantity: 1 }],
      });

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('should throw ConflictException when P2002 persists across all retry attempts', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);

      const p2002Error: any = new Error('Unique constraint failed on order_number');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['order_number'] };

      let attemptCount = 0;
      prismaMock.$transaction.mockImplementation(async () => {
        attemptCount++;
        throw p2002Error;
      });

      await expect(
        service.placeOrder(mockUserAId, {
          restaurantId: 1,
          addressId: '10',
          items: [{ menuItemId: 101, quantity: 1 }],
        }),
      ).rejects.toThrow(ConflictException);

      expect(attemptCount).toBe(3); // Attempted initial + 2 retries = 3 total
    });

    it('should NOT retry when P2002 target belongs to a different unique constraint (e.g. email or provider_payment_id)', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);

      const unrelatedP2002: any = new Error('Unique constraint failed on email');
      unrelatedP2002.code = 'P2002';
      unrelatedP2002.meta = { target: ['email'] };

      let attemptCount = 0;
      prismaMock.$transaction.mockImplementation(async () => {
        attemptCount++;
        throw unrelatedP2002;
      });

      await expect(
        service.placeOrder(mockUserAId, {
          restaurantId: 1,
          addressId: '10',
          items: [{ menuItemId: 101, quantity: 1 }],
        }),
      ).rejects.toThrow('Unique constraint failed on email');

      expect(attemptCount).toBe(1); // Crucial: never retried
    });

    it('should NOT retry when P2002 target metadata is missing or unknown', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);

      const unknownP2002: any = new Error('Unknown unique constraint failure');
      unknownP2002.code = 'P2002';
      // meta.target is omitted or empty
      unknownP2002.meta = {};

      let attemptCount = 0;
      prismaMock.$transaction.mockImplementation(async () => {
        attemptCount++;
        throw unknownP2002;
      });

      await expect(
        service.placeOrder(mockUserAId, {
          restaurantId: 1,
          addressId: '10',
          items: [{ menuItemId: 101, quantity: 1 }],
        }),
      ).rejects.toThrow('Unknown unique constraint failure');

      expect(attemptCount).toBe(1); // Crucial: never retried
    });

    it('should NOT retry when an unrelated database error occurs', async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(mockRestaurant);
      prismaMock.menuItem.findMany.mockResolvedValue([mockMenuItem1]);
      prismaMock.addresses.findFirst.mockResolvedValue(mockAddressUserA);

      const dbError = new Error('Database connection reset');

      let attemptCount = 0;
      prismaMock.$transaction.mockImplementation(async () => {
        attemptCount++;
        throw dbError;
      });

      await expect(
        service.placeOrder(mockUserAId, {
          restaurantId: 1,
          addressId: '10',
          items: [{ menuItemId: 101, quantity: 1 }],
        }),
      ).rejects.toThrow('Database connection reset');

      expect(attemptCount).toBe(1); // Never retried
    });
  });
});

