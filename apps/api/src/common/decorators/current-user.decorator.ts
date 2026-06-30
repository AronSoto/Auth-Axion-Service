import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

import type { AuthUser } from '@/modules/auth/auth.types';

export type { AuthUser };

/**
 * Resolves the authenticated user from the request, populated by JwtStrategy.validate().
 * Optionally extracts a single field: `@CurrentUser('id') userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
