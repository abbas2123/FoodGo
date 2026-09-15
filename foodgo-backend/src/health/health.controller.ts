import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check application and database health' })
  @ApiOkResponse({
    description: 'Application is healthy',
    schema: {
      example: {
        success: true,
        message: 'Application is healthy',
        data: {
          status: 'ok',
          database: 'connected',
          uptime: 120.45,
          timestamp: '2026-09-06T09:30:00.000Z',
        },
      },
    },
  })
  async check() {
    let databaseStatus = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch {
      databaseStatus = 'error';
    }

    return {
      message: 'Application is healthy',
      status: databaseStatus === 'connected' ? 'ok' : 'degraded',
      database: databaseStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
