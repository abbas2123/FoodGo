import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecentSearches(userId: bigint) {
    const history = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      success: true,
      message: 'Recent searches retrieved successfully',
      data: history.map((h) => ({
        id: h.id,
        query: h.query,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  async addRecentSearch(userId: bigint, rawQuery: string) {
    const query = (rawQuery || '').trim();
    if (!query) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const record = await this.prisma.searchHistory.upsert({
      where: {
        userId_query: {
          userId,
          query,
        },
      },
      update: {
        createdAt: new Date(),
      },
      create: {
        userId,
        query,
      },
    });

    return {
      success: true,
      message: 'Search query saved',
      data: {
        id: record.id,
        query: record.query,
        createdAt: record.createdAt.toISOString(),
      },
    };
  }

  async deleteSearch(userId: bigint, id: number) {
    const record = await this.prisma.searchHistory.findFirst({
      where: { id, userId },
    });

    if (!record) {
      throw new NotFoundException('Search history item not found');
    }

    await this.prisma.searchHistory.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Search query removed',
      data: null,
    };
  }

  async clearRecentSearches(userId: bigint) {
    await this.prisma.searchHistory.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: 'Search history cleared',
      data: null,
    };
  }
}
