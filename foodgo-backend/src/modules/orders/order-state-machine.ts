import { OrderStatus } from '../../generated/prisma/client.js';

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransitionOrderStatus(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

export function getAllowedNextStatuses(currentStatus: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED;
}

export function getStatusNotification(
  status: OrderStatus,
  orderNumber: string,
): { title: string; message: string } | null {
  switch (status) {
    case OrderStatus.CONFIRMED:
      return {
        title: 'Order Confirmed',
        message: `Your order ${orderNumber} has been confirmed.`,
      };
    case OrderStatus.PREPARING:
      return {
        title: 'Order Preparing',
        message: `Your order ${orderNumber} is being prepared.`,
      };
    case OrderStatus.OUT_FOR_DELIVERY:
      return {
        title: 'Order Out for Delivery',
        message: `Your order ${orderNumber} is out for delivery.`,
      };
    case OrderStatus.DELIVERED:
      return {
        title: 'Order Delivered',
        message: `Your order ${orderNumber} has been delivered.`,
      };
    case OrderStatus.CANCELLED:
      return {
        title: 'Order Cancelled',
        message: `Your order ${orderNumber} has been cancelled.`,
      };
    default:
      return null;
  }
}
