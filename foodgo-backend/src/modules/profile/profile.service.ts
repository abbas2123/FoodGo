import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { auth: true },
    });

    if (!user) {
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
}
