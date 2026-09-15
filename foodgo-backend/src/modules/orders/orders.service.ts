import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlaceOrderDto } from './dto/place-order.dto.js';
import { OrderStatus } from '../../generated/prisma/client.js';

const TAX_RATE = 0.05; // 5% GST
const CURRENCY_SYMBOL = '₹';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Place Order ─────────────────────────────────────────────────────────────

  async placeOrder(userId: bigint, dto: PlaceOrderDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (!restaurant.isOpen) throw new BadRequestException('Restaurant is currently closed');

    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId: dto.restaurantId, isAvailable: true },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException(
        'One or more menu items are unavailable or do not belong to this restaurant',
      );
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
    const orderItemsData = dto.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId)!;
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        imageUrl: menuItem.imageUrl,
      };
    });

    const subtotal = orderItemsData.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );
    const deliveryFee = Number(restaurant.deliveryFee);
    const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const grandTotal = parseFloat((subtotal + taxAmount + deliveryFee).toFixed(2));
    const orderNumber = `FG${Date.now().toString().slice(-8)}`;
    const addressId = dto.addressId ? BigInt(dto.addressId) : null;

    const order = await this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          orderNumber,
          userId,
          restaurantId: dto.restaurantId,
          status: OrderStatus.PENDING,
          subtotal,
          taxAmount,
          deliveryFee,
          grandTotal,
          currencySymbol: CURRENCY_SYMBOL,
          addressId,
          specialInstructions: dto.specialInstructions,
          paymentMethod: dto.paymentMethod,
          items: { create: orderItemsData },
        },
        include: {
          items: true,
          restaurant: { select: { name: true, imageUrl: true } },
        },
      });
    });

    return { success: true, message: 'Order placed successfully', data: this.serializeOrder(order) };
  }

  // ─── Get User Orders ─────────────────────────────────────────────────────────

  async getOrders(userId: bigint) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        restaurant: { select: { name: true, imageUrl: true } },
      },
    });
    return { success: true, message: 'Orders retrieved successfully', data: orders.map((o) => this.serializeOrder(o)) };
  }

  // ─── Get Order Detail ────────────────────────────────────────────────────────

  async getOrderById(userId: bigint, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        restaurant: {
          select: { id: true, name: true, imageUrl: true, cuisineTypes: true, latitude: true, longitude: true },
        },
        address: true,
        review: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('You do not have permission to view this order');

    return { success: true, message: 'Order retrieved successfully', data: this.serializeOrderDetail(order) };
  }

  // ─── Cancel Order ────────────────────────────────────────────────────────────

  async cancelOrder(userId: bigint, orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('You do not have permission to cancel this order');

    const cancellableStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(`Order cannot be cancelled in ${order.status} status`);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED, updatedAt: new Date() },
      include: {
        items: true,
        restaurant: { select: { name: true, imageUrl: true } },
      },
    });

    return { success: true, message: 'Order cancelled successfully', data: this.serializeOrder(updated) };
  }

  // ─── Submit Review ───────────────────────────────────────────────────────────

  async submitReview(userId: bigint, orderId: number, rating: number, comment?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Access denied');
    if (order.status !== OrderStatus.DELIVERED) throw new BadRequestException('You can only review delivered orders');
    if (order.review) throw new BadRequestException('You have already reviewed this order');

    const review = await this.prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: { userId, orderId, restaurantId: order.restaurantId, rating, comment },
      });

      const agg = await tx.review.aggregate({
        where: { restaurantId: order.restaurantId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.restaurant.update({
        where: { id: order.restaurantId },
        data: {
          rating: parseFloat((agg._avg.rating ?? rating).toFixed(1)),
          reviewCount: String(agg._count.rating),
        },
      });

      return newReview;
    });

    return {
      success: true,
      message: 'Review submitted successfully',
      data: {
        id: review.id.toString(),
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      },
    };
  }

  // ─── Reorder ─────────────────────────────────────────────────────────────────

  async reorder(userId: bigint, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Access denied');

    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: order.restaurantId } });
    if (!restaurant || !restaurant.isOpen) throw new BadRequestException('Restaurant is currently unavailable');

    const menuItemIds = order.items.filter((i) => i.menuItemId != null).map((i) => i.menuItemId!);
    const currentMenuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId: order.restaurantId, isAvailable: true },
    });

    const menuItemMap = new Map(currentMenuItems.map((m) => [m.id, m]));
    const cartItems = order.items
      .filter((i) => i.menuItemId && menuItemMap.has(i.menuItemId))
      .map((i) => {
        const m = menuItemMap.get(i.menuItemId!)!;
        return { menuItemId: m.id, name: m.name, price: Number(m.price), quantity: i.quantity, image: m.imageUrl };
      });

    const unavailableCount = order.items.length - cartItems.length;

    return {
      success: true,
      message: unavailableCount > 0 ? `Reorder ready (${unavailableCount} item(s) no longer available)` : 'All items added to cart',
      data: { restaurantId: order.restaurantId.toString(), restaurantName: restaurant.name, items: cartItems, unavailableCount },
    };
  }

  // ─── Order Tracking ───────────────────────────────────────────────────────────

  async getOrderTracking(userId: bigint, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: { select: { id: true, name: true, latitude: true, longitude: true } },
        address: { select: { latitude: true, longitude: true, address_line1: true, city: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Access denied');

    return {
      success: true,
      message: 'Order tracking retrieved',
      data: {
        orderId: order.id.toString(),
        status: order.status,
        statusLabel: this.getStatusLabel(order.status),
        driver: order.driverName
          ? {
              id: order.driverId ?? null,
              name: order.driverName,
              phone: order.driverPhone ?? null,
              rating: order.driverRating ? Number(order.driverRating) : null,
              location:
                order.driverLat && order.driverLng
                  ? { latitude: Number(order.driverLat), longitude: Number(order.driverLng), heading: order.driverHeading ?? 0 }
                  : null,
            }
          : null,
        restaurant: {
          id: order.restaurant.id.toString(),
          name: order.restaurant.name,
          location:
            order.restaurant.latitude && order.restaurant.longitude
              ? { latitude: Number(order.restaurant.latitude), longitude: Number(order.restaurant.longitude) }
              : null,
        },
        deliveryLocation: order.address
          ? {
              latitude: Number(order.address.latitude),
              longitude: Number(order.address.longitude),
              address: [order.address.address_line1, order.address.city].filter(Boolean).join(', '),
            }
          : null,
      },
    };
  }

  async updateDriverTracking(orderId: number, lat: number, lng: number, heading?: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.order.update({
      where: { id: orderId },
      data: { driverLat: lat, driverLng: lng, driverHeading: heading },
    });

    return { success: true, message: 'Driver location updated' };
  }

  // ─── Serializers ─────────────────────────────────────────────────────────────

  private serializeOrder(order: {
    id: number;
    orderNumber: string;
    status: OrderStatus;
    subtotal: unknown;
    taxAmount: unknown;
    deliveryFee: unknown;
    grandTotal: unknown;
    currencySymbol: string;
    createdAt: Date;
    completedAt?: Date | null;
    paymentMethod?: string | null;
    items: Array<{ id: number; name: string; price: unknown; quantity: number; imageUrl?: string | null }>;
    restaurant: { name: string; imageUrl: string };
  }) {
    return {
      id: order.id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: this.getStatusLabel(order.status),
      restaurant: { name: order.restaurant.name, image: order.restaurant.imageUrl },
      items: order.items.map((item) => ({
        id: item.id.toString(),
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        image: item.imageUrl ?? '',
      })),
      bill: {
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        deliveryFee: Number(order.deliveryFee),
        grandTotal: Number(order.grandTotal),
        currencySymbol: order.currencySymbol,
      },
      paymentMethod: order.paymentMethod ?? null,
      createdAt: order.createdAt.toISOString(),
      completedAt: order.completedAt?.toISOString() ?? null,
    };
  }

  private serializeOrderDetail(order: {
    id: number;
    orderNumber: string;
    status: OrderStatus;
    subtotal: unknown;
    taxAmount: unknown;
    deliveryFee: unknown;
    grandTotal: unknown;
    currencySymbol: string;
    specialInstructions?: string | null;
    paymentMethod?: string | null;
    createdAt: Date;
    completedAt?: Date | null;
    items: Array<{ id: number; name: string; price: unknown; quantity: number; imageUrl?: string | null }>;
    restaurant: { id: number; name: string; imageUrl: string; cuisineTypes: string; latitude?: unknown; longitude?: unknown };
    address: {
      label: string; address_line1: string; address_line2: string;
      city: string; state: string; postal_code: string; country: string;
      latitude?: unknown; longitude?: unknown;
    } | null;
    review?: { id: number; rating: number; comment?: string | null } | null;
  }) {
    const base = this.serializeOrder({
      ...order,
      restaurant: { name: order.restaurant.name, imageUrl: order.restaurant.imageUrl },
    });

    return {
      ...base,
      specialInstructions: order.specialInstructions ?? null,
      restaurant: {
        id: order.restaurant.id.toString(),
        name: order.restaurant.name,
        image: order.restaurant.imageUrl,
        cuisine: order.restaurant.cuisineTypes,
        location:
          order.restaurant.latitude != null && order.restaurant.longitude != null
            ? { latitude: Number(order.restaurant.latitude), longitude: Number(order.restaurant.longitude) }
            : null,
      },
      deliveryAddress: order.address
        ? {
            label: order.address.label,
            addressLine1: order.address.address_line1,
            addressLine2: order.address.address_line2,
            city: order.address.city,
            state: order.address.state,
            postalCode: order.address.postal_code,
            country: order.address.country,
            location:
              order.address.latitude != null && order.address.longitude != null
                ? { latitude: Number(order.address.latitude), longitude: Number(order.address.longitude) }
                : null,
          }
        : null,
      review: order.review ? { rating: order.review.rating, comment: order.review.comment ?? null } : null,
    };
  }

  private getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      PENDING: 'Pending Confirmation',
      CONFIRMED: 'Order Confirmed',
      PREPARING: 'Preparing',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
    };
    return labels[status] ?? status;
  }
}
