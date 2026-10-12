import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlaceOrderDto } from './dto/place-order.dto.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto.js';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto.js';
import { AssignDriverDto } from './dto/assign-driver.dto.js';
import { OrderStatus, UserType } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  canTransitionOrderStatus,
  getStatusNotification,
} from './order-state-machine.js';
import { OrderNumberUtil } from '../../common/utils/order-number.util.js';

const TAX_RATE = 0.05; // 5% GST
const CURRENCY_SYMBOL = '₹';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Multi-Restaurant Checkout ──────────────────────────────────────────────

  async checkout(userId: bigint, dto: CheckoutDto) {
    // 1. Resolve address & check IDOR
    const rawAddressId = dto.addressId ?? (dto as any).deliveryAddressId;
    let addressId: bigint | null = null;
    if (rawAddressId != null && rawAddressId !== '') {
      try {
        addressId = BigInt(rawAddressId.toString());
      } catch {
        throw new BadRequestException('Invalid address ID format');
      }

      const address = await this.prisma.addresses.findFirst({
        where: { id: addressId, user_id: userId },
      });

      if (!address) {
        throw new BadRequestException(
          'Delivery address not found or does not belong to the authenticated user',
        );
      }
    }

    // 2. Resolve restaurant orders: either explicitly provided or derived from server cart
    let restaurantOrders: {
      restaurantId: number;
      items: { menuItemId: number; quantity: number }[];
      specialInstructions?: string;
    }[] = dto.orders ?? [];

    if (restaurantOrders.length === 0) {
      const userCart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { menuItem: { include: { restaurant: true } } },
          },
        },
      });

      if (!userCart || userCart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const groups = new Map<number, { menuItemId: number; quantity: number }[]>();
      for (const ci of userCart.items) {
        const rId = ci.menuItem.restaurantId;
        if (!groups.has(rId)) {
          groups.set(rId, []);
        }
        groups.get(rId)!.push({
          menuItemId: ci.menuItemId,
          quantity: ci.quantity,
        });
      }

      restaurantOrders = Array.from(groups.entries()).map(([restaurantId, items]) => ({
        restaurantId,
        items,
        specialInstructions: dto.specialInstructions,
      }));
    }

    if (restaurantOrders.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // 3. Server-authoritative validation for each restaurant and its items
    const preparedOrders: any[] = [];
    let totalCombinedAmount = 0;

    for (const ro of restaurantOrders) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: ro.restaurantId },
      });
      if (!restaurant) {
        throw new NotFoundException(`Restaurant with ID ${ro.restaurantId} not found`);
      }
      if (!restaurant.isOpen) {
        throw new BadRequestException(`Restaurant "${restaurant.name}" is currently closed`);
      }

      const menuItemIds = ro.items.map((i) => i.menuItemId);
      const menuItems = await this.prisma.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          restaurantId: ro.restaurantId,
          isAvailable: true,
        },
      });

      if (menuItems.length !== menuItemIds.length) {
        throw new BadRequestException(
          `One or more menu items are unavailable or do not belong to restaurant "${restaurant.name}"`,
        );
      }

      const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
      const orderItemsData = ro.items.map((item) => {
        const menuItem = menuItemMap.get(item.menuItemId)!;
        return {
          menuItemId: item.menuItemId,
          name: menuItem.name,
          price: menuItem.price,
          quantity: item.quantity,
          imageUrl: menuItem.imageUrl,
        };
      });

      const subtotal = parseFloat(
        orderItemsData
          .reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
          .toFixed(2),
      );
      const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
      const deliveryFee = restaurant.isFreeDelivery ? 0 : Number(restaurant.deliveryFee);
      const grandTotal = parseFloat((subtotal + taxAmount + deliveryFee).toFixed(2));
      totalCombinedAmount += grandTotal;

      preparedOrders.push({
        restaurant,
        restaurantId: ro.restaurantId,
        subtotal,
        taxAmount,
        deliveryFee,
        grandTotal,
        orderItemsData,
        specialInstructions: ro.specialInstructions || dto.specialInstructions,
      });
    }

    totalCombinedAmount = parseFloat(totalCombinedAmount.toFixed(2));

    // 4. Generate unique checkoutGroupId linking all independent orders from this checkout
    const checkoutGroupId = OrderNumberUtil.generateCheckoutGroupId();

    const createdOrders = await this.executeOrderTransaction(async () => {
      return this.prisma.$transaction(async (tx) => {
        const ordersResult: any[] = [];

        for (let idx = 0; idx < preparedOrders.length; idx++) {
          const po = preparedOrders[idx];
          const orderNumber = OrderNumberUtil.generate();

          const newOrder = await tx.order.create({
            data: {
              orderNumber,
              userId,
              restaurantId: po.restaurantId,
              status: OrderStatus.PENDING,
              subtotal: po.subtotal,
              taxAmount: po.taxAmount,
              deliveryFee: po.deliveryFee,
              grandTotal: po.grandTotal,
              currencySymbol: CURRENCY_SYMBOL,
              addressId,
              deliveryAddressText: dto.deliveryAddressText,
              specialInstructions: po.specialInstructions,
              paymentMethod: dto.paymentMethod,
              checkoutGroupId,
              items: { create: po.orderItemsData },
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: OrderStatus.PENDING,
                  changedByUserId: userId,
                  reason: 'Order placed by customer via checkout',
                },
              },
            },
            include: {
              items: true,
              restaurant: { select: { name: true, imageUrl: true } },
            },
          });

          ordersResult.push(newOrder);
        }

        if (dto.paymentMethod === 'COD') {
          const userCart = await tx.cart.findUnique({ where: { userId } });
          if (userCart) {
            await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
            await tx.cart.update({
              where: { id: userCart.id },
              data: { restaurantId: null },
            });
          }
        }

        return ordersResult;
      });
    });

    // 5. In-app notifications for each order
    for (const o of createdOrders) {
      try {
        await this.notificationsService.createNotification(
          userId,
          'Order Placed Successfully!',
          `Your order ${o.orderNumber} for ₹${o.grandTotal} from ${o.restaurant.name} has been placed.`,
          'ORDER_UPDATE',
          o.id,
        );
      } catch (e) {
        // Non-blocking notification
      }
    }

    return {
      success: true,
      message: `${createdOrders.length} order(s) placed successfully`,
      data: {
        checkoutGroupId,
        orders: createdOrders.map((o) => this.serializeOrder(o)),
        primaryOrderId: createdOrders[0].id,
        orderId: createdOrders[0].id,
        orderNumber: createdOrders.map((o) => o.orderNumber).join(', '),
        totalAmount: totalCombinedAmount,
      },
    };
  }

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

    const subtotal = parseFloat(
      orderItemsData
        .reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
        .toFixed(2),
    );
    const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const deliveryFee = restaurant.isFreeDelivery ? 0 : Number(restaurant.deliveryFee);
    const grandTotal = parseFloat((subtotal + taxAmount + deliveryFee).toFixed(2));
    const rawAddressId = dto.addressId ?? (dto as any).deliveryAddressId;
    let addressId: bigint | null = null;
    if (rawAddressId != null && rawAddressId !== '') {
      try {
        addressId = BigInt(rawAddressId.toString());
      } catch {
        throw new BadRequestException('Invalid address ID format');
      }

      const address = await this.prisma.addresses.findFirst({
        where: { id: addressId, user_id: userId },
      });

      if (!address) {
        throw new BadRequestException(
          'Delivery address not found or does not belong to the authenticated user',
        );
      }
    }
    const order = await this.executeOrderTransaction(async () => {
      const orderNumber = OrderNumberUtil.generate();

      return this.prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
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
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: OrderStatus.PENDING,
                changedByUserId: userId,
                reason: 'Order placed by customer',
              },
            },
          },
          include: {
            items: true,
            restaurant: { select: { name: true, imageUrl: true } },
          },
        });

        if (dto.paymentMethod === 'COD') {
          const userCart = await tx.cart.findUnique({ where: { userId } });
          if (userCart) {
            await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
            await tx.cart.update({
              where: { id: userCart.id },
              data: { restaurantId: null },
            });
          }
        }

        return newOrder;
      });
    });

    try {
      await this.notificationsService.createNotification(
        userId,
        'Order Placed Successfully!',
        `Your order ${order.orderNumber} for ₹${order.grandTotal} from ${restaurant.name} has been placed.`,
        'ORDER_UPDATE',
        order.id,
      );
    } catch (e) {
      // Non-blocking notification
    }

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
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('You do not have permission to view this order');

    return { success: true, message: 'Order retrieved successfully', data: this.serializeOrderDetail(order) };
  }

  // ─── Cancel Order (Customer & Admin) ─────────────────────────────────────────

  async cancelOrder(userId: bigint, orderId: number, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('You do not have permission to cancel this order');

    const cancellableStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(`Order cannot be cancelled in ${order.status} status`);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, userId, status: order.status },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: now,
          updatedAt: now,
        },
      });

      if (res.count === 0) {
        throw new ConflictException('Order status was modified by another concurrent request');
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changedByUserId: userId,
          reason: reason || 'Order cancelled by customer',
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          restaurant: { select: { name: true, imageUrl: true } },
        },
      });
    });

    try {
      await this.notificationsService.createNotification(
        userId,
        'Order Cancelled',
        `Your order ${order.orderNumber} has been cancelled.`,
        'ORDER_UPDATE',
        order.id,
      );
    } catch (e) {
      // Non-blocking notification
    }

    return { success: true, message: 'Order cancelled successfully', data: this.serializeOrder(updated) };
  }

  // ─── Update Order Status (Admin) ─────────────────────────────────────────────

  async updateOrderStatus(
    adminUserId: bigint,
    orderId: number,
    nextStatus: OrderStatus,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { name: true, imageUrl: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!canTransitionOrderStatus(order.status, nextStatus)) {
      throw new BadRequestException(
        `Cannot transition order status from ${order.status} to ${nextStatus}`,
      );
    }

    const now = new Date();
    const timestampUpdates: Record<string, Date> = {};
    if (nextStatus === OrderStatus.CONFIRMED) timestampUpdates.confirmedAt = now;
    if (nextStatus === OrderStatus.PREPARING) timestampUpdates.preparingAt = now;
    if (nextStatus === OrderStatus.OUT_FOR_DELIVERY) timestampUpdates.outForDeliveryAt = now;
    if (nextStatus === OrderStatus.DELIVERED) {
      timestampUpdates.deliveredAt = now;
      timestampUpdates.completedAt = now;
    }
    if (nextStatus === OrderStatus.CANCELLED) {
      timestampUpdates.cancelledAt = now;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: nextStatus,
          updatedAt: now,
          ...timestampUpdates,
        },
      });

      if (res.count === 0) {
        throw new ConflictException('Order status was modified by another concurrent request');
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: nextStatus,
          changedByUserId: adminUserId,
          reason: reason || `Status transitioned to ${nextStatus}`,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          restaurant: { select: { name: true, imageUrl: true } },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            include: {
              changedByUser: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });
    });

    const notif = getStatusNotification(nextStatus, updated.orderNumber);
    if (notif) {
      try {
        await this.notificationsService.createNotification(
          updated.userId,
          notif.title,
          notif.message,
          'ORDER_UPDATE',
          updated.id,
        );
      } catch (e) {
        // Non-blocking notification
      }
    }

    return {
      success: true,
      message: `Order status updated to ${nextStatus}`,
      data: this.serializeOrder(updated),
    };
  }

  // ─── Admin: List Orders ──────────────────────────────────────────────────────

  async getAdminOrders(query: AdminOrderQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const orderByField = query.sortBy === 'grandTotal' ? 'grandTotal' : 'createdAt';
    const orderDirection = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
        include: {
          restaurant: { select: { id: true, name: true } },
          items: { select: { id: true, name: true, quantity: true, price: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const userIds = Array.from(new Set(orders.map((o) => o.userId)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        auth: { select: { phone: true } },
      },
    });

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    const serializedOrders = orders.map((o) => {
      const user = userMap.get(o.userId.toString());
      return {
        id: o.id.toString(),
        orderNumber: o.orderNumber,
        status: o.status,
        statusLabel: this.getStatusLabel(o.status),
        customer: user
          ? {
              id: user.id.toString(),
              name: user.name ?? 'Customer',
              phone: user.auth?.phone ?? '',
              email: user.email ?? '',
            }
          : {
              id: o.userId.toString(),
              name: 'Customer',
              phone: '',
              email: '',
            },
        restaurant: {
          id: o.restaurant.id.toString(),
          name: o.restaurant.name,
        },
        itemCount: o.items.reduce((acc, i) => acc + i.quantity, 0),
        grandTotal: Number(o.grandTotal),
        currencySymbol: o.currencySymbol,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        confirmedAt: o.confirmedAt?.toISOString() ?? null,
        preparingAt: o.preparingAt?.toISOString() ?? null,
        outForDeliveryAt: o.outForDeliveryAt?.toISOString() ?? null,
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
        cancelledAt: o.cancelledAt?.toISOString() ?? null,
      };
    });

    return {
      success: true,
      message: 'Admin orders retrieved successfully',
      data: {
        orders: serializedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  // ─── Admin: Order Details ───────────────────────────────────────────────────

  async getAdminOrderById(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: { select: { id: true, name: true, imageUrl: true } },
        address: true,
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedByUser: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const customer = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: {
        id: true,
        name: true,
        email: true,
        auth: { select: { phone: true } },
      },
    });

    return {
      success: true,
      message: 'Admin order details retrieved successfully',
      data: {
        id: order.id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        statusLabel: this.getStatusLabel(order.status),
        customer: customer
          ? {
              id: customer.id.toString(),
              name: customer.name ?? 'Customer',
              phone: customer.auth?.phone ?? '',
              email: customer.email ?? '',
            }
          : { id: order.userId.toString(), name: 'Customer', phone: '', email: '' },
        restaurant: {
          id: order.restaurant.id.toString(),
          name: order.restaurant.name,
        },
        items: order.items.map((i) => ({
          id: i.id.toString(),
          name: i.name,
          price: Number(i.price),
          quantity: i.quantity,
          subtotal: Number(i.price) * i.quantity,
        })),
        bill: {
          subtotal: Number(order.subtotal),
          taxAmount: Number(order.taxAmount),
          deliveryFee: Number(order.deliveryFee),
          grandTotal: Number(order.grandTotal),
          currencySymbol: order.currencySymbol,
        },
        paymentMethod: order.paymentMethod ?? null,
        paymentStatus: order.paymentStatus,
        deliveryAddress: order.address
          ? {
              label: order.address.label,
              addressLine1: order.address.address_line1,
              addressLine2: order.address.address_line2,
              city: order.address.city,
              state: order.address.state,
              postalCode: order.address.postal_code,
              country: order.address.country,
            }
          : null,
        timestamps: {
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          confirmedAt: order.confirmedAt?.toISOString() ?? null,
          preparingAt: order.preparingAt?.toISOString() ?? null,
          outForDeliveryAt: order.outForDeliveryAt?.toISOString() ?? null,
          deliveredAt: order.deliveredAt?.toISOString() ?? null,
          cancelledAt: order.cancelledAt?.toISOString() ?? null,
        },
        statusHistory: order.statusHistory.map((h) => ({
          id: h.id.toString(),
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          reason: h.reason,
          changedByUserId: h.changedByUserId?.toString() ?? null,
          changedByUser: h.changedByUser
            ? {
                id: h.changedByUser.id.toString(),
                name: h.changedByUser.name,
                type: h.changedByUser.type,
              }
            : null,
          createdAt: h.createdAt.toISOString(),
        })),
      },
    };
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

  // ─── Order Tracking & Driver Location ─────────────────────────────────────────

  async getOrderTracking(userId: bigint, userType: UserType | string | undefined, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: { select: { id: true, name: true, latitude: true, longitude: true } },
        address: { select: { latitude: true, longitude: true, address_line1: true, city: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const isOwner = order.userId === userId;
    const isAdmin = userType === UserType.ADMIN || userType === 'ADMIN';
    const isAssignedDriver = Boolean(
      order.driverId &&
        (String(order.driverId) === String(userId) ||
          String(order.driverId) === `drv_${userId}`),
    );

    if (!isOwner && !isAdmin && !isAssignedDriver) {
      throw new ForbiddenException('Access denied: You do not have permission to view tracking for this order');
    }

    const hasDriver = Boolean(order.driverId && order.driverName);
    const hasDriverLocation = Boolean(order.driverLat && order.driverLng);
    const driverUpdatedAt = order.driverUpdatedAt ? order.driverUpdatedAt.toISOString() : null;

    // A location is marked stale if the latest GPS ping is older than 5 minutes
    const isLocationStale = order.driverUpdatedAt
      ? Date.now() - order.driverUpdatedAt.getTime() > 5 * 60 * 1000
      : false;

    return {
      success: true,
      message: 'Order tracking retrieved',
      data: {
        orderId: order.id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        statusLabel: this.getStatusLabel(order.status),
        isDriverAssigned: hasDriver,
        hasDriverLocation,
        isLocationStale,
        driverUpdatedAt,
        driver: hasDriver
          ? {
              id: order.driverId ?? null,
              name: order.driverName,
              phone: order.driverPhone ?? null,
              rating: order.driverRating ? Number(order.driverRating) : null,
              location: hasDriverLocation
                ? {
                    latitude: Number(order.driverLat),
                    longitude: Number(order.driverLng),
                    heading: order.driverHeading ?? 0,
                    updatedAt: driverUpdatedAt,
                  }
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
          : order.deliveryAddressText
          ? {
              latitude: null,
              longitude: null,
              address: order.deliveryAddressText,
            }
          : null,
      },
    };
  }

  async updateDriverTracking(
    callerUserId: bigint,
    callerUserType: UserType | string | undefined,
    orderId: number,
    dto: UpdateDriverLocationDto,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const isAdmin = callerUserType === UserType.ADMIN || callerUserType === 'ADMIN';
    const isDriver = callerUserType === UserType.DRIVER || callerUserType === 'DRIVER';

    if (!isAdmin && !isDriver) {
      throw new ForbiddenException('Only the assigned driver or an administrator can update driver location');
    }

    const isOrderDriver = Boolean(
      order.driverId &&
        (String(order.driverId) === String(callerUserId) ||
          String(order.driverId) === `drv_${callerUserId}`),
    );

    if (isDriver && !isOrderDriver) {
      throw new ForbiddenException('You are not assigned as the driver for this order');
    }

    // Terminal order validation
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update driver location for a completed or cancelled order');
    }

    if (order.status === OrderStatus.PENDING) {
      throw new BadRequestException('Cannot update driver location for a pending unconfirmed order');
    }

    if (!order.driverId && !isAdmin) {
      throw new BadRequestException('No driver is currently assigned to this order');
    }

    // Geographic boundary validation
    if (dto.latitude < -90 || dto.latitude > 90 || dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException('Invalid geographic coordinates: latitude must be between -90 and 90, longitude between -180 and 180');
    }

    // Timestamp & freshness validation
    let updateTime = new Date();
    if (dto.timestamp) {
      updateTime = new Date(dto.timestamp);
      if (isNaN(updateTime.getTime())) {
        throw new BadRequestException('Invalid timestamp format');
      }
      if (updateTime.getTime() > Date.now() + 60_000) {
        throw new BadRequestException('Location timestamp cannot be in the future');
      }
      if (order.driverUpdatedAt && updateTime.getTime() < order.driverUpdatedAt.getTime()) {
        throw new BadRequestException('Stale location update: order already has a newer location record');
      }
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverLat: dto.latitude,
        driverLng: dto.longitude,
        driverHeading: dto.heading ?? order.driverHeading ?? 0,
        driverUpdatedAt: updateTime,
      },
    });

    return {
      success: true,
      message: 'Driver location updated successfully',
      data: {
        orderId: order.id.toString(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        heading: dto.heading ?? order.driverHeading ?? 0,
        updatedAt: updateTime.toISOString(),
      },
    };
  }

  async assignDriver(
    adminUserId: bigint,
    orderId: number,
    dto: AssignDriverDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: { select: { name: true, imageUrl: true } },
        items: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot assign a driver to a completed or cancelled order');
    }

    if (order.status === OrderStatus.PENDING) {
      throw new BadRequestException('Cannot assign a driver to an unconfirmed order');
    }

    const now = new Date();
    const updateData: any = {
      driverId: dto.driverId,
      driverName: dto.driverName,
      driverPhone: dto.driverPhone ?? null,
      driverRating: dto.driverRating ?? 4.8,
      updatedAt: now,
    };

    if (dto.initialLat !== undefined && dto.initialLng !== undefined) {
      updateData.driverLat = dto.initialLat;
      updateData.driverLng = dto.initialLng;
      updateData.driverHeading = dto.initialHeading ?? 0;
      updateData.driverUpdatedAt = now;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        restaurant: { select: { name: true, imageUrl: true } },
        items: true,
      },
    });

    try {
      await this.notificationsService.createNotification(
        order.userId,
        'Driver Assigned',
        `${dto.driverName} has been assigned to deliver your order ${order.orderNumber}.`,
        'ORDER_UPDATE',
        order.id,
      );
    } catch {
      // Non-blocking notification
    }

    return {
      success: true,
      message: 'Driver assigned successfully',
      data: this.serializeOrder(updated),
    };
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
    confirmedAt?: Date | null;
    preparingAt?: Date | null;
    outForDeliveryAt?: Date | null;
    deliveredAt?: Date | null;
    cancelledAt?: Date | null;
    paymentMethod?: string | null;
    items: Array<{ id: number; name: string; price: unknown; quantity: number; imageUrl?: string | null }>;
    restaurant: { name: string; imageUrl: string };
  }) {
    return {
      id: order.id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: this.getStatusLabel(order.status),
      restaurantId: (order as any).restaurantId ?? null,
      restaurant: {
        id: (order as any).restaurantId ?? null,
        name: order.restaurant.name,
        image: order.restaurant.imageUrl,
      },
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
      confirmedAt: (order as any).confirmedAt?.toISOString() ?? null,
      preparingAt: (order as any).preparingAt?.toISOString() ?? null,
      outForDeliveryAt: (order as any).outForDeliveryAt?.toISOString() ?? null,
      deliveredAt: (order as any).deliveredAt?.toISOString() ?? null,
      cancelledAt: (order as any).cancelledAt?.toISOString() ?? null,
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
    confirmedAt?: Date | null;
    preparingAt?: Date | null;
    outForDeliveryAt?: Date | null;
    deliveredAt?: Date | null;
    cancelledAt?: Date | null;
    items: Array<{ id: number; name: string; price: unknown; quantity: number; imageUrl?: string | null }>;
    restaurant: { id: number; name: string; imageUrl: string; cuisineTypes: string; latitude?: unknown; longitude?: unknown };
    address: {
      label: string; address_line1: string; address_line2: string;
      city: string; state: string; postal_code: string; country: string;
      latitude?: unknown; longitude?: unknown;
    } | null;
    review?: { id: number; rating: number; comment?: string | null } | null;
    statusHistory?: Array<{ id: bigint | number; fromStatus: OrderStatus | null; toStatus: OrderStatus; createdAt: Date }>;
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
      statusHistory: order.statusHistory
        ? order.statusHistory.map((h) => ({
            id: h.id.toString(),
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            createdAt: h.createdAt.toISOString(),
          }))
        : [],
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

  private isOrderNumberUniqueConstraintError(error: any): boolean {
    if (error?.code !== 'P2002') return false;
    const target = error?.meta?.target;
    if (!target) return false;

    const isOrderNumberField = (t: unknown): boolean => {
      if (typeof t !== 'string') return false;
      const lower = t.toLowerCase();
      return (
        lower === 'order_number' ||
        lower === 'ordernumber' ||
        lower === 'orders_order_number_key' ||
        lower.endsWith('order_number_key') ||
        lower.endsWith('ordernumber_key')
      );
    };

    if (Array.isArray(target)) {
      return target.some(isOrderNumberField);
    }
    if (typeof target === 'string') {
      return isOrderNumberField(target);
    }

    return false;
  }

  private async executeOrderTransaction<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        if (
          this.isOrderNumberUniqueConstraintError(error) &&
          attempt < maxRetries - 1
        ) {
          attempt++;
          this.logger.warn(
            `Order number collision detected (P2002). Retrying order creation (attempt ${attempt + 1}/${maxRetries})...`,
          );
          continue;
        }

        if (this.isOrderNumberUniqueConstraintError(error)) {
          this.logger.error(
            `Order number collision persisted after ${maxRetries} attempts. Aborting order creation.`,
          );
          throw new ConflictException(
            'Failed to allocate a unique order identifier due to high concurrency. Please try placing your order again.',
          );
        }

        throw error;
      }
    }
    throw new ConflictException(
      'Failed to create order due to persistent conflict. Please try again.',
    );
  }
}
