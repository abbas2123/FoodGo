import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { PaymentMethodsService } from './payment-methods.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentsModule {}
