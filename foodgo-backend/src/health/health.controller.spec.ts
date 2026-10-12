import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: {
    $queryRaw: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET /health (combined, backwards-compatible) ──────────────────────────

  describe('check() — GET /health', () => {
    it('returns status ok when database is connected', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it('returns status degraded when database query fails', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.database).toBe('error');
    });

    it('does not expose the database error message in the response', async () => {
      prismaMock.$queryRaw.mockRejectedValue(
        new Error('password authentication failed for user "admin"'),
      );

      const result = await controller.check();
      const body = JSON.stringify(result);

      expect(body).not.toContain('password authentication failed');
      expect(body).not.toContain('admin');
    });
  });

  // ── GET /health/live ──────────────────────────────────────────────────────

  describe('live() — GET /health/live', () => {
    it('returns status ok and uptime without querying the database', () => {
      const result = controller.live();

      expect(result.status).toBe('ok');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      // live() must not call the database
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ── GET /health/ready ─────────────────────────────────────────────────────

  describe('ready() — GET /health/ready', () => {
    it('returns HTTP 200 with status ok when database is connected', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await controller.ready();

      expect(result).toEqual({ status: 'ok', database: 'connected' });
    });

    it('throws HttpException with HTTP 503 when database is unavailable', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(controller.ready()).rejects.toThrow(HttpException);

      try {
        await controller.ready();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);

        const body = (err as HttpException).getResponse();
        expect(body).toMatchObject({ status: 'degraded', database: 'error' });
      }
    });

    it('does not expose raw database error details in the 503 body', async () => {
      prismaMock.$queryRaw.mockRejectedValue(
        new Error('password authentication failed for user "admin"'),
      );

      try {
        await controller.ready();
      } catch (err) {
        const body = JSON.stringify((err as HttpException).getResponse());
        expect(body).not.toContain('password authentication failed');
        expect(body).not.toContain('admin');
        expect(body).not.toContain('ECONNREFUSED');
      }
    });
  });
});
