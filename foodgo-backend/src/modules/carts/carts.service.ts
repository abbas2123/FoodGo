import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const TAX_RATE = 0.05; // 5% GST

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get or Create Cart ──────────────────────────────────────────────────────

  private async getOrCreateCart(userId: bigint, restaurantId?: number) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { menuItem: { include: { restaurant: true } } },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId, restaurantId },
        include: {
          items: {
            include: { menuItem: { include: { restaurant: true } } },
          },
        },
      });
    }

    return cart;
  }

  // ─── Get Cart ────────────────────────────────────────────────────────────────

  async getCart(userId: bigint) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            menuItem: {
              include: {
                restaurant: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                    deliveryFee: true,
                    isFreeDelivery: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return {
        success: true,
        message: 'Cart retrieved successfully',
        data: {
          items: [],
          restaurantId: null,
          restaurantName: null,
          bill: { subtotal: 0, taxAmount: 0, deliveryFee: 0, grandTotal: 0, currencySymbol: '₹' },
        },
      };
    }

    return {
      success: true,
      message: 'Cart retrieved successfully',
      data: this.serializeCart(cart),
    };
  }

  // ─── Add Item to Cart ────────────────────────────────────────────────────────

  async addItem(
    userId: bigint,
    menuItemId: number,
    quantity: number,
    specialInstructions?: string,
  ) {
    // Validate menu item
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { restaurant: true },
    });

    if (!menuItem) throw new NotFoundException('Menu item not found');
    if (!menuItem.isAvailable) throw new BadRequestException('Menu item is not available');

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({ where: { userId } });

    if (!cart) {
      try {
        cart = await this.prisma.cart.create({
          data: { userId, restaurantId: menuItem.restaurantId },
        });
      } catch {
        cart = await this.prisma.cart.findUnique({ where: { userId } });
      }
    }

    if (!cart) {
      throw new BadRequestException('Failed to initialize cart');
    }

    // Multi-restaurant support: cart can contain items from multiple restaurants
    if (!cart.restaurantId) {
      cart = await this.prisma.cart.update({
        where: { userId },
        data: { restaurantId: menuItem.restaurantId },
      });
    }

    // Atomic upsert ensures multiple concurrent taps or different products are never duplicated or lost
    await this.prisma.cartItem.upsert({
      where: {
        cartId_menuItemId: {
          cartId: cart.id,
          menuItemId,
        },
      },
      update: {
        quantity: { increment: quantity },
        ...(specialInstructions ? { specialInstructions } : {}),
      },
      create: {
        cartId: cart.id,
        menuItemId,
        quantity,
        specialInstructions,
      },
    });

    return this.getCart(userId);
  }

  // ─── Update Item Quantity ────────────────────────────────────────────────────

  async updateItemQuantity(userId: bigint, cartItemId: number, quantity: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found');

    // Support looking up by either primary CartItem id or menuItemId for robust frontend sync
    const item = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        OR: [
          { id: cartItemId },
          { menuItemId: cartItemId },
        ],
      },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
      // Clear restaurantId if cart is now empty
      const remaining = await this.prisma.cartItem.count({ where: { cartId: cart.id } });
      if (remaining === 0) {
        await this.prisma.cart.update({ where: { id: cart.id }, data: { restaurantId: null } });
      }
    } else {
      await this.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }

    return this.getCart(userId);
  }

  // ─── Remove Item ─────────────────────────────────────────────────────────────

  async removeItem(userId: bigint, cartItemId: number) {
    return this.updateItemQuantity(userId, cartItemId, 0);
  }

  // ─── Clear Cart ──────────────────────────────────────────────────────────────

  async clearCart(userId: bigint) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { restaurantId: null },
      });
    }

    return {
      success: true,
      message: 'Cart cleared successfully',
      data: null,
    };
  }

  // ─── Serializer ──────────────────────────────────────────────────────────────

  private serializeCart(cart: any) {
    const items = cart.items.map((ci: any) => {
      const rest = ci.menuItem.restaurant;
      const deliveryFee = rest?.isFreeDelivery ? 0 : Number(rest?.deliveryFee ?? 0);
      return {
        id: ci.id.toString(),
        menuItemId: ci.menuItemId.toString(),
        name: ci.menuItem.name,
        price: Number(ci.menuItem.price),
        quantity: ci.quantity,
        image: ci.menuItem.imageUrl,
        specialInstructions: ci.specialInstructions ?? null,
        restaurantId: ci.menuItem.restaurantId.toString(),
        restaurantName: rest?.name ?? '',
        restaurantImage: rest?.imageUrl ?? null,
        deliveryFee,
      };
    });

    // Group items by restaurant
    const groupMap = new Map<string, any>();
    for (const item of items) {
      if (!groupMap.has(item.restaurantId)) {
        groupMap.set(item.restaurantId, {
          restaurantId: item.restaurantId,
          restaurantName: item.restaurantName,
          restaurantImage: item.restaurantImage,
          deliveryFee: item.deliveryFee,
          subtotal: 0,
          items: [],
        });
      }
      const group = groupMap.get(item.restaurantId);
      group.subtotal = parseFloat((group.subtotal + item.price * item.quantity).toFixed(2));
      group.items.push(item);
    }

    const restaurantGroups = Array.from(groupMap.values());

    const subtotal = parseFloat(
      items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0).toFixed(2),
    );
    // Total delivery fee is sum of distinct restaurant delivery fees in cart
    const totalDeliveryFee = parseFloat(
      restaurantGroups.reduce((sum: number, g: any) => sum + g.deliveryFee, 0).toFixed(2),
    );
    const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const grandTotal = parseFloat((subtotal + taxAmount + totalDeliveryFee).toFixed(2));

    const firstGroup = restaurantGroups[0];

    return {
      items,
      restaurantGroups,
      restaurantId: firstGroup?.restaurantId ?? null,
      restaurantName: firstGroup?.restaurantName ?? null,
      restaurantImage: firstGroup?.restaurantImage ?? null,
      bill: {
        subtotal,
        taxAmount,
        deliveryFee: totalDeliveryFee,
        grandTotal,
        currencySymbol: '₹',
      },
    };
  }
}
