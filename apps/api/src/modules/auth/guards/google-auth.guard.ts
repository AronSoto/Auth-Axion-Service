import { createOAuthGuard } from './oauth.guard';

export const GoogleAuthGuard = createOAuthGuard(
  'google',
  'Google',
  (config) => config.isGoogleConfigured,
);
