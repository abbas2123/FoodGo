import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CartsController } from './carts.controller.js';
import { CartsService } from './carts.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
