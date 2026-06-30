import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

import { NormalizeEmail } from '@/common/decorators/normalize-email.decorator';

export class ResendVerificationDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email!: string;
}
