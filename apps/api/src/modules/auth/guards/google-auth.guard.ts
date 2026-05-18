import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!this.config.isGoogleConfigured) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }
    return super.canActivate(context);
  }
}
