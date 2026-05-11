# `@auth-axion/api`

Standalone authentication service built with **NestJS 11**, **Prisma**, and **PostgreSQL**.

The architecture is deliberately modular and explicit — every concern (token rotation, OAuth linking, email delivery, RBAC) lives in its own well-named file. The goal is to demonstrate _how_ a production-shaped auth backend is composed, not to ship the smallest possible diff.

---

## Architecture

```
src/
├── main.ts                     Bootstrap: helmet, cors, validation, swagger.
├── app.module.ts               Wires modules + global guards (Throttler → JwtAuth).
│
├── config/                     Type-safe env via Zod
│   ├── env.validation.ts          Zod schema, throws on boot if missing/invalid.
│   ├── app-config.service.ts      Typed accessors (config.jwt, config.google, …).
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
    │   ├── guards/                Per-strategy guards (LocalAuthGuard, GoogleAuthGuard, …)
    │   └── dto/                   class-validator + class-transformer DTOs
    │
    ├── users/                  Profile read/write
    ├── mail/                   Resend (prod) + Nodemailer/Mailtrap (dev), one MailService
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
| GET    | `/health`                    | public | Liveness probe.                                       |
| GET    | `/health/ready`              | public | Readiness probe (DB ping).                            |

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
2. Else, if a `User` exists with the same verified email → create a new `Account` row pointing to it (link).
3. Else, create both `User` + `Account`. Email is marked verified iff the provider asserts it.

This is implemented in [`auth.service.ts → handleOAuthLogin`](./src/modules/auth/auth.service.ts).

### Why password reset revokes all sessions

A password change is a security-relevant event. We assume the user is doing it because of suspected compromise, so every active refresh token is revoked. They're forced to re-log on every device.

---

## Security hardening

- `helmet()` and `compression()` global Express middleware.
- CORS restricted to `FRONTEND_URL` with `credentials: true` (so the cookie round-trips).
- `cookie-parser` with a signed-cookie secret.
- `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` — DTO is the contract.
- `@nestjs/throttler` registered as a global `APP_GUARD` (configurable TTL + limit).
- Argon2id for password hashing (industry default).
- SHA-256 for refresh + verification token hashes (high-entropy already, no need for a slow hash).
- Verification + reset tokens are **single-use** and superseded by issuing a new one of the same type.
- All "find by email" endpoints are silent: registration / forgot-password / resend-verification never leak whether an email exists.

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

`pnpm --filter @auth-axion/api test` runs unit tests via Jest. E2E tests are configured via `test/jest-e2e.json` (boot the app with a fresh schema, exercise endpoints with `supertest`).

---

## Notes for reviewers

- Modules are organised by feature, not by technical layer. Adding a "TOTP 2FA" feature would be a new file under `auth/strategies/` + a `two-factor/` module — no plumbing churn elsewhere.
- The global `JwtAuthGuard` enforces "secure by default": if a new endpoint is added without `@Public()`, it cannot be hit anonymously. This is a deliberate trade-off favouring safety over per-route opt-in.
- Refresh-token rotation with reuse detection is the load-bearing piece — most JWT implementations get this wrong and never recover from a stolen refresh token. The chain-revocation logic is in `TokenService.rotateRefreshToken`.
