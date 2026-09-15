import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service.js';
import { QueryRestaurantsDto } from './dto/query-restaurants.dto.js';

@ApiTags('Restaurants')
@Controller()
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  // GET /categories
  @Get('categories')
  @ApiOperation({ summary: 'Get all active food categories' })
  @ApiOkResponse({ description: 'Categories retrieved successfully' })
  getCategories() {
    return this.restaurantsService.getCategories();
  }

  // GET /restaurants/popular-dishes
  @Get('restaurants/popular-dishes')
  @ApiOperation({ summary: 'Get popular/bestseller dishes across all restaurants' })
  @ApiOkResponse({ description: 'Popular dishes retrieved successfully' })
  getPopularDishes() {
    return this.restaurantsService.getPopularDishes();
  }

  // GET /restaurants/search?q=
  @Get('restaurants/search')
  @ApiOperation({ summary: 'Search restaurants and dishes by name, cuisine, or description' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiOkResponse({ description: 'Search results retrieved' })
  searchRestaurantsAndDishes(@Query('q') q: string) {
    return this.restaurantsService.searchRestaurantsAndDishes(q);
  }

  // GET /restaurants
  @Get('restaurants')
  @ApiOperation({ summary: 'Get all restaurants, optionally filtered by cuisine category' })
  @ApiQuery({ name: 'category', required: false, description: 'Cuisine category to filter by' })
  @ApiOkResponse({ description: 'Restaurants retrieved successfully' })
  getRestaurants(@Query() query: QueryRestaurantsDto) {
    return this.restaurantsService.getRestaurants(query.category);
  }

  // GET /restaurants/:id
  @Get('restaurants/:id')
  @ApiOperation({ summary: 'Get restaurant detail with full menu' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiOkResponse({ description: 'Restaurant retrieved successfully' })
  getRestaurantById(@Param('id', ParseIntPipe) id: number) {
    return this.restaurantsService.getRestaurantById(id);
  }
}
