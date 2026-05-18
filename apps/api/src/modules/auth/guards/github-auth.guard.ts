import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!this.config.isGithubConfigured) {
      throw new ServiceUnavailableException('GitHub OAuth is not configured');
    }
    return super.canActivate(context);
  }
}
