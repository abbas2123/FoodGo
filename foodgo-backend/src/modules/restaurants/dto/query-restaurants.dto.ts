import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryRestaurantsDto {
  @ApiPropertyOptional({ description: 'Filter restaurants by cuisine category name' })
  @IsOptional()
  @IsString()
  category?: string;
}
