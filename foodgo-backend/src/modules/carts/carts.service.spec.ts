import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartsService } from './carts.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('CartsService - Multi-Restaurant Support', () => {
  let service: CartsService;
  let prismaMock: any;

  const mockUserId = 101n;

  const restaurantA = {
    id: 1,
    name: 'Burger Palace',
    imageUrl: 'https://example.com/burger-palace.jpg',
    deliveryFee: 40,
    isFreeDelivery: false,
  };

  const restaurantB = {
    id: 2,
    name: 'Pizza Corner',
    imageUrl: 'https://example.com/pizza-corner.jpg',
    deliveryFee: 50,
    isFreeDelivery: false,
  };

  const itemA1 = {
    id: 10,
    restaurantId: 1,
    name: 'Cheeseburger',
    price: 250,
    isAvailable: true,
    imageUrl: 'https://example.com/burger.jpg',
    restaurant: restaurantA,
  };

  const itemB1 = {
    id: 20,
    restaurantId: 2,
    name: 'Margherita Pizza',
    price: 350,
    isAvailable: true,
    imageUrl: 'https://example.com/pizza.jpg',
    restaurant: restaurantB,
  };

  beforeEach(async () => {
    prismaMock = {
      cart: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      cartItem: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
      },
      menuItem: {
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CartsService>(CartsService);
  });

  it('should allow adding item from Restaurant A into an empty cart', async () => {
    prismaMock.menuItem.findUnique.mockResolvedValue(itemA1);
    prismaMock.cart.findUnique
      .mockResolvedValueOnce(null) // first check
      .mockResolvedValueOnce({
        id: 1,
        userId: mockUserId,
        restaurantId: 1,
        items: [
          {
            id: 100,
            cartId: 1,
            menuItemId: 10,
            quantity: 2,
            menuItem: itemA1,
          },
        ],
      });
    prismaMock.cart.create.mockResolvedValue({ id: 1, userId: mockUserId, restaurantId: 1 });
    prismaMock.cartItem.upsert.mockResolvedValue({});

    const result = await service.addItem(mockUserId, 10, 2);

    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.restaurantGroups).toHaveLength(1);
    expect(result.data.restaurantGroups[0].restaurantName).toBe('Burger Palace');
    expect(result.data.bill.subtotal).toBe(500); // 250 * 2
    expect(result.data.bill.deliveryFee).toBe(40);
  });

  it('should allow adding item from Restaurant B when Restaurant A items already exist (NO conflict)', async () => {
    // Existing cart with Restaurant A
    const existingCart = {
      id: 1,
      userId: mockUserId,
      restaurantId: 1,
    };
    prismaMock.cart.findUnique
      .mockResolvedValueOnce(existingCart) // for addItem get/create
      .mockResolvedValueOnce({
        id: 1,
        userId: mockUserId,
        restaurantId: 1,
        items: [
          { id: 100, cartId: 1, menuItemId: 10, quantity: 2, menuItem: itemA1 },
          { id: 101, cartId: 1, menuItemId: 20, quantity: 1, menuItem: itemB1 },
        ],
      }); // for getCart call
    prismaMock.menuItem.findUnique.mockResolvedValue(itemB1);
    prismaMock.cartItem.upsert.mockResolvedValue({});

    const result = await service.addItem(mockUserId, 20, 1);

    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(2);
    // Should have 2 distinct restaurant groups!
    expect(result.data.restaurantGroups).toHaveLength(2);
    expect(result.data.restaurantGroups[0].restaurantName).toBe('Burger Palace');
    expect(result.data.restaurantGroups[1].restaurantName).toBe('Pizza Corner');

    // Subtotal: 2 * 250 + 1 * 350 = 850
    expect(result.data.bill.subtotal).toBe(850);
    // Combined Delivery fee: 40 (Burger Palace) + 50 (Pizza Corner) = 90
    expect(result.data.bill.deliveryFee).toBe(90);
    // Tax: 5% of 850 = 42.50
    expect(result.data.bill.taxAmount).toBe(42.5);
    // Grand total: 850 + 42.50 + 90 = 982.50
    expect(result.data.bill.grandTotal).toBe(982.5);
  });

  it('should remove items correctly and update restaurant groups', async () => {
    prismaMock.cart.findUnique
      .mockResolvedValueOnce({ id: 1, userId: mockUserId })
      .mockResolvedValueOnce({
        id: 1,
        userId: mockUserId,
        items: [
          { id: 101, cartId: 1, menuItemId: 20, quantity: 1, menuItem: itemB1 },
        ],
      });
    prismaMock.cartItem.findFirst.mockResolvedValue({ id: 100, cartId: 1, menuItemId: 10, quantity: 2 });
    prismaMock.cartItem.delete.mockResolvedValue({});
    prismaMock.cartItem.count.mockResolvedValue(1);

    const result = await service.removeItem(mockUserId, 100);

    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.restaurantGroups).toHaveLength(1);
    expect(result.data.restaurantGroups[0].restaurantName).toBe('Pizza Corner');
    expect(result.data.bill.subtotal).toBe(350);
    expect(result.data.bill.deliveryFee).toBe(50);
  });

  it('should clear cart cleanly', async () => {
    prismaMock.cart.findUnique.mockResolvedValue({ id: 1, userId: mockUserId });
    prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.cart.update.mockResolvedValue({});

    const result = await service.clearCart(mockUserId);
    expect(result.success).toBe(true);
    expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 1 } });
  });
});
