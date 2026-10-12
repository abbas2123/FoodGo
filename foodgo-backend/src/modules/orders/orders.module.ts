import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminOrdersController } from './admin-orders.controller.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, RolesGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
