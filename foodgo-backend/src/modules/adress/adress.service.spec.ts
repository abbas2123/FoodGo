import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdressService } from './adress.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('AdressService', () => {
  let service: AdressService;
  let prismaMock: {
    addresses: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prismaMock = {
      addresses: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
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
        AdressService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AdressService>(AdressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAddresses', () => {
    it('should return an empty array with appropriate message if no addresses found', async () => {
      prismaMock.addresses.findMany.mockResolvedValue([]);

      const result = await service.getAddresses(1n);

      expect(result.success).toBe(true);
      expect(result.message).toBe('No saved addresses found');
      expect(result.data).toEqual([]);
      expect(prismaMock.addresses.findMany).toHaveBeenCalledWith({
        where: { user_id: 1n },
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
      });
    });

    it('should return list of addresses for user', async () => {
      const mockList = [
        { id: 1n, user_id: 1n, label: 'Home', is_default: true },
        { id: 2n, user_id: 1n, label: 'Work', is_default: false },
      ];
      prismaMock.addresses.findMany.mockResolvedValue(mockList);

      const result = await service.getAddresses(1n);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Addresses retrieved successfully');
      expect(result.data).toEqual(mockList);
    });
  });

  describe('createAddress', () => {
    const createDto = {
      label: 'Home',
      address_line1: '123 Main St',
      city: 'Kochi',
      state: 'Kerala',
      postal_code: '682001',
      latitude: 9.9312,
      longitude: 76.2673,
    };

    it('should auto-assign is_default = true if it is the first address', async () => {
      prismaMock.addresses.count.mockResolvedValue(0);
      prismaMock.addresses.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 10n, ...data }),
      );

      const result = await service.createAddress(1n, createDto);

      expect(result.success).toBe(true);
      expect(result.data.is_default).toBe(true);
      expect(prismaMock.addresses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 1n,
            is_default: true,
          }),
        }),
      );
    });

    it('should keep is_default = false if user already has addresses and did not request default', async () => {
      prismaMock.addresses.count.mockResolvedValue(2);
      prismaMock.addresses.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 11n, ...data }),
      );

      const result = await service.createAddress(1n, {
        ...createDto,
        is_default: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.is_default).toBe(false);
    });

    it('should reset other defaults via transaction if new address is marked default', async () => {
      prismaMock.addresses.count.mockResolvedValue(2);
      prismaMock.addresses.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.addresses.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 12n, ...data }),
      );

      const result = await service.createAddress(1n, {
        ...createDto,
        is_default: true,
      });

      expect(result.success).toBe(true);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.addresses.updateMany).toHaveBeenCalledWith({
        where: { user_id: 1n },
        data: { is_default: false },
      });
    });
  });

  describe('updateAddress', () => {
    it('should throw NotFoundException if address does not exist', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAddress(1n, 999n, { label: 'New Label' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if address belongs to another user', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 99n, // different user
        label: 'Home',
      });

      await expect(
        service.updateAddress(1n, 5n, { label: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update address fields successfully', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        label: 'Old',
      });
      prismaMock.addresses.update.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        label: 'New',
      });

      const result = await service.updateAddress(1n, 5n, { label: 'New' });

      expect(result.success).toBe(true);
      expect(result.data.label).toBe('New');
    });

    it('should reset other defaults via transaction when updating address to default', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        is_default: false,
      });
      prismaMock.addresses.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.addresses.update.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        is_default: true,
      });

      const result = await service.updateAddress(1n, 5n, { is_default: true });

      expect(result.success).toBe(true);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.addresses.updateMany).toHaveBeenCalledWith({
        where: { user_id: 1n },
        data: { is_default: false },
      });
    });
  });

  describe('deleteAddress', () => {
    it('should throw NotFoundException if address does not exist', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue(null);

      await expect(service.deleteAddress(1n, 999n)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if address belongs to another user', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 99n,
      });

      await expect(service.deleteAddress(1n, 5n)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should promote the most recently created remaining address when default is deleted', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        is_default: true,
      });
      prismaMock.addresses.delete.mockResolvedValue({ id: 5n });
      prismaMock.addresses.findFirst.mockResolvedValue({
        id: 6n,
        user_id: 1n,
        created_at: new Date(),
      });
      prismaMock.addresses.update.mockResolvedValue({
        id: 6n,
        is_default: true,
      });

      const result = await service.deleteAddress(1n, 5n);

      expect(result.success).toBe(true);
      expect(result.data.deletedId).toBe('5');
      expect(result.data.newDefaultId).toBe('6');
      expect(prismaMock.addresses.update).toHaveBeenCalledWith({
        where: { id: 6n },
        data: expect.objectContaining({ is_default: true }),
      });
    });

    it('should delete non-default address without promoting other addresses', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        is_default: false,
      });
      prismaMock.addresses.delete.mockResolvedValue({ id: 5n });

      const result = await service.deleteAddress(1n, 5n);

      expect(result.success).toBe(true);
      expect(result.data.deletedId).toBe('5');
      expect(result.data.newDefaultId).toBeNull();
      expect(prismaMock.addresses.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('setDefaultAddress', () => {
    it('should throw NotFoundException if address not found', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue(null);

      await expect(service.setDefaultAddress(1n, 999n)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if address belongs to another user', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 99n,
      });

      await expect(service.setDefaultAddress(1n, 5n)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should atomically unset other defaults and set target address as default', async () => {
      prismaMock.addresses.findUnique.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        is_default: false,
      });
      prismaMock.addresses.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.addresses.update.mockResolvedValue({
        id: 5n,
        user_id: 1n,
        is_default: true,
      });

      const result = await service.setDefaultAddress(1n, 5n);

      expect(result.success).toBe(true);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.addresses.updateMany).toHaveBeenCalledWith({
        where: { user_id: 1n },
        data: { is_default: false },
      });
      expect(prismaMock.addresses.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: expect.objectContaining({ is_default: true }),
      });
    });
  });
});
