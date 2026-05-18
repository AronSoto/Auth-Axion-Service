import { Module } from '@nestjs/common';

import { TokensCleanupService } from './tokens-cleanup.service';

@Module({
  providers: [TokensCleanupService],
})
export class TokensCleanupModule {}
