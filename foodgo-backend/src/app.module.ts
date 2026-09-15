import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { createObserveModule } from '@nestjs/observe';
import configuration from './config/configuration.js';
import { validate } from './config/env.validation.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { LocationModule } from './modules/location/location.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { AdressModule } from './modules/adress/adress.module.js';
import { RestaurantsModule } from './modules/restaurants/restaurants.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { FavoritesModule } from './modules/favorites/favorites.module.js';
import { CartsModule } from './modules/carts/carts.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const isObserveConfigured =
  Boolean(process.env.OBSERVE_APP_KEY) &&
  process.env.OBSERVE_APP_KEY !== 'YOUR_APP_KEY' &&
  process.env.OBSERVE_APP_KEY !== 'OPTIONAL_OBSERVE_KEY';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'DISABLED',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'DISABLED',
      serviceId: 'foodgo-backend',
      tracesSampleRate: isObserveConfigured ? 1.0 : 0,
      runtimeMetrics: isObserveConfigured,
      forwardLogs: false,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [configuration],
      validate,
    }),
    PrismaModule,
    AuthModule,
    LocationModule,
    HealthModule,
    ProfileModule,
    PaymentsModule,
    AdressModule,
    RestaurantsModule,
    OrdersModule,
    FavoritesModule,
    CartsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
