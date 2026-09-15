import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';

@Injectable()
export class AdressService {
  constructor(private readonly prisma: PrismaService) {}

  async getAddresses(userId: bigint) {
    const userAddresses = await this.prisma.addresses.findMany({
      where: {
        user_id: userId,
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    return {
      success: true,
      message:
        userAddresses.length === 0
          ? 'No saved addresses found'
          : 'Addresses retrieved successfully',
      data: userAddresses,
    };
  }

  // Alias for backward compatibility
  async getAddress(userId: bigint) {
    return this.getAddresses(userId);
  }

  async createAddress(userId: bigint, dto: CreateAddressDto) {
    const count = await this.prisma.addresses.count({
      where: { user_id: userId },
    });

    // If user has no saved addresses, automatically make it default
    const shouldBeDefault = count === 0 ? true : Boolean(dto.is_default);

    const now = new Date();
    const addressData = {
      user_id: userId,
      label: dto.label.trim(),
      address_line1: dto.address_line1.trim(),
      address_line2: (dto.address_line2 ?? '').trim(),
      landmark: (dto.landmark ?? '').trim(),
      city: dto.city.trim(),
      state: dto.state.trim(),
      postal_code: dto.postal_code.trim(),
      country: (dto.country ?? 'India').trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      is_default: shouldBeDefault,
      created_at: now,
      updated_at: now,
    };

    if (shouldBeDefault && count > 0) {
      // Use transaction to ensure at most one address is default
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.addresses.updateMany({
          where: { user_id: userId },
          data: { is_default: false },
        });

        return tx.addresses.create({
          data: addressData,
        });
      });

      return {
        success: true,
        message: 'Address created successfully',
        data: created,
      };
    }

    const created = await this.prisma.addresses.create({
      data: addressData,
    });

    return {
      success: true,
      message: 'Address created successfully',
      data: created,
    };
  }

  async updateAddress(userId: bigint, id: bigint, dto: UpdateAddressDto) {
    const existing = await this.prisma.addresses.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this address',
      );
    }

    const isDefaultRequested = dto.is_default === true;
    const now = new Date();

    const updateData: Record<string, unknown> = {
      updated_at: now,
    };

    if (dto.label !== undefined) updateData.label = dto.label.trim();
    if (dto.address_line1 !== undefined)
      updateData.address_line1 = dto.address_line1.trim();
    if (dto.address_line2 !== undefined)
      updateData.address_line2 = dto.address_line2.trim();
    if (dto.landmark !== undefined) updateData.landmark = dto.landmark.trim();
    if (dto.city !== undefined) updateData.city = dto.city.trim();
    if (dto.state !== undefined) updateData.state = dto.state.trim();
    if (dto.postal_code !== undefined)
      updateData.postal_code = dto.postal_code.trim();
    if (dto.country !== undefined) updateData.country = dto.country.trim();
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
    if (dto.is_default !== undefined) updateData.is_default = dto.is_default;

    if (isDefaultRequested) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.addresses.updateMany({
          where: { user_id: userId },
          data: { is_default: false },
        });

        return tx.addresses.update({
          where: { id },
          data: updateData,
        });
      });

      return {
        success: true,
        message: 'Address updated successfully',
        data: updated,
      };
    }

    const updated = await this.prisma.addresses.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      message: 'Address updated successfully',
      data: updated,
    };
  }

  async deleteAddress(userId: bigint, id: bigint) {
    const existing = await this.prisma.addresses.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this address',
      );
    }

    let newDefaultId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.addresses.delete({
        where: { id },
      });

      // If deleted address was default, promote the most recently created remaining address
      if (existing.is_default) {
        const nextDefault = await tx.addresses.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
        });

        if (nextDefault) {
          await tx.addresses.update({
            where: { id: nextDefault.id },
            data: { is_default: true, updated_at: new Date() },
          });
          newDefaultId = nextDefault.id.toString();
        }
      }
    });

    return {
      success: true,
      message: 'Address deleted successfully',
      data: {
        deletedId: id.toString(),
        newDefaultId,
      },
    };
  }

  async setDefaultAddress(userId: bigint, id: bigint) {
    const existing = await this.prisma.addresses.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this address',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.addresses.updateMany({
        where: { user_id: userId },
        data: { is_default: false },
      });

      return tx.addresses.update({
        where: { id },
        data: { is_default: true, updated_at: new Date() },
      });
    });

    return {
      success: true,
      message: 'Default address updated successfully',
      data: updated,
    };
  }
}
