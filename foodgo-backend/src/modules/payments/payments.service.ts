import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrderStatus, PaymentProvider, PaymentStatus } from '../../generated/prisma/client.js';
import { PaymentGatewayService } from './services/payment-gateway.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';
import { PaymentFailureDto } from './dto/payment-failure.dto.js';
import { canTransitionPaymentStatus } from './payment-state-machine.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── 1. Create Payment Order (Server-Authoritative) ──────────────────────────

  async createPaymentOrder(userId: bigint, dto: CreatePaymentOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to pay for this order');
    }

    // Verify order is payable
    if (order.paymentStatus === 'PAID' || order.status === OrderStatus.CONFIRMED) {
      throw new BadRequestException('This order has already been paid and confirmed');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot initiate payment for a cancelled order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order cannot accept payment in ${order.status} status`);
    }

    // Server-authoritative amount from database (never from client)
    let amount = Number(order.grandTotal);
    if (order.checkoutGroupId) {
      const groupOrders = await this.prisma.order.findMany({
        where: { checkoutGroupId: order.checkoutGroupId, userId },
      });
      amount = parseFloat(
        groupOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0).toFixed(2),
      );
    }
    const currency = 'INR';

    // Check for existing active pending transaction for this order
    const existingTx = await this.prisma.paymentTransaction.findFirst({
      where: {
        orderId: order.id,
        status: PaymentStatus.PENDING,
        providerOrderId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingTx && existingTx.providerOrderId) {
      return {
        success: true,
        message: 'Active payment session retrieved',
        data: {
          transactionId: existingTx.id.toString(),
          orderId: order.id,
          orderNumber: order.orderNumber,
          providerOrderId: existingTx.providerOrderId,
          amount: Number(existingTx.amount),
          currency: existingTx.currency,
          keyId: this.paymentGatewayService.getPublicKeyId(),
        },
      };
    }

    // Create order with gateway
    const providerOrder = await this.paymentGatewayService.createOrder({
      amount,
      currency,
      receipt: order.orderNumber,
      notes: {
        orderId: order.id.toString(),
        userId: userId.toString(),
        checkoutGroupId: order.checkoutGroupId ?? '',
      },
    });

    // Record PaymentTransaction in PostgreSQL
    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        userId,
        provider: PaymentProvider.RAZORPAY,
        providerOrderId: providerOrder.providerOrderId,
        amount,
        currency: providerOrder.currency,
        status: PaymentStatus.PENDING,
      },
    });

    return {
      success: true,
      message: 'Payment order created successfully',
      data: {
        transactionId: transaction.id.toString(),
        orderId: order.id,
        orderNumber: order.orderNumber,
        providerOrderId: providerOrder.providerOrderId,
        amount,
        currency: providerOrder.currency,
        keyId: this.paymentGatewayService.getPublicKeyId(),
      },
    };
  }

  // ─── 2. Verify Payment (Cryptographic & Transaction-Safe) ────────────────────

  async verifyPayment(userId: bigint, dto: VerifyPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to verify payment for this order');
    }

    // Idempotency: If this exact payment ID was already verified and order confirmed, return success safely
    const alreadyVerifiedTx = await this.prisma.paymentTransaction.findFirst({
      where: {
        orderId: order.id,
        providerPaymentId: dto.providerPaymentId,
        status: PaymentStatus.SUCCESS,
      },
    });

    if (alreadyVerifiedTx && order.paymentStatus === 'PAID') {
      return {
        success: true,
        message: 'Payment already verified successfully (idempotent)',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          providerPaymentId: dto.providerPaymentId,
        },
      };
    }

    // Replay attack prevention: Ensure this providerPaymentId hasn't already been used on a different order
    const existingPaymentForOtherOrder = await this.prisma.paymentTransaction.findFirst({
      where: {
        providerPaymentId: dto.providerPaymentId,
        status: PaymentStatus.SUCCESS,
        orderId: { not: order.id },
      },
    });

    if (existingPaymentForOtherOrder) {
      this.logger.warn(
        `Replay attack prevented: providerPaymentId ${dto.providerPaymentId} has already been applied to order ${existingPaymentForOtherOrder.orderId}`,
      );
      throw new BadRequestException('Payment identifier has already been applied to another order');
    }

    // Find the associated pending payment transaction
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        orderId: order.id,
        providerOrderId: dto.providerOrderId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Matching payment transaction not found for this order');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException('You do not have permission to verify this payment transaction');
    }

    if (transaction.status === PaymentStatus.SUCCESS) {
      // Already marked success
      return {
        success: true,
        message: 'Payment already completed',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      };
    }

    if (!canTransitionPaymentStatus(transaction.status, PaymentStatus.SUCCESS)) {
      throw new BadRequestException(
        `Cannot verify payment: transaction is in invalid status (${transaction.status})`,
      );
    }

    // Verify amount and currency match order total (or checkout group total)
    let expectedAmount = Number(order.grandTotal);
    if (order.checkoutGroupId) {
      const groupOrders = await this.prisma.order.findMany({
        where: { checkoutGroupId: order.checkoutGroupId, userId },
      });
      expectedAmount = parseFloat(
        groupOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0).toFixed(2),
      );
    }

    if (transaction.amount != null) {
      if (Number(transaction.amount) !== expectedAmount) {
        await this.prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: PaymentStatus.FAILED,
            failureCode: 'AMOUNT_MISMATCH',
            failureMessage: 'Payment transaction amount does not match order grand total',
          },
        });
        throw new BadRequestException('Payment transaction amount mismatch');
      }
    }

    if (transaction.currency && transaction.currency !== 'INR') {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.FAILED,
          failureCode: 'CURRENCY_MISMATCH',
          failureMessage: 'Payment transaction currency does not match INR',
        },
      });
      throw new BadRequestException('Payment transaction currency mismatch');
    }

    // Cryptographic signature verification
    const isSignatureValid = this.paymentGatewayService.verifyPaymentSignature(
      dto.providerOrderId,
      dto.providerPaymentId,
      dto.providerSignature,
    );

    if (!isSignatureValid) {
      // Mark transaction as failed due to signature mismatch
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.FAILED,
          failureCode: 'INVALID_SIGNATURE',
          failureMessage: 'Payment signature verification failed',
        },
      });

      throw new BadRequestException('Invalid payment signature');
    }

    // Atomic confirmation in a single PostgreSQL transaction
    const now = new Date();
    const orderIdsToConfirm: number[] = [order.id];

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Atomic conditional update on transaction
        const updatedTx = await tx.paymentTransaction.updateMany({
          where: {
            id: transaction.id,
            status: PaymentStatus.PENDING,
          },
          data: {
            status: PaymentStatus.SUCCESS,
            providerPaymentId: dto.providerPaymentId,
            providerSignature: dto.providerSignature,
            paidAt: now,
            updatedAt: now,
          },
        });

        if (updatedTx.count === 0) {
          // Check if concurrent request already succeeded
          const checkTx = await tx.paymentTransaction.findUnique({
            where: { id: transaction.id },
          });
          if (checkTx?.status === PaymentStatus.SUCCESS) {
            return tx.order.findUniqueOrThrow({ where: { id: order.id } });
          }
          throw new ConflictException('Payment transaction was concurrently modified');
        }

        // If order has a checkout group, find all orders in that group to confirm atomically
        if (order.checkoutGroupId) {
          const siblingOrders = await tx.order.findMany({
            where: { checkoutGroupId: order.checkoutGroupId, userId },
          });
          for (const so of siblingOrders) {
            if (!orderIdsToConfirm.includes(so.id)) {
              orderIdsToConfirm.push(so.id);
            }
          }
        }

        let mainUpdatedOrder: any = null;
        for (const oId of orderIdsToConfirm) {
          const upd = await tx.order.update({
            where: { id: oId },
            data: {
              paymentStatus: 'PAID',
              paymentMethod: 'RAZORPAY',
              status: OrderStatus.CONFIRMED,
              confirmedAt: now,
              updatedAt: now,
            },
          });
          if (oId === order.id) {
            mainUpdatedOrder = upd;
          }

          // Record immutable OrderStatusHistory
          await tx.orderStatusHistory.create({
            data: {
              orderId: oId,
              fromStatus: order.status,
              toStatus: OrderStatus.CONFIRMED,
              changedByUserId: userId,
              reason: 'Payment verified successfully via Razorpay',
            },
          });
        }

        // Clear user's server cart after verified payment
        if ((tx as any).cart) {
          const userCart = await tx.cart.findUnique({ where: { userId } });
          if (userCart) {
            await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
            await tx.cart.update({
              where: { id: userCart.id },
              data: { restaurantId: null },
            });
          }
        }

        return mainUpdatedOrder || order;
      });

      // Non-blocking in-app notification to customer for each confirmed order
      try {
        const confirmedOrders = await this.prisma.order.findMany?.({
          where: { id: { in: orderIdsToConfirm } },
        });
        if (confirmedOrders && confirmedOrders.length > 0) {
          for (const co of confirmedOrders) {
            await this.notificationsService.createNotification(
              userId,
              'Order Confirmed',
              `Your order ${co.orderNumber} has been confirmed. Payment received via Razorpay.`,
              'ORDER_UPDATE',
              co.id,
            );
          }
        } else {
          await this.notificationsService.createNotification(
            userId,
            'Order Confirmed',
            `Your order ${result.orderNumber} has been confirmed. Payment received via Razorpay.`,
            'ORDER_UPDATE',
            result.id,
          );
        }
      } catch {
        // Non-blocking
      }

      return {
        success: true,
        message: 'Payment verified and order confirmed successfully',
        data: {
          orderId: result.id,
          orderNumber: result.orderNumber,
          status: result.status,
          paymentStatus: result.paymentStatus,
          providerPaymentId: dto.providerPaymentId,
        },
      };
    } catch (err: any) {
      this.logger.error(`Error confirming paid order: ${err.message}`);
      throw err;
    }
  }

  // ─── 3. Record Payment Failure / Cancellation ───────────────────────────────

  async recordPaymentFailure(userId: bigint, dto: PaymentFailureDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        orderId: order.id,
        providerOrderId: dto.providerOrderId,
      },
    });

    if (transaction && transaction.status === PaymentStatus.PENDING) {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.FAILED,
          failureCode: dto.code || 'PAYMENT_FAILED',
          failureMessage: dto.description || 'Payment was unsuccessful or cancelled by user',
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: 'Payment failure recorded',
      data: {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      },
    };
  }

  // ─── 4. Get Payment Transactions for an Order ────────────────────────────────

  async getOrderPayments(userId: bigint, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const transactions = await this.prisma.paymentTransaction.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        transactions: transactions.map((t) => ({
          id: t.id.toString(),
          provider: t.provider,
          providerOrderId: t.providerOrderId,
          providerPaymentId: t.providerPaymentId,
          amount: Number(t.amount),
          currency: t.currency,
          status: t.status,
          failureCode: t.failureCode,
          failureMessage: t.failureMessage,
          createdAt: t.createdAt.toISOString(),
          paidAt: t.paidAt?.toISOString() ?? null,
        })),
      },
    };
  }

  // ─── 5. Webhook Reconciler ───────────────────────────────────────────────────

  private isDuplicateWebhookError(error: any): boolean {
    if (error?.code !== 'P2002') return false;
    const target = error?.meta?.target;
    if (Array.isArray(target)) {
      return (
        (target.includes('provider') &&
          (target.includes('event_id') || target.includes('eventId'))) ||
        target.some((t: string) => t.includes('provider_event_id'))
      );
    }
    if (typeof target === 'string') {
      return (
        target.includes('provider_event_id') ||
        target.includes('processed_webhook_events')
      );
    }
    return false;
  }

  async handleWebhook(
    signature: string,
    rawBody: string,
    eventData: any,
    eventIdHeader?: string,
  ) {
    const isValid = this.paymentGatewayService.verifyWebhookSignature(
      rawBody,
      signature,
    );

    if (!isValid) {
      this.logger.warn('Webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = eventData?.event;
    this.logger.log(`Processing Razorpay webhook event: ${event}`);

    // Resolve unique provider event identifier from header, payload, or entity
    const eventId = (
      eventIdHeader ||
      eventData?.event_id ||
      eventData?.id ||
      (eventData?.payload?.payment?.entity?.id
        ? `evt_${event ?? 'unknown'}_${eventData.payload.payment.entity.id}`
        : undefined) ||
      (eventData?.payload?.order?.entity?.id
        ? `evt_${event ?? 'unknown'}_${eventData.payload.order.entity.id}`
        : undefined) ||
      (eventData?.payload?.refund?.entity?.id
        ? `evt_${event ?? 'unknown'}_${eventData.payload.refund.entity.id}`
        : undefined) ||
      (eventData?.payload?.payment?.entity?.order_id
        ? `evt_${event ?? 'unknown'}_${eventData.payload.payment.entity.order_id}`
        : undefined)
    )?.toString().trim();

    if (!eventId) {
      this.logger.warn('Webhook rejected: Missing provider event identifier');
      throw new BadRequestException('Missing webhook event identifier');
    }

    // Fast-path: Check if this event was already persisted and processed
    const existingEvent = await this.prisma.processedWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: PaymentProvider.RAZORPAY,
          eventId,
        },
      },
    });

    if (existingEvent) {
      this.logger.log(
        `Webhook event ${eventId} (${event}) was already processed at ${existingEvent.processedAt.toISOString()}`,
      );
      return { status: 'already_processed', eventId };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (event === 'order.paid' || event === 'payment.captured') {
          const paymentEntity =
            eventData.payload?.payment?.entity || eventData.payload?.order?.entity;
          const providerOrderId = paymentEntity?.order_id;
          const providerPaymentId = paymentEntity?.id;

          if (!providerOrderId) {
            return { status: 'ignored_missing_order_id', eventId };
          }

          const transaction = await tx.paymentTransaction.findFirst({
            where: { providerOrderId },
            include: { order: true },
          });

          if (!transaction) {
            this.logger.warn(
              `Webhook: Transaction not found for providerOrderId: ${providerOrderId}`,
            );
            return { status: 'transaction_not_found', eventId };
          }

          // Atomic event registration guarded by @@unique([provider, eventId])
          await tx.processedWebhookEvent.create({
            data: {
              provider: PaymentProvider.RAZORPAY,
              eventId,
              eventType: event || 'unknown',
            },
          });

          if (transaction.status === PaymentStatus.SUCCESS) {
            return { status: 'already_processed', eventId };
          }

          const now = new Date();
          await tx.paymentTransaction.update({
            where: { id: transaction.id },
            data: {
              status: PaymentStatus.SUCCESS,
              providerPaymentId: providerPaymentId || transaction.providerPaymentId,
              paidAt: now,
              updatedAt: now,
            },
          });

          // Always check fresh order status inside the transaction to prevent race conditions
          const freshOrder = tx.order.findUnique
            ? await tx.order.findUnique({ where: { id: transaction.orderId } })
            : transaction.order;

          const orderToConfirm = freshOrder || transaction.order;
          if (orderToConfirm && orderToConfirm.status === OrderStatus.PENDING) {
            const orderIdsToConfirm: number[] = [orderToConfirm.id];
            if (orderToConfirm.checkoutGroupId) {
              const siblingOrders = await tx.order.findMany({
                where: {
                  checkoutGroupId: orderToConfirm.checkoutGroupId,
                  userId: transaction.userId,
                },
              });
              for (const so of siblingOrders) {
                if (!orderIdsToConfirm.includes(so.id)) {
                  orderIdsToConfirm.push(so.id);
                }
              }
            }

            for (const oId of orderIdsToConfirm) {
              await tx.order.update({
                where: { id: oId },
                data: {
                  paymentStatus: 'PAID',
                  paymentMethod: 'RAZORPAY',
                  status: OrderStatus.CONFIRMED,
                  confirmedAt: now,
                  updatedAt: now,
                },
              });

              await tx.orderStatusHistory.create({
                data: {
                  orderId: oId,
                  fromStatus: OrderStatus.PENDING,
                  toStatus: OrderStatus.CONFIRMED,
                  changedByUserId: transaction.userId,
                  reason: 'Payment confirmed via Razorpay Webhook',
                },
              });
            }

            // Clear user cart upon webhook payment confirmation
            if ((tx as any).cart) {
              const userCart = await tx.cart.findUnique({
                where: { userId: transaction.userId },
              });
              if (userCart) {
                await tx.cartItem.deleteMany({
                  where: { cartId: userCart.id },
                });
                await tx.cart.update({
                  where: { id: userCart.id },
                  data: { restaurantId: null },
                });
              }
            }
          }

          return { status: 'success', eventId };
        }

        if (event === 'payment.failed') {
          const paymentEntity = eventData.payload?.payment?.entity;
          const providerOrderId = paymentEntity?.order_id;

          if (providerOrderId) {
            await tx.paymentTransaction.updateMany({
              where: { providerOrderId, status: PaymentStatus.PENDING },
              data: {
                status: PaymentStatus.FAILED,
                failureCode: paymentEntity.error_code || 'GATEWAY_ERROR',
                failureMessage:
                  paymentEntity.error_description || 'Payment failed at gateway',
                updatedAt: new Date(),
              },
            });
          }
          return { status: 'failure_recorded', eventId };
        }

        if (event === 'refund.processed' || event === 'refund.created') {
          const paymentEntity =
            eventData.payload?.payment?.entity || eventData.payload?.refund?.entity;
          const providerOrderId = paymentEntity?.order_id;

          if (providerOrderId) {
            await tx.paymentTransaction.updateMany({
              where: { providerOrderId },
              data: {
                status: PaymentStatus.REFUNDED,
                failureMessage: 'Payment refunded via gateway',
                updatedAt: new Date(),
              },
            });
          }
          return { status: 'refund_recorded', eventId };
        }

        return { status: 'event_ignored', eventId };
      });
    } catch (error: any) {
      if (this.isDuplicateWebhookError(error)) {
        this.logger.log(
          `Concurrent duplicate delivery for event ${eventId} safely intercepted via unique constraint.`,
        );
        return { status: 'already_processed', eventId };
      }
      this.logger.error(
        `Error processing webhook event ${eventId}: ${error?.message}`,
        error?.stack,
      );
      throw error;
    }
  }
}
