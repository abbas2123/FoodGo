import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class CreatePaymentOrderDto {
  @ApiProperty({ description: 'Order ID to initiate payment for', example: 1 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  orderId: number;
}
