import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get User Favorites ──────────────────────────────────────────────────────

  async getFavorites(userId: bigint) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: true,
      },
    });

    return {
      success: true,
      message: 'Favorites retrieved successfully',
      data: favorites.map((fav) => this.serializeFavorite(fav)),
    };
  }

  // ─── Add to Favorites ────────────────────────────────────────────────────────

  async addFavorite(userId: bigint, restaurantId: number) {
    // Verify restaurant exists
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    try {
      const favorite = await this.prisma.favorite.create({
        data: { userId, restaurantId },
        include: { restaurant: true },
      });
      return {
        success: true,
        message: 'Restaurant added to favorites',
        data: this.serializeFavorite(favorite),
      };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Restaurant is already in favorites');
      }
      throw err;
    }
  }

  // ─── Remove from Favorites ───────────────────────────────────────────────────

  async removeFavorite(userId: bigint, restaurantId: number) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prisma.favorite.delete({
      where: { userId_restaurantId: { userId, restaurantId } },
    });

    return {
      success: true,
      message: 'Restaurant removed from favorites',
      data: null,
    };
  }

  // ─── Check Favorite Status ───────────────────────────────────────────────────

  async getFavoriteStatus(userId: bigint, restaurantId: number) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
    });

    return {
      success: true,
      message: 'Favorite status retrieved',
      data: { isFavorite: Boolean(favorite) },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private serializeFavorite(fav: {
    id: number;
    createdAt: Date;
    restaurant: {
      id: number;
      name: string;
      cuisineTypes: string;
      rating: unknown;
      reviewCount: string;
      deliveryTimeMin: number;
      deliveryTimeMax: number;
      deliveryFee: unknown;
      isFreeDelivery: boolean;
      imageUrl: string;
      isOpen: boolean;
      offerText: string | null;
    };
  }) {
    const r = fav.restaurant;
    return {
      id: fav.id.toString(),
      savedAt: fav.createdAt.toISOString(),
      restaurant: {
        id: r.id.toString(),
        name: r.name,
        cuisine: r.cuisineTypes,
        rating: Number(r.rating),
        reviewCount: r.reviewCount,
        deliveryTime: `${r.deliveryTimeMin}-${r.deliveryTimeMax} min`,
        deliveryFee: r.isFreeDelivery
          ? 'Free'
          : `₹${Number(r.deliveryFee).toFixed(2)}`,
        image: r.imageUrl,
        isOpen: r.isOpen,
        offer: r.offerText,
      },
    };
  }
}
