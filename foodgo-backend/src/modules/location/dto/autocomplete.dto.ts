import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AutocompleteDto {
  @ApiProperty({
    description: 'Search text query for place autocomplete',
    example: 'Cherthala',
  })
  @IsString({ message: 'Query must be a string' })
  @IsNotEmpty({ message: 'Query is required' })
  @MinLength(2, { message: 'Query must be at least 2 characters' })
  query: string;
}
