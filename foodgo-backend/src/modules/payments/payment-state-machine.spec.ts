import { describe, expect, it } from 'vitest';
import { PaymentStatus } from '../../generated/prisma/client.js';
import {
  canTransitionPaymentStatus,
  isTerminalPaymentStatus,
} from './payment-state-machine.js';

describe('Payment State Machine', () => {
  describe('Valid Transitions', () => {
    it('allows CREATED -> PENDING', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.CREATED, PaymentStatus.PENDING)).toBe(true);
    });

    it('allows CREATED -> CANCELLED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.CREATED, PaymentStatus.CANCELLED)).toBe(true);
    });

    it('allows CREATED -> FAILED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.CREATED, PaymentStatus.FAILED)).toBe(true);
    });

    it('allows PENDING -> SUCCESS', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.PENDING, PaymentStatus.SUCCESS)).toBe(true);
    });

    it('allows PENDING -> FAILED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.PENDING, PaymentStatus.FAILED)).toBe(true);
    });

    it('allows PENDING -> CANCELLED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.PENDING, PaymentStatus.CANCELLED)).toBe(true);
    });

    it('allows SUCCESS -> REFUNDED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.SUCCESS, PaymentStatus.REFUNDED)).toBe(true);
    });

    it('allows SUCCESS -> PARTIALLY_REFUNDED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.SUCCESS, PaymentStatus.PARTIALLY_REFUNDED)).toBe(true);
    });

    it('allows FAILED -> PENDING (retry)', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.FAILED, PaymentStatus.PENDING)).toBe(true);
    });

    it('allows FAILED -> SUCCESS (webhook reconciliation)', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.FAILED, PaymentStatus.SUCCESS)).toBe(true);
    });

    it('allows PARTIALLY_REFUNDED -> REFUNDED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED)).toBe(true);
    });
  });

  describe('Invalid Transitions', () => {
    it('rejects CREATED -> SUCCESS (must go through PENDING)', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.CREATED, PaymentStatus.SUCCESS)).toBe(false);
    });

    it('rejects SUCCESS -> PENDING', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.SUCCESS, PaymentStatus.PENDING)).toBe(false);
    });

    it('rejects SUCCESS -> FAILED', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.SUCCESS, PaymentStatus.FAILED)).toBe(false);
    });

    it('rejects CANCELLED -> SUCCESS', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.CANCELLED, PaymentStatus.SUCCESS)).toBe(false);
    });

    it('rejects CANCELLED -> PENDING', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.CANCELLED, PaymentStatus.PENDING)).toBe(false);
    });

    it('rejects REFUNDED -> SUCCESS', () => {
      expect(canTransitionPaymentStatus(PaymentStatus.REFUNDED, PaymentStatus.SUCCESS)).toBe(false);
    });

    it('rejects self transitions', () => {
      for (const status of Object.values(PaymentStatus)) {
        expect(canTransitionPaymentStatus(status, status)).toBe(false);
      }
    });
  });

  describe('Terminal Statuses', () => {
    it('identifies terminal statuses correctly', () => {
      expect(isTerminalPaymentStatus(PaymentStatus.CANCELLED)).toBe(true);
      expect(isTerminalPaymentStatus(PaymentStatus.REFUNDED)).toBe(true);
      expect(isTerminalPaymentStatus(PaymentStatus.CREATED)).toBe(false);
      expect(isTerminalPaymentStatus(PaymentStatus.PENDING)).toBe(false);
      expect(isTerminalPaymentStatus(PaymentStatus.SUCCESS)).toBe(false);
    });
  });
});
