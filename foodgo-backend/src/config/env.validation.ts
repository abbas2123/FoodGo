import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  DATABASE_URL: string = 'postgresql://localhost:5432/foodgo';

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET: string = 'foodgo-default-access-secret-change-in-production';

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string = 'foodgo-default-refresh-secret-change-in-production';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsNumber()
  @Min(1)
  @IsOptional()
  OTP_EXPIRY_MINUTES: number = 5;

  @IsNumber()
  @Min(1)
  @IsOptional()
  OTP_MAX_ATTEMPTS: number = 5;

  @IsNumber()
  @Min(10)
  @IsOptional()
  OTP_COOLDOWN_SECONDS: number = 60;

  @IsString()
  @IsOptional()
  GOOGLE_MAPS_API_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => Object.values(error.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Config validation error: ${errorMessages}`);
  }

  return validatedConfig;
}
