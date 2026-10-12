import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class PaymentFailureDto {
  @ApiProperty({ description: 'Order ID where payment failed', example: 1 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  orderId: number;

  @ApiProperty({ description: 'Provider Order ID', example: 'order_EKfLsu8PUmXZzi' })
  @IsString()
  @IsNotEmpty()
  providerOrderId: string;

  @ApiPropertyOptional({ description: 'Error code from gateway or app', example: 'BAD_REQUEST_ERROR' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Error description or cancellation reason', example: 'Payment cancelled by user' })
  @IsOptional()
  @IsString()
  description?: string;
}
