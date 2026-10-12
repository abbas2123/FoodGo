import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaMock: {
    notification: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      notification: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should return user notifications and unread count', async () => {
      const mockList = [
        {
          id: 1,
          userId: 10n,
          title: 'Order Placed',
          message: 'Your order is placed',
          type: 'ORDER_UPDATE',
          isRead: false,
          orderId: 5,
          createdAt: new Date('2026-09-15T12:00:00Z'),
        },
      ];
      prismaMock.notification.findMany.mockResolvedValue(mockList);
      prismaMock.notification.count.mockResolvedValue(1);

      const res = await service.getNotifications(10n);

      expect(res.success).toBe(true);
      expect(res.data.notifications).toHaveLength(1);
      expect(res.data.notifications[0].title).toBe('Order Placed');
      expect(res.data.unreadCount).toBe(1);
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 10n },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read when owned by user', async () => {
      prismaMock.notification.findFirst.mockResolvedValue({
        id: 1,
        userId: 10n,
        title: 'Order Placed',
        message: 'Your order is placed',
        type: 'ORDER_UPDATE',
        isRead: false,
        orderId: 5,
        createdAt: new Date(),
      });
      prismaMock.notification.update.mockResolvedValue({
        id: 1,
        title: 'Order Placed',
        message: 'Your order is placed',
        type: 'ORDER_UPDATE',
        isRead: true,
        orderId: 5,
        createdAt: new Date(),
      });

      const res = await service.markAsRead(10n, 1);
      expect(res.success).toBe(true);
      expect(res.data.isRead).toBe(true);
    });

    it('should throw NotFoundException if notification does not belong to user', async () => {
      prismaMock.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead(10n, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      prismaMock.notification.updateMany.mockResolvedValue({ count: 3 });

      const res = await service.markAllAsRead(10n);
      expect(res.success).toBe(true);
      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 10n, isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification owned by user', async () => {
      prismaMock.notification.findFirst.mockResolvedValue({ id: 1, userId: 10n });
      prismaMock.notification.delete.mockResolvedValue({ id: 1 });

      const res = await service.deleteNotification(10n, 1);
      expect(res.success).toBe(true);
      expect(prismaMock.notification.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if notification not found for user', async () => {
      prismaMock.notification.findFirst.mockResolvedValue(null);

      await expect(service.deleteNotification(10n, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearAll', () => {
    it('should delete all notifications for user', async () => {
      prismaMock.notification.deleteMany.mockResolvedValue({ count: 5 });

      const res = await service.clearAll(10n);
      expect(res.success).toBe(true);
      expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: 10n },
      });
    });
  });

  describe('createNotification', () => {
    it('should create a notification for user', async () => {
      prismaMock.notification.create.mockResolvedValue({
        id: 1,
        userId: 10n,
        title: 'New Promo',
        message: '20% off',
        type: 'PROMO',
        isRead: false,
        orderId: null,
        createdAt: new Date(),
      });

      const res = await service.createNotification(10n, 'New Promo', '20% off', 'PROMO');
      expect(res.id).toBe(1);
      expect(res.title).toBe('New Promo');
      expect(res.type).toBe('PROMO');
    });
  });
});
