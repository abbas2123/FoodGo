import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Order ID being paid for', example: 1 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  orderId: number;

  @ApiProperty({ description: 'Razorpay / Gateway Order ID', example: 'order_EKfLsu8PUmXZzi' })
  @IsString()
  @IsNotEmpty()
  providerOrderId: string;

  @ApiProperty({ description: 'Razorpay / Gateway Payment ID', example: 'pay_29QQoUBi66xm2f' })
  @IsString()
  @IsNotEmpty()
  providerPaymentId: string;

  @ApiProperty({ description: 'HMAC SHA256 Signature from Gateway' })
  @IsString()
  @IsNotEmpty()
  providerSignature: string;
}
