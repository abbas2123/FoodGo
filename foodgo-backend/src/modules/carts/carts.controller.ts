import {
  Body,
  Controller,
  Delete,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CartsService } from './carts.service.js';

class AddCartItemDto {
  @IsInt()
  menuItemId: number;

  @IsInt()
  @Min(1)
  quantity: number = 1;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

class UpdateCartItemDto {
  @IsInt()
  @Min(0)
  quantity: number;
}

function getUserId(req: any): bigint {
  const rawId = req.user?.userId ?? req.user?.sub;
  if (!rawId) throw new UnauthorizedException('User not authenticated');
  return BigInt(rawId);
}

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user cart with live prices and totals' })
  @ApiOkResponse({ description: 'Cart retrieved successfully' })
  getCart(@Req() req: any) {
    return this.cartsService.getCart(getUserId(req));
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to cart (validates menu item from DB)' })
  @ApiOkResponse({ description: 'Item added to cart' })
  addItem(@Req() req: any, @Body() body: AddCartItemDto) {
    return this.cartsService.addItem(
      getUserId(req),
      body.menuItemId,
      body.quantity,
      body.specialInstructions,
    );
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update cart item quantity (0 = remove)' })
  @ApiParam({ name: 'id', description: 'Cart item ID' })
  @ApiOkResponse({ description: 'Cart item updated' })
  updateItem(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.cartsService.updateItemQuantity(getUserId(req), id, body.quantity);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiParam({ name: 'id', description: 'Cart item ID' })
  @ApiOkResponse({ description: 'Item removed from cart' })
  removeItem(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.cartsService.removeItem(getUserId(req), id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiOkResponse({ description: 'Cart cleared' })
  clearCart(@Req() req: any) {
    return this.cartsService.clearCart(getUserId(req));
  }
}
