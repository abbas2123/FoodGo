import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('SearchService', () => {
  let service: SearchService;
  let prismaMock: {
    searchHistory: {
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      searchHistory: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRecentSearches', () => {
    it('should return recent searches for user', async () => {
      const mockHistory = [
        { id: 1, userId: 10n, query: 'Pizza', createdAt: new Date('2026-09-15T12:00:00Z') },
        { id: 2, userId: 10n, query: 'Burger', createdAt: new Date('2026-09-15T11:00:00Z') },
      ];
      prismaMock.searchHistory.findMany.mockResolvedValue(mockHistory);

      const res = await service.getRecentSearches(10n);
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
      expect(res.data[0].query).toBe('Pizza');
      expect(prismaMock.searchHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 10n },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });
  });

  describe('addRecentSearch', () => {
    it('should upsert search query and trim spaces', async () => {
      prismaMock.searchHistory.upsert.mockResolvedValue({
        id: 1,
        userId: 10n,
        query: 'Biryani',
        createdAt: new Date(),
      });

      const res = await service.addRecentSearch(10n, '  Biryani  ');
      expect(res.success).toBe(true);
      expect(res.data.query).toBe('Biryani');
      expect(prismaMock.searchHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_query: { userId: 10n, query: 'Biryani' } },
          create: { userId: 10n, query: 'Biryani' },
        }),
      );
    });

    it('should throw BadRequestException if query is empty', async () => {
      await expect(service.addRecentSearch(10n, '   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteSearch', () => {
    it('should delete a search record if owned by user', async () => {
      prismaMock.searchHistory.findFirst.mockResolvedValue({ id: 1, userId: 10n });
      prismaMock.searchHistory.delete.mockResolvedValue({ id: 1 });

      const res = await service.deleteSearch(10n, 1);
      expect(res.success).toBe(true);
      expect(prismaMock.searchHistory.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if search record not found for user', async () => {
      prismaMock.searchHistory.findFirst.mockResolvedValue(null);

      await expect(service.deleteSearch(10n, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearRecentSearches', () => {
    it('should clear all recent searches for user', async () => {
      prismaMock.searchHistory.deleteMany.mockResolvedValue({ count: 3 });

      const res = await service.clearRecentSearches(10n);
      expect(res.success).toBe(true);
      expect(prismaMock.searchHistory.deleteMany).toHaveBeenCalledWith({ where: { userId: 10n } });
    });
  });
});
