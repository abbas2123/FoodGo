import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: '+14155552671' })
  phone: string;

  @ApiProperty({ example: 'Alex Morgan', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'CUSTOMER' })
  type: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;
}

export class AuthTokensDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'Authentication successful' })
  message: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;

  @ApiProperty({ type: AuthTokensDto })
  tokens: AuthTokensDto;
}
