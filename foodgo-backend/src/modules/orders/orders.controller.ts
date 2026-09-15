import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrdersService } from './orders.service.js';
import { PlaceOrderDto } from './dto/place-order.dto.js';

function getUserId(req: any): bigint {
  const rawId = req.user?.userId ?? req.user?.sub;
  if (!rawId) throw new UnauthorizedException('User not authenticated');
  return BigInt(rawId);
}

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a new order (prices validated server-side)' })
  @ApiCreatedResponse({ description: 'Order placed successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  placeOrder(@Req() req: any, @Body() dto: PlaceOrderDto) {
    const userId = getUserId(req);
    return this.ordersService.placeOrder(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for the authenticated user' })
  @ApiOkResponse({ description: 'Orders retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getOrders(@Req() req: any) {
    const userId = getUserId(req);
    return this.ordersService.getOrders(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full order details by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Order retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getOrderById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = getUserId(req);
    return this.ordersService.getOrderById(userId, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or confirmed order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Order cancelled successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  cancelOrder(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = getUserId(req);
    return this.ordersService.cancelOrder(userId, id);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Submit a review for a delivered order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiCreatedResponse({ description: 'Review submitted successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  submitReview(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { rating: number; comment?: string },
  ) {
    const userId = getUserId(req);
    return this.ordersService.submitReview(userId, id, body.rating, body.comment);
  }

  @Post(':id/reorder')
  @ApiOperation({ summary: 'Reorder items from a past order with live prices' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Items prepared for cart' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reorder(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = getUserId(req);
    return this.ordersService.reorder(userId, id);
  }

  @Get(':id/tracking')
  @ApiOperation({ summary: 'Get live delivery tracking for an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Order tracking data retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getOrderTracking(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = getUserId(req);
    return this.ordersService.getOrderTracking(userId, id);
  }
}

