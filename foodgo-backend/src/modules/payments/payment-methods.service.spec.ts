import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentMethodType } from '../../generated/prisma/client.js';

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;
  let prismaMock: {
    userPaymentMethod: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prismaMock = {
      userPaymentMethod: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prismaMock);
        }
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PaymentMethodsService>(PaymentMethodsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPaymentMethods', () => {
    it('should return user payment methods ordered by default first', async () => {
      const mockMethods = [
        {
          id: 1n,
          userId: 10n,
          type: PaymentMethodType.CARD,
          provider: 'STRIPE',
          maskedIdentifier: '•••• 4242',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2n,
          userId: 10n,
          type: PaymentMethodType.UPI,
          provider: 'MANUAL',
          maskedIdentifier: 'user@upi',
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prismaMock.userPaymentMethod.findMany.mockResolvedValue(mockMethods);

      const result = await service.getPaymentMethods(10n);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].maskedIdentifier).toBe('•••• 4242');
      expect(result[0].isDefault).toBe(true);
      expect(result[1].id).toBe('2');
      expect(result[1].maskedIdentifier).toBe('user@upi');
      expect(result[1].isDefault).toBe(false);
    });
  });

  describe('createPaymentMethod', () => {
    it('should set first payment method as default automatically', async () => {
      prismaMock.userPaymentMethod.count.mockResolvedValue(0);
      prismaMock.userPaymentMethod.create.mockResolvedValue({
        id: 1n,
        userId: 10n,
        type: PaymentMethodType.CARD,
        provider: 'STRIPE',
        maskedIdentifier: '•••• 4242',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createPaymentMethod(10n, {
        type: PaymentMethodType.CARD,
        maskedIdentifier: '•••• 4242',
        provider: 'STRIPE',
      });

      expect(result.id).toBe('1');
      expect(result.isDefault).toBe(true);
      expect(prismaMock.userPaymentMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: true,
          }),
        }),
      );
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should update default method atomically', async () => {
      prismaMock.userPaymentMethod.findFirst.mockResolvedValue({
        id: 2n,
        userId: 10n,
        type: PaymentMethodType.UPI,
        isDefault: false,
      });
      prismaMock.userPaymentMethod.update.mockResolvedValue({
        id: 2n,
        userId: 10n,
        type: PaymentMethodType.UPI,
        provider: 'MANUAL',
        maskedIdentifier: 'user@upi',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.setDefaultPaymentMethod(10n, 2n);

      expect(result.id).toBe('2');
      expect(result.isDefault).toBe(true);
      expect(prismaMock.userPaymentMethod.updateMany).toHaveBeenCalledWith({
        where: { userId: 10n, isDefault: true },
        data: { isDefault: false },
      });
    });

    it('should throw NotFoundException if payment method does not exist', async () => {
      prismaMock.userPaymentMethod.findFirst.mockResolvedValue(null);

      await expect(service.setDefaultPaymentMethod(10n, 999n)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deletePaymentMethod', () => {
    it('should soft delete and promote next method if deleted was default', async () => {
      prismaMock.userPaymentMethod.findFirst
        .mockResolvedValueOnce({
          id: 1n,
          userId: 10n,
          isDefault: true,
        })
        .mockResolvedValueOnce({
          id: 2n,
          userId: 10n,
          isDefault: false,
        });

      const result = await service.deletePaymentMethod(10n, 1n);

      expect(result.message).toBe('Payment method removed successfully');
      expect(prismaMock.userPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { isActive: false, isDefault: false },
      });
      expect(prismaMock.userPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: 2n },
        data: { isDefault: true },
      });
    });
  });
});
