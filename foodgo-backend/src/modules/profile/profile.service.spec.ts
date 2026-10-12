import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus, UserType } from '../../generated/prisma/client.js';

describe('ProfileService', () => {
  let service: ProfileService;
  let prismaMock: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile with phone', async () => {
      const mockUser = {
        id: 1n,
        name: 'John Doe',
        email: 'john@example.com',
        profileImageUrl: null,
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        auth: {
          phone: '+14155552671',
        },
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile(1n);

      expect(result.id).toBe('1');
      expect(result.name).toBe('John Doe');
      expect(result.phone).toBe('+14155552671');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1n },
        include: { auth: true },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile(99n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update name successfully', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 1n, status: UserStatus.ACTIVE });
      const mockUpdated = {
        id: 1n,
        name: 'Jane Doe',
        email: null,
        profileImageUrl: null,
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        auth: {
          phone: '+14155552671',
        },
      };
      prismaMock.user.update.mockResolvedValue(mockUpdated);

      const result = await service.updateProfile(1n, { name: 'Jane Doe' });

      expect(result.name).toBe('Jane Doe');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { name: 'Jane Doe' },
        include: { auth: true },
      });
    });

    it('should throw BadRequestException if no fields provided to update', async () => {
      await expect(service.updateProfile(1n, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAccount', () => {
    let txMock: {
      refreshToken: { deleteMany: ReturnType<typeof vi.fn> };
      userPaymentMethod: { deleteMany: ReturnType<typeof vi.fn> };
      cart: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
      cartItem: { deleteMany: ReturnType<typeof vi.fn> };
      favorite: { deleteMany: ReturnType<typeof vi.fn> };
      notification: { deleteMany: ReturnType<typeof vi.fn> };
      searchHistory: { deleteMany: ReturnType<typeof vi.fn> };
      addresses: { deleteMany: ReturnType<typeof vi.fn> };
      userAuth: { deleteMany: ReturnType<typeof vi.fn> };
      user: { update: ReturnType<typeof vi.fn> };
    };

    beforeEach(() => {
      txMock = {
        refreshToken: { deleteMany: vi.fn() },
        userPaymentMethod: { deleteMany: vi.fn() },
        cart: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn() },
        cartItem: { deleteMany: vi.fn() },
        favorite: { deleteMany: vi.fn() },
        notification: { deleteMany: vi.fn() },
        searchHistory: { deleteMany: vi.fn() },
        addresses: { deleteMany: vi.fn() },
        userAuth: { deleteMany: vi.fn() },
        user: { update: vi.fn() },
      };

      (prismaMock as any).order = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      (prismaMock as any).$transaction = vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        return cb(txMock);
      });
    });

    it('should successfully delete account, revoke sessions, and anonymize user', async () => {
      const mockUser = {
        id: 1n,
        status: UserStatus.ACTIVE,
        name: 'John Doe',
        email: 'john@example.com',
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      txMock.cart.findUnique.mockResolvedValue({ id: 10 });

      const result = await service.deleteAccount(1n);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Account deleted successfully');

      // Verify active order check was performed
      expect((prismaMock as any).order.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 1n,
          status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'] },
        },
      });

      // Verify session revocation
      expect(txMock.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 1n } });
      // Verify payment tokens removed
      expect(txMock.userPaymentMethod.deleteMany).toHaveBeenCalledWith({ where: { userId: 1n } });
      // Verify cart and items removed
      expect(txMock.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 10 } });
      expect(txMock.cart.delete).toHaveBeenCalledWith({ where: { id: 10 } });
      // Verify personal addresses removed
      expect(txMock.addresses.deleteMany).toHaveBeenCalledWith({ where: { user_id: 1n } });
      // Verify UserAuth released
      expect(txMock.userAuth.deleteMany).toHaveBeenCalledWith({ where: { userId: 1n } });
      // Verify user record anonymized
      expect(txMock.user.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: {
          name: 'Deleted User',
          email: null,
          profileImageUrl: null,
          status: UserStatus.DELETED,
        },
      });
    });

    it('should throw NotFoundException if user account does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount(999n)).rejects.toThrow(NotFoundException);
    });

    it('should return idempotent success if user account is already deleted', async () => {
      const mockDeletedUser = {
        id: 1n,
        status: UserStatus.DELETED,
      };
      prismaMock.user.findUnique.mockResolvedValue(mockDeletedUser);

      const result = await service.deleteAccount(1n);

      expect(result.success).toBe(true);
      expect(result.message).toContain('already been deleted');
      expect((prismaMock as any).$transaction).not.toHaveBeenCalled();
    });

    it('should reject deletion with BadRequestException if user has an active order in progress', async () => {
      const mockUser = {
        id: 1n,
        status: UserStatus.ACTIVE,
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (prismaMock as any).order.findFirst.mockResolvedValue({
        id: 50,
        status: 'OUT_FOR_DELIVERY',
      });

      await expect(service.deleteAccount(1n)).rejects.toThrow(BadRequestException);
      expect((prismaMock as any).$transaction).not.toHaveBeenCalled();
    });

    it('should propagate database transaction failures cleanly', async () => {
      const mockUser = {
        id: 1n,
        status: UserStatus.ACTIVE,
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (prismaMock as any).$transaction = vi.fn().mockRejectedValue(new Error('Database lock timeout'));

      await expect(service.deleteAccount(1n)).rejects.toThrow('Database lock timeout');
    });
  });
});
