import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddSearchDto {
  @ApiProperty({ example: 'Burger', description: 'Search query string' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query: string;
}
