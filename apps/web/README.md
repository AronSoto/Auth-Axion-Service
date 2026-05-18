# `@auth-axion/web`

Minimal **Next.js 16** + **Tailwind v4** demo frontend that consumes [`@auth-axion/api`](../api/README.md). Intentionally small — its job is to give the auth backend a credible vitrine, not to be a full app.

## Pages

| Route                   | Purpose                                                                   |
| :---------------------- | :------------------------------------------------------------------------ |
| `/`                     | Landing — pitch on the left, embedded login form on the right.            |
| `/auth/register`        | Email + password sign up.                                                 |
| `/auth/verify-email`    | Consumes the `?token=…` from the verification mail.                       |
| `/auth/forgot-password` | Silent reset-link request (no info leak).                                 |
| `/auth/reset-password`  | Consumes the `?token=…` from the reset mail, sets a new password.         |
| `/auth/oauth-callback`  | Lands here after Google / GitHub OAuth, refreshes the session, redirects. |
| `/dashboard`            | Auth-gated profile screen (just enough to prove the session works).       |

## Architecture

- `lib/api.ts` — typed `fetch` wrapper. Sends `credentials: "include"` so the refresh-token cookie is round-tripped, unwraps the API's `{ data, timestamp }` envelope, and throws `ApiError` on non-2xx.
- `lib/auth-context.tsx` — client-side provider holding the access token in memory (not `localStorage`, so XSS can't steal it). On mount, it silently calls `/auth/refresh`; if a cookie is present the session is restored.
- `components/login-form.tsx` — controlled form + Google/GitHub OAuth links.
- `components/ui.tsx` — hand-rolled Button / Input / Card. No shadcn/ui — kept small.

## Running

```bash
# from the repo root
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev:web                     # http://localhost:3001
```

The web app needs the API running on port 3000; start it in another shell with `pnpm dev:api`, or run both at once via `pnpm dev` (root).
