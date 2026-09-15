import { Test, TestingModule } from '@nestjs/testing';
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

  it('should return healthy status when database is connected', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
  });

  it('should return degraded status when database query fails', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('Connection failed'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('error');
  });
});
