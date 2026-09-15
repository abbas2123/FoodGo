import {
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
import { FavoritesService } from './favorites.service.js';

function getUserId(req: any): bigint {
  const rawId = req.user?.userId ?? req.user?.sub;
  if (!rawId) throw new UnauthorizedException('User not authenticated');
  return BigInt(rawId);
}

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all favorited restaurants for the authenticated user' })
  @ApiOkResponse({ description: 'Favorites retrieved successfully' })
  getFavorites(@Req() req: any) {
    const userId = getUserId(req);
    return this.favoritesService.getFavorites(userId);
  }

  @Post(':restaurantId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a restaurant to favorites' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiOkResponse({ description: 'Restaurant added to favorites' })
  addFavorite(
    @Req() req: any,
    @Param('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    const userId = getUserId(req);
    return this.favoritesService.addFavorite(userId, restaurantId);
  }

  @Delete(':restaurantId')
  @ApiOperation({ summary: 'Remove a restaurant from favorites' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiOkResponse({ description: 'Restaurant removed from favorites' })
  removeFavorite(
    @Req() req: any,
    @Param('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    const userId = getUserId(req);
    return this.favoritesService.removeFavorite(userId, restaurantId);
  }

  @Get(':restaurantId/status')
  @ApiOperation({ summary: 'Check if a restaurant is in the user\'s favorites' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiOkResponse({ description: 'Favorite status retrieved' })
  getFavoriteStatus(
    @Req() req: any,
    @Param('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    const userId = getUserId(req);
    return this.favoritesService.getFavoriteStatus(userId, restaurantId);
  }
}
