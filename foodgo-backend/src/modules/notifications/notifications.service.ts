import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: bigint) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: n.isRead,
          orderId: n.orderId,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      },
    };
  }

  async markAsRead(userId: bigint, id: number) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return {
      success: true,
      message: 'Notification marked as read',
      data: {
        id: updated.id,
        title: updated.title,
        message: updated.message,
        type: updated.type,
        isRead: updated.isRead,
        orderId: updated.orderId,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  }

  async markAllAsRead(userId: bigint) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return {
      success: true,
      message: 'All notifications marked as read',
      data: null,
    };
  }

  async deleteNotification(userId: bigint, id: number) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Notification deleted successfully',
      data: null,
    };
  }

  async clearAll(userId: bigint) {
    await this.prisma.notification.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: 'All notifications cleared',
      data: null,
    };
  }

  async createNotification(
    userId: bigint,
    title: string,
    message: string,
    type: string = 'ORDER_UPDATE',
    orderId?: number,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        orderId,
      },
    });

    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      orderId: notification.orderId,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
