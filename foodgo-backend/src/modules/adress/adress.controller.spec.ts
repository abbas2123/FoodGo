import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AdressController } from './adress.controller.js';
import { AdressService } from './adress.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

describe('AdressController', () => {
  let controller: AdressController;
  let addressServiceMock: {
    getAddresses: ReturnType<typeof vi.fn>;
    createAddress: ReturnType<typeof vi.fn>;
    updateAddress: ReturnType<typeof vi.fn>;
    deleteAddress: ReturnType<typeof vi.fn>;
    setDefaultAddress: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    addressServiceMock = {
      getAddresses: vi.fn(),
      createAddress: vi.fn(),
      updateAddress: vi.fn(),
      deleteAddress: vi.fn(),
      setDefaultAddress: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdressController],
      providers: [
        {
          provide: AdressService,
          useValue: addressServiceMock,
        },
        { provide: JwtService, useValue: { verifyAsync: vi.fn() } },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: vi.fn() } },
      ],
    }).compile();

    controller = module.get<AdressController>(AdressController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserAddress', () => {
    it('should call getAddresses with userId from req.user.sub', async () => {
      const mockReq = { user: { sub: '42' } };
      addressServiceMock.getAddresses.mockResolvedValue({
        success: true,
        message: 'No saved addresses found',
        data: [],
      });

      const result = await controller.getUserAddress(mockReq);

      expect(addressServiceMock.getAddresses).toHaveBeenCalledWith(42n);
      expect(result.data).toEqual([]);
    });

    it('should call getAddresses with userId from req.user.userId', async () => {
      const mockReq = { user: { userId: '100' } };
      addressServiceMock.getAddresses.mockResolvedValue({
        success: true,
        message: 'Addresses retrieved successfully',
        data: [{ id: 1n, label: 'Home' }],
      });

      const result = await controller.getUserAddress(mockReq);

      expect(addressServiceMock.getAddresses).toHaveBeenCalledWith(100n);
      expect(result.data).toHaveLength(1);
    });

    it('should throw UnauthorizedException if req.user is missing', async () => {
      const mockReq = { user: {} };

      await expect(controller.getUserAddress(mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('createAddress', () => {
    it('should call service.createAddress with user ID and payload', async () => {
      const mockReq = { user: { sub: '55' } };
      const dto = {
        label: 'Home',
        address_line1: '123 Beach Rd',
        city: 'Kochi',
        state: 'Kerala',
        postal_code: '682001',
        latitude: 9.9312,
        longitude: 76.2673,
      };
      addressServiceMock.createAddress.mockResolvedValue({
        success: true,
        message: 'Address created successfully',
        data: { id: 1n, ...dto },
      });

      const result = await controller.createAddress(mockReq, dto);

      expect(addressServiceMock.createAddress).toHaveBeenCalledWith(55n, dto);
      expect(result.success).toBe(true);
    });
  });

  describe('updateAddress', () => {
    it('should call service.updateAddress with parsed BigInt ID', async () => {
      const mockReq = { user: { sub: '55' } };
      const dto = { label: 'Work' };
      addressServiceMock.updateAddress.mockResolvedValue({
        success: true,
        message: 'Address updated successfully',
        data: { id: 7n, label: 'Work' },
      });

      const result = await controller.updateAddress(mockReq, '7', dto);

      expect(addressServiceMock.updateAddress).toHaveBeenCalledWith(
        55n,
        7n,
        dto,
      );
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException if address id is invalid', async () => {
      const mockReq = { user: { sub: '55' } };

      await expect(
        controller.updateAddress(mockReq, 'abc', { label: 'Work' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAddress', () => {
    it('should call service.deleteAddress with parsed BigInt ID', async () => {
      const mockReq = { user: { sub: '55' } };
      addressServiceMock.deleteAddress.mockResolvedValue({
        success: true,
        message: 'Address deleted successfully',
        data: { deletedId: '9' },
      });

      const result = await controller.deleteAddress(mockReq, '9');

      expect(addressServiceMock.deleteAddress).toHaveBeenCalledWith(55n, 9n);
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException if address id is invalid', async () => {
      const mockReq = { user: { sub: '55' } };

      await expect(controller.deleteAddress(mockReq, 'xyz')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setDefaultAddress', () => {
    it('should call service.setDefaultAddress with parsed BigInt ID', async () => {
      const mockReq = { user: { sub: '55' } };
      addressServiceMock.setDefaultAddress.mockResolvedValue({
        success: true,
        message: 'Default address updated successfully',
        data: { id: 14n, is_default: true },
      });

      const result = await controller.setDefaultAddress(mockReq, '14');

      expect(addressServiceMock.setDefaultAddress).toHaveBeenCalledWith(
        55n,
        14n,
      );
      expect(result.success).toBe(true);
    });
  });
});
