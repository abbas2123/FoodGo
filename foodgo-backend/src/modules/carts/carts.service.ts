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
      cart = await this.prisma.cart.create({
        data: { userId, restaurantId: menuItem.restaurantId },
      });
    } else if (cart.restaurantId && cart.restaurantId !== menuItem.restaurantId) {
      throw new ConflictException(
        'You have items from a different restaurant in your cart. Clear the cart first.',
      );
    }

    // Update restaurantId if not set
    if (!cart.restaurantId) {
      cart = await this.prisma.cart.update({
        where: { userId },
        data: { restaurantId: menuItem.restaurantId },
      });
    }

    // Add or increment item
    const existingItem = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, menuItemId },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, menuItemId, quantity, specialInstructions },
      });
    }

    return this.getCart(userId);
  }

  // ─── Update Item Quantity ────────────────────────────────────────────────────

  async updateItemQuantity(userId: bigint, cartItemId: number, quantity: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found');

    const item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: cartItemId } });
      // Clear restaurantId if cart is now empty
      const remaining = await this.prisma.cartItem.count({ where: { cartId: cart.id } });
      if (remaining === 0) {
        await this.prisma.cart.update({ where: { id: cart.id }, data: { restaurantId: null } });
      }
    } else {
      await this.prisma.cartItem.update({
        where: { id: cartItemId },
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
    const items = cart.items.map((ci: any) => ({
      id: ci.id.toString(),
      menuItemId: ci.menuItemId.toString(),
      name: ci.menuItem.name,
      price: Number(ci.menuItem.price),
      quantity: ci.quantity,
      image: ci.menuItem.imageUrl,
      specialInstructions: ci.specialInstructions ?? null,
      restaurantId: ci.menuItem.restaurantId.toString(),
    }));

    const firstItem = cart.items[0];
    const restaurant = firstItem?.menuItem?.restaurant;

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );
    const deliveryFee = restaurant?.isFreeDelivery
      ? 0
      : Number(restaurant?.deliveryFee ?? 0);
    const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const grandTotal = parseFloat((subtotal + taxAmount + deliveryFee).toFixed(2));

    return {
      items,
      restaurantId: restaurant?.id?.toString() ?? null,
      restaurantName: restaurant?.name ?? null,
      restaurantImage: restaurant?.imageUrl ?? null,
      bill: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxAmount,
        deliveryFee,
        grandTotal,
        currencySymbol: '₹',
      },
    };
  }
}
