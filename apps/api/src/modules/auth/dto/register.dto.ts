import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { NormalizeEmail } from '@/common/decorators/normalize-email.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'aron@example.com' })
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'a-strong-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
}
