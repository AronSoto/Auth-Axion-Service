import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '@/config/app-config.service';
import { UsersService } from '@/modules/users/users.service';

import { AuthenticatedUser, JwtAccessPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access')
      throw new UnauthorizedException('Wrong token type');
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive)
      throw new UnauthorizedException('User not found or disabled');
    return { id: user.id, email: user.email, role: user.role };
  }
}
