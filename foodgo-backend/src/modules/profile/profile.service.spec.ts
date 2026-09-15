import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus, UserType } from '../../generated/prisma/client.js';

describe('ProfileService', () => {
  let service: ProfileService;
  let prismaMock: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile with phone', async () => {
      const mockUser = {
        id: 1n,
        name: 'John Doe',
        email: 'john@example.com',
        profileImageUrl: null,
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        auth: {
          phone: '+14155552671',
        },
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile(1n);

      expect(result.id).toBe('1');
      expect(result.name).toBe('John Doe');
      expect(result.phone).toBe('+14155552671');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1n },
        include: { auth: true },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile(99n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update name successfully', async () => {
      const mockUpdated = {
        id: 1n,
        name: 'Jane Doe',
        email: null,
        profileImageUrl: null,
        type: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        auth: {
          phone: '+14155552671',
        },
      };
      prismaMock.user.update.mockResolvedValue(mockUpdated);

      const result = await service.updateProfile(1n, { name: 'Jane Doe' });

      expect(result.name).toBe('Jane Doe');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { name: 'Jane Doe' },
        include: { auth: true },
      });
    });

    it('should throw BadRequestException if no fields provided to update', async () => {
      await expect(service.updateProfile(1n, {})).rejects.toThrow(BadRequestException);
    });
  });
});
