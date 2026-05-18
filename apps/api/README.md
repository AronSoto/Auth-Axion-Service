# `@auth-axion/api`

Standalone authentication service built with **NestJS 11**, **Prisma**, and **PostgreSQL**.

The architecture is deliberately modular and explicit — every concern (token rotation, OAuth linking, email delivery, RBAC) lives in its own well-named file. The goal is to demonstrate _how_ a production-shaped auth backend is composed, not to ship the smallest possible diff.

---

## Architecture

```
src/
├── main.ts                     Bootstrap: helmet, cors, validation, swagger.
├── app.module.ts               Wires modules + global guards (Throttler → JwtAuth → Roles).
│
├── config/                     Type-safe env via Zod
│   ├── env.validation.ts          Zod schema, throws on boot if missing/invalid.
│   ├── app-config.service.ts      Typed accessors (config.jwt, config.google, …).
│   ├── oauth-env.ts               Boot-time OAuth-config helpers (used before DI).
│   └── app-config.module.ts
│
├── prisma/                     PrismaClient as an injectable Nest service
│   ├── prisma.service.ts          Connect / disconnect lifecycle hooks.
│   └── prisma.module.ts           Declared @Global so other modules don't import it manually.
│
├── common/                     Cross-cutting building blocks
│   ├── decorators/                @Public, @CurrentUser, @Roles
│   ├── guards/                    JwtAuthGuard (global), RolesGuard (per-route)
│   ├── filters/                   HttpExceptionFilter — uniform error envelope
│   └── interceptors/              TransformInterceptor — { data, timestamp } envelope
│
└── modules/
    ├── auth/                   ★ The point of the project
    │   ├── auth.controller.ts     Public + protected endpoints, all in Swagger
    │   ├── auth.service.ts        Orchestration of every auth flow
    │   ├── token.service.ts       JWT signing + refresh-token rotation + reuse detection
    │   ├── auth.types.ts          Shared shapes (AuthUser, OAuthProfile, JwtPayload)
    │   ├── strategies/            local · jwt · google · github  (Passport.js)
    │   ├── guards/                LocalAuthGuard + JwtAuthGuard + OAuth guards (return 503 when their provider isn't configured)
    │   └── dto/                   class-validator + class-transformer DTOs
    │
    ├── users/                  Profile read/write
    ├── admin/                  Admin-only counters (users, sessions, pending verifications)
    ├── mail/                   Resend (prod) + Nodemailer/Mailtrap (dev), one MailService
    ├── tokens-cleanup/         Daily cron that prunes expired refresh + verification tokens (gated by ENABLE_CRON)
    └── health/                 /health and /health/ready (DB ping)
```

The Prisma data model lives at [`prisma/schema.prisma`](./prisma/schema.prisma) and is the single source of truth for `User`, `Account`, `RefreshToken`, and `VerificationToken`.

---

## Endpoints

All routes are prefixed `/api`. Public means **no JWT required** (a global `JwtAuthGuard` is in place; anything not marked `@Public()` requires a valid bearer token).

| Method | Path                         | Auth   | Purpose                                               |
| :----- | :--------------------------- | :----- | :---------------------------------------------------- |
| POST   | `/auth/register`             | public | Create a local account, send verification mail.       |
| POST   | `/auth/login`                | public | Email + password → access token + refresh cookie.     |
| POST   | `/auth/refresh`              | cookie | Rotate refresh token, return a new access token.      |
| POST   | `/auth/logout`               | public | Revoke the current refresh token, clear cookie.       |
| POST   | `/auth/logout-all`           | bearer | Revoke every refresh token for the user.              |
| GET    | `/auth/me`                   | bearer | Current authenticated user.                           |
| GET    | `/auth/verify-email?token=…` | public | Consume verification token, mark email verified.      |
| POST   | `/auth/resend-verification`  | public | Silent resend (no info leak).                         |
| POST   | `/auth/forgot-password`      | public | Silent — sends reset email if account exists.         |
| POST   | `/auth/reset-password`       | public | Consume token, set new password, revoke all sessions. |
| GET    | `/auth/google`               | public | Begin Google OAuth flow.                              |
| GET    | `/auth/google/callback`      | public | Google OAuth callback (account linking by email).     |
| GET    | `/auth/github`               | public | Begin GitHub OAuth flow.                              |
| GET    | `/auth/github/callback`      | public | GitHub OAuth callback (account linking by email).     |
| GET    | `/users/me`                  | bearer | Current user profile.                                 |
| PATCH  | `/users/me`                  | bearer | Update profile (name, avatar).                        |
| GET    | `/admin/stats`               | admin  | Operational counters (users, active sessions, …).     |
| GET    | `/health`                    | public | Liveness probe.                                       |
| GET    | `/health/ready`              | public | Readiness probe (DB ping).                            |

> The OAuth endpoints (`/auth/google`, `/auth/github`) return **503 Service Unavailable** when their provider env vars are not configured. The corresponding Passport strategies are only registered at boot when all three credentials (`*_CLIENT_ID`, `*_CLIENT_SECRET`, `*_CALLBACK_URL`) are present.

Full schemas and example payloads at **`/api/docs`** (Swagger UI in development).

---

## Auth flow design

### Token strategy

