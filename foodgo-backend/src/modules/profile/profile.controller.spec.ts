import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileServiceMock: {
    getProfile: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    profileServiceMock = {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: JwtService, useValue: { verifyAsync: vi.fn() } },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: vi.fn() } },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should call profileService.getProfile with userId from req.user.sub', async () => {
      const mockReq = { user: { sub: '42' } };
      profileServiceMock.getProfile.mockResolvedValue({ id: '42', name: 'Test User' });

      const result = await controller.getProfile(mockReq);

      expect(profileServiceMock.getProfile).toHaveBeenCalledWith(42n);
      expect(result).toEqual({ id: '42', name: 'Test User' });
    });

    it('should fallback to req.user.userId if sub is not present', async () => {
      const mockReq = { user: { userId: '10' } };
      profileServiceMock.getProfile.mockResolvedValue({ id: '10', name: 'Fallback User' });

      const result = await controller.getProfile(mockReq);

      expect(profileServiceMock.getProfile).toHaveBeenCalledWith(10n);
      expect(result).toEqual({ id: '10', name: 'Fallback User' });
    });
  });

  describe('updateProfile', () => {
    it('should call profileService.updateProfile with userId and dto', async () => {
      const mockReq = { user: { sub: '42' } };
      const dto = { name: 'Updated Name' };
      profileServiceMock.updateProfile.mockResolvedValue({ id: '42', name: 'Updated Name' });

      const result = await controller.updateProfile(mockReq, dto);

      expect(profileServiceMock.updateProfile).toHaveBeenCalledWith(42n, dto);
      expect(result).toEqual({ id: '42', name: 'Updated Name' });
    });
  });
});
