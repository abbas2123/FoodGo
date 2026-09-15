import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Categories ─────────────────────────────────────────────────────────────

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
    };
  }

  // ─── Restaurants List ────────────────────────────────────────────────────────

  async getRestaurants(category?: string) {
    const whereClause: Record<string, unknown> = {};

    if (category && category.toLowerCase() !== 'all') {
      whereClause.cuisineTypes = {
        contains: category,
        mode: 'insensitive',
      };
    }

    const restaurants = await this.prisma.restaurant.findMany({
      where: whereClause,
      orderBy: { rating: 'desc' },
    });

    return {
      success: true,
      message: 'Restaurants retrieved successfully',
      data: restaurants.map((r) => this.serializeRestaurant(r)),
    };
  }

  // ─── Restaurant Detail with Menu ─────────────────────────────────────────────

  async getRestaurantById(id: number) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ isBestseller: 'desc' }, { name: 'asc' }],
        },
      },
    });

    if (!restaurant) {
      return {
        success: false,
        message: 'Restaurant not found',
        data: null,
      };
    }

    // Group menu items by category
    const menuByCategory = restaurant.menuItems.reduce<
      Record<string, typeof restaurant.menuItems>
    >((acc, item) => {
      const cat = item.categoryName;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    return {
      success: true,
      message: 'Restaurant retrieved successfully',
      data: {
        ...this.serializeRestaurant(restaurant),
        menu: restaurant.menuItems.map((item) => ({
          id: item.id.toString(),
          name: item.name,
          description: item.description,
          price: Number(item.price),
          image: item.imageUrl,
          rating: Number(item.rating),
          isVeg: item.isVeg,
          isBestseller: item.isBestseller,
          category: item.categoryName,
          isAvailable: item.isAvailable,
        })),
        categories: Object.keys(menuByCategory),
      },
    };
  }

  // ─── Popular Dishes (cross-restaurant) ───────────────────────────────────────

  async getPopularDishes() {
    const dishes = await this.prisma.menuItem.findMany({
      where: {
        isBestseller: true,
        isAvailable: true,
      },
      take: 10,
      orderBy: { rating: 'desc' },
      include: {
        restaurant: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      success: true,
      message: 'Popular dishes retrieved successfully',
      data: dishes.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.categoryName,
        rating: Number(d.rating).toFixed(1),
        reviews: '0',
        price: Number(d.price).toFixed(2),
        image: d.imageUrl,
        restaurantId: d.restaurantId.toString(),
        restaurantName: d.restaurant.name,
      })),
    };
  }

  // ─── Search Restaurants & Dishes ─────────────────────────────────────────────

  async searchRestaurantsAndDishes(q: string) {
    if (!q || q.trim().length === 0) {
      return {
        success: true,
        message: 'Search results retrieved',
        data: { restaurants: [], dishes: [] },
      };
    }

    const query = q.trim();

    const [restaurants, dishes] = await Promise.all([
      // Search restaurants by name or cuisine
      this.prisma.restaurant.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { cuisineTypes: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { rating: 'desc' },
        take: 10,
      }),
      // Search menu items by name or description
      this.prisma.menuItem.findMany({
        where: {
          isAvailable: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { categoryName: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          restaurant: {
            select: { id: true, name: true, imageUrl: true, isOpen: true },
          },
        },
        take: 15,
      }),
    ]);

    return {
      success: true,
      message: 'Search results retrieved',
      data: {
        restaurants: restaurants.map((r) => this.serializeRestaurant(r)),
        dishes: dishes.map((d) => ({
          id: d.id.toString(),
          name: d.name,
          description: d.description,
          price: Number(d.price),
          image: d.imageUrl,
          rating: Number(d.rating),
          isVeg: d.isVeg,
          isBestseller: d.isBestseller,
          category: d.categoryName,
          restaurantId: d.restaurantId.toString(),
          restaurantName: d.restaurant.name,
          restaurantImage: d.restaurant.imageUrl,
          restaurantIsOpen: d.restaurant.isOpen,
        })),
      },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private serializeRestaurant(r: {
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
    latitude?: unknown;
    longitude?: unknown;
  }) {
    return {
      id: r.id.toString(),
      name: r.name,
      cuisine: r.cuisineTypes,
      rating: Number(r.rating),
      reviewCount: r.reviewCount,
      deliveryTime: `${r.deliveryTimeMin}-${r.deliveryTimeMax} min`,
      deliveryFee: r.isFreeDelivery ? 'Free' : `₹${Number(r.deliveryFee).toFixed(2)}`,
      image: r.imageUrl,
      isOpen: r.isOpen,
      offer: r.offerText,
      distance: '1.0 km', // TODO: calculate from user location
      location:
        r.latitude != null && r.longitude != null
          ? { latitude: Number(r.latitude), longitude: Number(r.longitude) }
          : undefined,
    };
  }
}
