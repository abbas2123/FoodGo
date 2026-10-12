import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SearchService } from './search.service.js';
import { AddSearchDto } from './dto/add-search.dto.js';

function getUserId(req: any): bigint {
  const rawId = req.user?.userId ?? req.user?.sub;
  if (!rawId) throw new UnauthorizedException('User not authenticated');
  return BigInt(rawId);
}

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('recent')
  @ApiOperation({ summary: 'Get recent searches for authenticated user' })
  @ApiOkResponse({ description: 'Recent searches retrieved successfully' })
  getRecentSearches(@Req() req: any) {
    const userId = getUserId(req);
    return this.searchService.getRecentSearches(userId);
  }

  @Post('recent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save recent search query' })
  @ApiOkResponse({ description: 'Search query saved' })
  addRecentSearch(@Req() req: any, @Body() dto: AddSearchDto) {
    const userId = getUserId(req);
    return this.searchService.addRecentSearch(userId, dto.query);
  }

  @Delete('recent/:id')
  @ApiOperation({ summary: 'Delete recent search item' })
  @ApiParam({ name: 'id', description: 'Search history ID' })
  @ApiOkResponse({ description: 'Search query removed' })
  deleteSearch(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = getUserId(req);
    return this.searchService.deleteSearch(userId, id);
  }

  @Delete('recent')
  @ApiOperation({ summary: 'Clear all recent searches' })
  @ApiOkResponse({ description: 'Recent searches cleared' })
  clearRecentSearches(@Req() req: any) {
    const userId = getUserId(req);
    return this.searchService.clearRecentSearches(userId);
  }
}
