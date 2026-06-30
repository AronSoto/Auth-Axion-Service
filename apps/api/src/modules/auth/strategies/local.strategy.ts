import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-local';

import { AuthService } from '../auth.service';
import { AuthUser } from '../auth.types';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    // passReqToCallback so failed logins can be audited with IP / user-agent.
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  validate(req: Request, email: string, password: string): Promise<AuthUser> {
    return this.auth.validateLocalCredentials(email, password, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }
}
