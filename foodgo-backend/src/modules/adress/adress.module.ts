import { Module } from '@nestjs/common';
import { AdressController } from './adress.controller.js';
import { AdressService } from './adress.service.js';
import { JwtModule } from '@nestjs/jwt';
@Module({
  imports: [JwtModule.register({})],
  controllers: [AdressController],
  providers: [AdressService],
  exports: [AdressService],
})
export class AdressModule {}
