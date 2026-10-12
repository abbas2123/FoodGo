import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
