import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { PaymentMethodsService } from './payment-methods.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PaymentMethodType } from '../../generated/prisma/client.js';

describe('PaymentMethodsController', () => {
  let controller: PaymentMethodsController;
  let paymentMethodsServiceMock: {
    getPaymentMethods: ReturnType<typeof vi.fn>;
    createPaymentMethod: ReturnType<typeof vi.fn>;
    setDefaultPaymentMethod: ReturnType<typeof vi.fn>;
    deletePaymentMethod: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    paymentMethodsServiceMock = {
      getPaymentMethods: vi.fn(),
      createPaymentMethod: vi.fn(),
      setDefaultPaymentMethod: vi.fn(),
      deletePaymentMethod: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodsController],
      providers: [
        {
          provide: PaymentMethodsService,
          useValue: paymentMethodsServiceMock,
        },
        { provide: JwtService, useValue: { verifyAsync: vi.fn() } },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: vi.fn() } },
      ],
    }).compile();

    controller = module.get<PaymentMethodsController>(
      PaymentMethodsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPaymentMethods', () => {
    it('should call service with userId from req.user.sub', async () => {
      const mockReq = { user: { sub: '42' } };
      paymentMethodsServiceMock.getPaymentMethods.mockResolvedValue([]);

      const result = await controller.getPaymentMethods(mockReq);

      expect(paymentMethodsServiceMock.getPaymentMethods).toHaveBeenCalledWith(
        42n,
      );
      expect(result).toEqual([]);
    });
  });

  describe('createPaymentMethod', () => {
    it('should call service with userId and dto', async () => {
      const mockReq = { user: { sub: '42' } };
      const dto = {
        type: PaymentMethodType.CARD,
        maskedIdentifier: '•••• 4242',
      };
      paymentMethodsServiceMock.createPaymentMethod.mockResolvedValue({
        id: '1',
      });

      const result = await controller.createPaymentMethod(mockReq, dto);

      expect(paymentMethodsServiceMock.createPaymentMethod).toHaveBeenCalledWith(
        42n,
        dto,
      );
      expect(result).toEqual({ id: '1' });
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should call service with userId and method id', async () => {
      const mockReq = { user: { sub: '42' } };
      paymentMethodsServiceMock.setDefaultPaymentMethod.mockResolvedValue({
        id: '1',
        isDefault: true,
      });

      const result = await controller.setDefaultPaymentMethod(mockReq, '1');

      expect(
        paymentMethodsServiceMock.setDefaultPaymentMethod,
      ).toHaveBeenCalledWith(42n, 1n);
      expect(result).toEqual({ id: '1', isDefault: true });
    });
  });

  describe('deletePaymentMethod', () => {
    it('should call service with userId and method id', async () => {
      const mockReq = { user: { sub: '42' } };
      paymentMethodsServiceMock.deletePaymentMethod.mockResolvedValue({
        message: 'Deleted',
      });

      const result = await controller.deletePaymentMethod(mockReq, '1');

      expect(paymentMethodsServiceMock.deletePaymentMethod).toHaveBeenCalledWith(
        42n,
        1n,
      );
      expect(result).toEqual({ message: 'Deleted' });
    });
  });
});
