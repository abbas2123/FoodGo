import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '+14155552671',
    description: 'User mobile phone number in E.164 or national format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{5,14}$/, {
    message: 'phone must be a valid phone number (6 to 15 digits)',
  })
  phone: string;
}
