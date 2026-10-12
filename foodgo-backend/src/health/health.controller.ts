import { Controller, Get, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';

/**
 * Health endpoints for container orchestrators and load balancers.
 *
 * GET /health          — backwards-compatible combined check (always HTTP 200)
 * GET /health/live     — liveness probe: is the process alive?
 *                        Returns HTTP 200 always (if the process is dead, no response arrives).
 * GET /health/ready    — readiness probe: are required dependencies reachable?
 *                        Returns HTTP 200 (ok) or HTTP 503 (degraded/database unreachable).
 *
 * Load balancer / orchestrator configuration:
 *   • Liveness:  target GET /health/live   — unhealthy if no response (process crash)
 *   • Readiness: target GET /health/ready  — unhealthy on HTTP 503
 *
 * Security: these responses never include stack traces, connection strings,
 * credentials, or internal error details.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Combined check (backwards-compatible) ────────────────────────────────
  // Preserved for existing consumers. Always returns HTTP 200; status is
  // communicated in the body ("ok" or "degraded"). New load-balancer
  // configurations should use /health/live and /health/ready instead.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Combined health check (backwards-compatible, always HTTP 200)' })
  @ApiOkResponse({
    description: 'Application health status (check body for "ok" or "degraded")',
    schema: {
      example: {
        status: 'ok',
        database: 'connected',
        uptime: 120.45,
        timestamp: '2026-09-06T09:30:00.000Z',
      },
    },
  })
  async check() {
    const dbStatus = await this.probeDatabaseSafely();
    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      database: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  // ── Liveness probe ────────────────────────────────────────────────────────
  // Reports only that the process is alive and the HTTP server is accepting
  // connections. No dependency checks — a slow database should not cause a
  // container restart.
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe — is the process alive?' })
  @ApiOkResponse({
    description: 'Process is alive',
    schema: { example: { status: 'ok', uptime: 120.45 } },
  })
  live() {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }

  // ── Readiness probe ───────────────────────────────────────────────────────
  // Verifies that required runtime dependencies (PostgreSQL) are reachable.
  // Returns HTTP 503 when the database is unavailable so that load balancers
  // can remove this instance from the rotation.
  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe — are required dependencies available?' })
  @ApiOkResponse({
    description: 'All required dependencies are reachable',
    schema: { example: { status: 'ok', database: 'connected' } },
  })
  @ApiServiceUnavailableResponse({
    description: 'One or more required dependencies are unavailable',
    schema: { example: { status: 'degraded', database: 'error' } },
  })
  async ready() {
    const dbStatus = await this.probeDatabaseSafely();
    const isReady = dbStatus === 'connected';

    if (!isReady) {
      // Throw an HttpException so NestJS's built-in filter returns HTTP 503
      // with a clean JSON body — no stack traces, no connection strings.
      throw new HttpException(
        { status: 'degraded', database: dbStatus },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', database: dbStatus };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Probes the database with SELECT 1.
   * Returns 'connected' on success, 'error' on any failure.
   * Never throws or leaks error details to callers.
   */
  private async probeDatabaseSafely(): Promise<'connected' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch {
      // Intentionally swallowed — no stack traces, connection strings,
      // or internal details are exposed in health check responses.
      return 'error';
    }
  }
}