- **Access token** — JWT signed with `JWT_ACCESS_SECRET`, 15-minute expiry, sent in `Authorization: Bearer …`. No DB lookup on each request beyond loading the user.
- **Refresh token** — opaque random 48-byte value, returned as an `httpOnly`/`Secure`/`SameSite` cookie scoped to `/api/auth`. Stored as a SHA-256 hash; the plaintext only ever exists in the user's cookie.

### Rotation + reuse detection

On `/auth/refresh`:

1. Look up the presented token by hash.
2. If it's already been **revoked** → assume the chain is compromised, revoke every active token for that user, return 401. (See `TokenService.rotateRefreshToken`.)
3. Otherwise revoke the row and create a new one in the same transaction. The new token's hash is recorded as the previous row's `replacedByHash`.

### OAuth account linking

On a Google/GitHub callback:

1. If an `Account` row already exists for `(provider, providerAccountId)` → log that user in.
2. Else, if the OAuth email is **unverified** at the provider AND a local `User` with that email exists → reject with 401 (account-takeover guard).
3. Else, if a `User` exists with the same email → create a new `Account` row pointing to it (link).
4. Else, create both `User` + `Account`. Email is marked verified iff the provider asserts it.

The entire provisioning step runs inside a single `prisma.$transaction`, so a failure at any point rolls back cleanly — no half-linked users, no orphan accounts. Token issuance is intentionally outside the transaction (its failure is recoverable on retry).

Implemented in [`auth.service.ts → handleOAuthLogin`](./src/modules/auth/auth.service.ts).

### Email verification gate

`REQUIRE_EMAIL_VERIFICATION=true` blocks **local login** until the user has clicked the verify link. It does **not** block `register`: the registration response still includes tokens (auto-login UX), but the next time the user signs in with email + password they'll have to verify first. OAuth bypasses the gate entirely.

### Why password reset revokes all sessions

A password change is a security-relevant event. We assume the user is doing it because of suspected compromise, so every active refresh token is revoked. They're forced to re-log on every device.

---

## Security hardening

- `helmet()` and `compression()` global Express middleware.
- CORS restricted to `FRONTEND_URL` with `credentials: true` (so the cookie round-trips).
- `cookie-parser` for round-tripping the refresh-token cookie (the cookie itself is `httpOnly + Secure + SameSite`, no signing needed).
- `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` — DTO is the contract.
- `@nestjs/throttler` as a global `APP_GUARD` (global `TTL/LIMIT`), plus tighter per-route buckets via `@Throttle(THROTTLE.AUTH)` (5/60s for login/register/refresh) and `@Throttle(THROTTLE.EMAIL_SEND)` (3/60s for resend/forgot).
- Argon2id for password hashing (industry default), with a pre-computed dummy hash verified on unknown emails to remove timing-based user enumeration.
- SHA-256 for refresh + verification token hashes (high-entropy already, no need for a slow hash).
- Verification + reset tokens are **single-use** and superseded by issuing a new one of the same type.
- All "find by email" endpoints are silent: registration / forgot-password / resend-verification never leak whether an email exists.
- Refresh-token **reuse detection**: replaying a revoked token wipes every active session for that user.
- OAuth **account-takeover guard**: an unverified OAuth email cannot link to an existing local user.

---

## Running locally

```bash
# from the repo root
pnpm install
cp .env.example .env             # then fill in JWT secrets, OAuth, mail
pnpm db:up                       # docker compose up -d postgres
pnpm prisma:migrate              # creates the schema
pnpm dev:api                     # starts on http://localhost:3000
```

Open Swagger at <http://localhost:3000/api/docs>.

### Generating JWT secrets

```bash
openssl rand -base64 32          # run twice — different value for access + refresh
```

---

## Testing

`pnpm --filter @auth-axion/api test` runs the Jest **integration suite against the dev Postgres** (the tests truncate and re-seed between cases, and refuse to run if `DATABASE_URL` points outside `localhost` / the docker-compose service names). Coverage focuses on the load-bearing flows: refresh-token rotation, reuse detection, OAuth account linking + takeover guard, and the email-verification gate. Run `pnpm db:up` from the repo root first. A `test/jest-e2e.json` is also configured for full HTTP e2e via `supertest`.

---

## Notes for reviewers

- Modules are organised by feature, not by technical layer. Adding a "TOTP 2FA" feature would be a new file under `auth/strategies/` + a `two-factor/` module — no plumbing churn elsewhere.
- The global `JwtAuthGuard` enforces "secure by default": if a new endpoint is added without `@Public()`, it cannot be hit anonymously. This is a deliberate trade-off favouring safety over per-route opt-in.
- Refresh-token rotation with reuse detection is the load-bearing piece — most JWT implementations get this wrong and never recover from a stolen refresh token. The chain-revocation logic is in `TokenService.rotateRefreshToken`.
- OAuth providers are **opt-in**: setting any of `GOOGLE_*` / `GITHUB_*` env vars requires setting all three for that provider (enforced by the Zod schema). The matching Passport strategy is only registered when its credentials are present; otherwise the endpoint returns 503 instead of crashing with an opaque `UnknownStrategyError`.
- `ENABLE_CRON=false` disables the daily token-cleanup job. Set this in multi-replica or serverless deploys where you don't want every instance running the same cleanup at 3 AM; run the cleanup from an external CronJob/scheduler instead.
