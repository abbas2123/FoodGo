import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentGatewayService } from './services/payment-gateway.service.js';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { PaymentMethodsService } from './payment-methods.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [PaymentsController, PaymentMethodsController],
  providers: [PaymentsService, PaymentGatewayService, PaymentMethodsService],
  exports: [PaymentsService, PaymentGatewayService, PaymentMethodsService],
})
export class PaymentsModule {}
