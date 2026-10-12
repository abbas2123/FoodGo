import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../../generated/prisma/client.js';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, description: 'Target order status' })
  @IsEnum(OrderStatus, { message: 'Invalid order status' })
  @IsNotEmpty({ message: 'status is required' })
  status: OrderStatus;

  @ApiProperty({ required: false, description: 'Optional reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}
