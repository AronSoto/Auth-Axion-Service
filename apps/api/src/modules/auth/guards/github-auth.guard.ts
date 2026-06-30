import { createOAuthGuard } from './oauth.guard';

export const GithubAuthGuard = createOAuthGuard(
  'github',
  'GitHub',
  (config) => config.isGithubConfigured,
);
