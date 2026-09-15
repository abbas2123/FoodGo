import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto.js';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentMethods(userId: bigint) {
    const methods = await this.prisma.userPaymentMethod.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return methods.map((m) => ({
      id: m.id.toString(),
      userId: m.userId.toString(),
      type: m.type,
      provider: m.provider,
      maskedIdentifier: m.maskedIdentifier,
      isDefault: m.isDefault,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async createPaymentMethod(userId: bigint, dto: CreatePaymentMethodDto) {
    const activeCount = await this.prisma.userPaymentMethod.count({
      where: { userId, isActive: true },
    });

    const isDefault = dto.isDefault || activeCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.userPaymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const created = await tx.userPaymentMethod.create({
        data: {
          userId,
          type: dto.type,
          maskedIdentifier: dto.maskedIdentifier.trim(),
          provider: dto.provider?.trim() || 'MANUAL',
          isDefault,
          isActive: true,
        },
      });

      return {
        id: created.id.toString(),
        userId: created.userId.toString(),
        type: created.type,
        provider: created.provider,
        maskedIdentifier: created.maskedIdentifier,
        isDefault: created.isDefault,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    });
  }

  async setDefaultPaymentMethod(userId: bigint, id: bigint) {
    const existing = await this.prisma.userPaymentMethod.findFirst({
      where: { id, userId, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException('Payment method not found');
    }

    if (existing.isDefault) {
      return {
        id: existing.id.toString(),
        userId: existing.userId.toString(),
        type: existing.type,
        provider: existing.provider,
        maskedIdentifier: existing.maskedIdentifier,
        isDefault: true,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.userPaymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      const updated = await tx.userPaymentMethod.update({
        where: { id },
        data: { isDefault: true },
      });

      return {
        id: updated.id.toString(),
        userId: updated.userId.toString(),
        type: updated.type,
        provider: updated.provider,
        maskedIdentifier: updated.maskedIdentifier,
        isDefault: true,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  async deletePaymentMethod(userId: bigint, id: bigint) {
    const existing = await this.prisma.userPaymentMethod.findFirst({
      where: { id, userId, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException('Payment method not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Soft-delete to preserve transaction history
      await tx.userPaymentMethod.update({
        where: { id },
        data: { isActive: false, isDefault: false },
      });

      // If the deleted method was default, promote another active method to default
      if (existing.isDefault) {
        const nextMethod = await tx.userPaymentMethod.findFirst({
          where: { userId, isActive: true },
          orderBy: { createdAt: 'desc' },
        });

        if (nextMethod) {
          await tx.userPaymentMethod.update({
            where: { id: nextMethod.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return { message: 'Payment method removed successfully' };
  }
}
