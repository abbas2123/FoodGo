import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
