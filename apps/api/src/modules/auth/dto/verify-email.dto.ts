import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'The verification token from the email link' })
  @IsString()
  @MinLength(20)
  token!: string;
}
