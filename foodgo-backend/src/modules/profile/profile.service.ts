import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { OrderStatus, UserStatus } from '../../generated/prisma/client.js';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { auth: true },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('User profile not found');
    }

    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      profileImageUrl: user.profileImageUrl,
      type: user.type,
      status: user.status,
      phone: user.auth?.phone ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: bigint, dto: UpdateProfileDto) {
    const hasName = dto.name !== undefined && dto.name.trim().length > 0;
    const hasEmail = dto.email !== undefined && dto.email.trim().length > 0;
    const hasAvatar = dto.profileImageUrl !== undefined;

    if (!hasName && !hasEmail && !hasAvatar) {
      throw new BadRequestException('At least one field must be provided to update profile');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('User profile not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(hasName && { name: dto.name!.trim() }),
        ...(hasEmail && { email: dto.email!.trim() }),
        ...(hasAvatar && { profileImageUrl: dto.profileImageUrl }),
      },
      include: { auth: true },
    });

    return {
      id: updatedUser.id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      profileImageUrl: updatedUser.profileImageUrl,
      type: updatedUser.type,
      status: updatedUser.status,
      phone: updatedUser.auth?.phone ?? null,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  async deleteAccount(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { auth: true },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    // Idempotent: return success if already marked DELETED
    if (user.status === UserStatus.DELETED) {
      return {
        success: true,
        message: 'Account has already been deleted.',
      };
    }

    // Protect active, in-flight orders from orphaned delivery
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        },
      },
    });

    if (activeOrder) {
      throw new BadRequestException(
        'Cannot delete account while an active order is in progress. Please wait until your order is completed or cancelled.',
      );
    }

    // Execute atomic cleanup and anonymization
    await this.prisma.$transaction(async (tx) => {
      // 1. Invalidate and revoke all active sessions & refresh tokens
      await tx.refreshToken.deleteMany({ where: { userId } });

      // 2. Erase personal payment tokens and saved cards
      await tx.userPaymentMethod.deleteMany({ where: { userId } });

      // 3. Clear active cart and items
      const userCart = await tx.cart.findUnique({ where: { userId } });
      if (userCart) {
        await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
        await tx.cart.delete({ where: { id: userCart.id } });
      }

      // 4. Remove personalized favorites
      await tx.favorite.deleteMany({ where: { userId } });

      // 5. Delete private notification history
      await tx.notification.deleteMany({ where: { userId } });

      // 6. Delete search query history
      await tx.searchHistory.deleteMany({ where: { userId } });

      // 7. Delete saved addresses (historical orders retain copied text snapshots via SetNull FK)
      await tx.addresses.deleteMany({ where: { user_id: userId } });

      // 8. Delete UserAuth to release phone number and prevent login
      await tx.userAuth.deleteMany({ where: { userId } });

      // 9. Anonymize user record while keeping row for financial/tax order referential integrity
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Deleted User',
          email: null,
          profileImageUrl: null,
          status: UserStatus.DELETED,
        },
      });
    });

    return {
      success: true,
      message: 'Account deleted successfully. Personal data removed and active sessions revoked.',
    };
  }
}
