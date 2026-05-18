// Boot-time reads — used before DI is ready.
const has = (...keys: string[]): boolean =>
  keys.every((k) => Boolean(process.env[k]));

export const isGoogleOAuthConfigured = (): boolean =>
  has('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL');

export const isGithubOAuthConfigured = (): boolean =>
  has('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL');
