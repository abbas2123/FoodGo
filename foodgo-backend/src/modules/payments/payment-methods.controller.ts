import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service.js';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get('methods')
  @ApiOperation({ summary: 'Get all saved payment methods for current user' })
  @ApiOkResponse({ description: 'Payment methods retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getPaymentMethods(@Req() req: any) {
    const userId = BigInt(req.user.sub ?? req.user.userId);
    console.log(' payment-----------------userId----------', userId);
    return this.paymentMethodsService.getPaymentMethods(userId);
  }

  @Post('methods')
  @ApiOperation({ summary: 'Add a new payment method for current user' })
  @ApiOkResponse({ description: 'Payment method created successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async createPaymentMethod(
    @Req() req: any,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    const userId = BigInt(req.user.sub ?? req.user.userId);
    return this.paymentMethodsService.createPaymentMethod(userId, dto);
  }

  @Patch('methods/:id/default')
  @ApiOperation({ summary: 'Set a payment method as default' })
  @ApiOkResponse({ description: 'Default payment method updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async setDefaultPaymentMethod(@Req() req: any, @Param('id') id: string) {
    const userId = BigInt(req.user.sub ?? req.user.userId);
    return this.paymentMethodsService.setDefaultPaymentMethod(
      userId,
      BigInt(id),
    );
  }

  @Delete('methods/:id')
  @ApiOperation({ summary: 'Remove a payment method' })
  @ApiOkResponse({ description: 'Payment method removed successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async deletePaymentMethod(@Req() req: any, @Param('id') id: string) {
    const userId = BigInt(req.user.sub ?? req.user.userId);
    return this.paymentMethodsService.deletePaymentMethod(userId, BigInt(id));
  }
}
