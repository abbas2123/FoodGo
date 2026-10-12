import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserType } from '../../generated/prisma/client.js';
import { OrdersService } from './orders.service.js';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { AssignDriverDto } from './dto/assign-driver.dto.js';
import { Post } from '@nestjs/common';

function getAdminUserId(req: any): bigint {
  const rawId = req.user?.userId ?? req.user?.sub;
  if (!rawId) throw new UnauthorizedException('User not authenticated');
  return BigInt(rawId);
}

@ApiTags('Admin Orders')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: Get paginated list of all orders with optional filters' })
  @ApiOkResponse({ description: 'Orders list retrieved successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getOrders(@Query() query: AdminOrderQueryDto) {
    return this.ordersService.getAdminOrders(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: Get detailed information of a specific order including history' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Order details retrieved successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getAdminOrderById(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Update order lifecycle status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Order status updated successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  updateOrderStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const adminUserId = getAdminUserId(req);
    return this.ordersService.updateOrderStatus(adminUserId, id, dto.status, dto.reason);
  }

  @Post(':id/assign-driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Assign a delivery partner/driver to an active order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Driver assigned successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  assignDriver(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDriverDto,
  ) {
    const adminUserId = getAdminUserId(req);
    return this.ordersService.assignDriver(adminUserId, id, dto);
  }
}
