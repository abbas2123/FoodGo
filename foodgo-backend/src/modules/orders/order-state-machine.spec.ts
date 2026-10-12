import { describe, expect, it } from 'vitest';
import { OrderStatus } from '../../generated/prisma/client.js';
import {
  canTransitionOrderStatus,
  getAllowedNextStatuses,
  getStatusNotification,
  isTerminalStatus,
} from './order-state-machine.js';

describe('Order State Machine', () => {
  describe('Valid State Transitions', () => {
    it('allows PENDING -> CONFIRMED', () => {
      expect(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    });

    it('allows PENDING -> CANCELLED', () => {
      expect(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    });

    it('allows CONFIRMED -> PREPARING', () => {
      expect(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.PREPARING)).toBe(true);
    });

    it('allows CONFIRMED -> CANCELLED', () => {
      expect(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    });

    it('allows PREPARING -> OUT_FOR_DELIVERY', () => {
      expect(canTransitionOrderStatus(OrderStatus.PREPARING, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
    });

    it('allows OUT_FOR_DELIVERY -> DELIVERED', () => {
      expect(canTransitionOrderStatus(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
    });
  });

  describe('Invalid State Transitions', () => {
    it('rejects PENDING -> DELIVERED', () => {
      expect(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
    });

    it('rejects PENDING -> PREPARING', () => {
      expect(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.PREPARING)).toBe(false);
    });

    it('rejects PENDING -> OUT_FOR_DELIVERY', () => {
      expect(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
    });

    it('rejects CONFIRMED -> DELIVERED', () => {
      expect(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.DELIVERED)).toBe(false);
    });

    it('rejects CONFIRMED -> OUT_FOR_DELIVERY', () => {
      expect(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
    });

    it('rejects PREPARING -> CANCELLED', () => {
      expect(canTransitionOrderStatus(OrderStatus.PREPARING, OrderStatus.CANCELLED)).toBe(false);
    });

    it('rejects OUT_FOR_DELIVERY -> CANCELLED', () => {
      expect(canTransitionOrderStatus(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED)).toBe(false);
    });

    it('rejects DELIVERED -> PREPARING', () => {
      expect(canTransitionOrderStatus(OrderStatus.DELIVERED, OrderStatus.PREPARING)).toBe(false);
    });

    it('rejects DELIVERED -> CANCELLED', () => {
      expect(canTransitionOrderStatus(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
    });

    it('rejects CANCELLED -> CONFIRMED', () => {
      expect(canTransitionOrderStatus(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
    });

    it('rejects CANCELLED -> DELIVERED', () => {
      expect(canTransitionOrderStatus(OrderStatus.CANCELLED, OrderStatus.DELIVERED)).toBe(false);
    });

    it('rejects self-transitions (e.g. PENDING -> PENDING)', () => {
      for (const status of Object.values(OrderStatus)) {
        expect(canTransitionOrderStatus(status, status)).toBe(false);
      }
    });
  });

  describe('Terminal Statuses and Helpers', () => {
    it('identifies terminal statuses correctly', () => {
      expect(isTerminalStatus(OrderStatus.DELIVERED)).toBe(true);
      expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
      expect(isTerminalStatus(OrderStatus.PENDING)).toBe(false);
      expect(isTerminalStatus(OrderStatus.CONFIRMED)).toBe(false);
      expect(isTerminalStatus(OrderStatus.PREPARING)).toBe(false);
      expect(isTerminalStatus(OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
    });

    it('returns allowed next statuses accurately', () => {
      expect(getAllowedNextStatuses(OrderStatus.PENDING)).toEqual([
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ]);
      expect(getAllowedNextStatuses(OrderStatus.DELIVERED)).toEqual([]);
      expect(getAllowedNextStatuses(OrderStatus.CANCELLED)).toEqual([]);
    });

    it('provides status notifications with order number', () => {
      const notif = getStatusNotification(OrderStatus.CONFIRMED, 'FG123456');
      expect(notif).toEqual({
        title: 'Order Confirmed',
        message: 'Your order FG123456 has been confirmed.',
      });
    });
  });
});
