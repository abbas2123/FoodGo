import { PaymentStatus } from '../../generated/prisma/client.js';

export const PAYMENT_STATUS_TRANSITIONS: Record<
  PaymentStatus,
  readonly PaymentStatus[]
> = {
  [PaymentStatus.CREATED]: [
    PaymentStatus.PENDING,
    PaymentStatus.CANCELLED,
    PaymentStatus.FAILED,
  ],
  [PaymentStatus.PENDING]: [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.SUCCESS]: [
    PaymentStatus.REFUNDED,
    PaymentStatus.PARTIALLY_REFUNDED,
  ],
  [PaymentStatus.FAILED]: [
    PaymentStatus.PENDING,
    PaymentStatus.SUCCESS,
  ], // Allow retry or gateway webhook reconciliation
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED],
};

export function canTransitionPaymentStatus(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): boolean {
  if (currentStatus === nextStatus) return false;
  const allowed = PAYMENT_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.CANCELLED ||
    status === PaymentStatus.REFUNDED
  );
}
