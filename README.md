<p align="center">
  <img src="docs/Logo.png" alt="Auth Axion" width="400" />
</p>

<p align="center">
  <em>A production-shaped, standalone authentication service.</em>
  <br />
  <strong>NestJS</strong> · <strong>Prisma</strong> · <strong>PostgreSQL</strong> · <strong>Next.js</strong>
</p>

<p align="center">
  <a href="#-stack"><img src="https://img.shields.io/badge/Node-22-339933?logo=nodedotjs&logoColor=white" alt="Node 22" /></a>
  <a href="#-stack"><img src="https://img.shields.io/badge/NestJS-11-EA2845?logo=nestjs&logoColor=white" alt="NestJS 11" /></a>
  <a href="#-stack"><img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" /></a>
  <a href="#-stack"><img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma 6" /></a>
  <a href="#-stack"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
</p>

---

## 📖 About

**Auth Axion** is a portfolio project: a standalone authentication backend that any frontend can consume. It was built to demonstrate clean **NestJS architecture** — feature-organised modules, dependency injection, guards, decorators, exception filters — rather than to be the smallest possible auth implementation.

Every concern (token rotation, OAuth account linking, email delivery, RBAC) lives in its own well-named file. The companion Next.js frontend is intentionally minimal: a landing page + login + dashboard, just enough to demo every backend flow end-to-end.

<p align="center">
  <img src="docs/Presentation.gif" alt="Axion Gif" width="800" />
</p>

---

## 🧱 Stack

| Layer           | Tech                                                                                |
| :-------------- | :---------------------------------------------------------------------------------- |
| **Backend**     | NestJS 11, Passport.js, JWT (access + refresh rotation), Prisma 6, PostgreSQL 16    |
| **Frontend**    | Next.js 16 (App Router), React 19, Tailwind CSS v4                                  |
| **OAuth**       | Google, GitHub                                                                      |
| **Email**       | Resend (prod) + Nodemailer / Mailtrap (dev)                                         |
| **Validation**  | Zod (env), class-validator (DTOs)                                                   |
| **Hardening**   | Helmet, CORS, @nestjs/throttler, role-based guards, secure cookies                  |
| **Docs**        | Swagger / OpenAPI at `/api/docs`                                                    |
| **Tests**       | Jest integration tests against Postgres — token rotation, OAuth linking, email gate |
| **Tooling**     | pnpm workspaces, ESLint, Prettier, Husky, lint-staged, commitlint                   |
| **Infra (dev)** | Docker Compose (Postgres 16-alpine)                                                 |

---

## ✨ Features

- **JWT access tokens** (15 min) + **opaque refresh tokens** stored as SHA-256 hashes
- **Refresh-token rotation** — old token revoked atomically, new one issued in a single transaction
- **Reuse detection** — replaying a revoked token revokes the entire token chain for the user (compromise containment)
- **Email + password** registration with **email verification**
- **Configurable email-verification gate** — `REQUIRE_EMAIL_VERIFICATION=true` blocks local login until verified; OAuth bypasses it
- **Password reset** flow — invalidates every active session on completion
- **OAuth** with Google + GitHub, with **account linking by email** (idempotent upsert; profile fields preserved on re-login)
- **Role-based access control** via guards + decorators (`@Roles('admin')`)
- **Rate limiting** via `@nestjs/throttler` (configurable TTL + limit)
- **Swagger / OpenAPI** auto-generated docs
- **httpOnly + Secure + SameSite** refresh cookie, scoped to `/api/auth`
- **No info leak** — `forgot-password` / `resend-verification` always return 200
- **Coalesced silent refresh** on the web client — concurrent 401s share one `/auth/refresh` call, preventing self-inflicted reuse detection
- **Session-expired overlay** — when refresh fails on a tab that had a session, a graceful full-screen message takes over instead of an abrupt redirect
- **Cross-tab logout sync** via `BroadcastChannel` — logging out in one tab surfaces the expired overlay in every other open tab

---

## 🚀 Quick start

```bash
# 1. Install dependencies (uses pnpm workspaces)
pnpm install

# 2. Copy env templates and fill in real values (see "🔑 Getting credentials" below)
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local

# 3. Generate the JWT access secret and paste into .env
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"

# 4. Start Postgres (Docker Desktop must be running)
pnpm db:up

# 5. Run the initial Prisma migration
pnpm prisma:migrate

# 6. Boot API + web in parallel
pnpm dev
```

Visit:

- 🖥️ **Web** → <http://localhost:3001>
- 🔌 **API** → <http://localhost:3000/api>
- 📖 **Swagger docs** → <http://localhost:3000/api/docs>

---

## 🛠 pnpm commands cheat sheet

All commands are run from the **monorepo root**. The workspaces are named `@auth-axion/api` and `@auth-axion/web` — you can target them with `--filter`.

### Day-to-day

| Command             | What it does                                      |
| :------------------ | :------------------------------------------------ |
| `pnpm install`      | Install all deps across the workspaces            |
| `pnpm dev`          | Run API + web in parallel (`--parallel --filter`) |
| `pnpm dev:api`      | Only the NestJS backend on port **3000**          |
| `pnpm dev:web`      | Only the Next.js frontend on port **3001**        |
| `pnpm build`        | Build both apps                                   |
| `pnpm typecheck`    | `tsc --noEmit` across both apps                   |
| `pnpm lint`         | ESLint across both apps                           |
| `pnpm format`       | Prettier — write                                  |
| `pnpm format:check` | Prettier — verify only (used in CI)               |

### Database / Prisma

| Command                | What it does                                        |
| :--------------------- | :-------------------------------------------------- |
| `pnpm db:up`           | `docker compose up -d postgres`                     |
| `pnpm db:down`         | Stop Postgres                                       |
| `pnpm db:logs`         | Tail Postgres logs                                  |
| `pnpm db:reset`        | ⚠️ Drop the volume and start fresh                  |
| `pnpm prisma:generate` | Regenerate the Prisma client (after editing schema) |
| `pnpm prisma:migrate`  | Create + apply a new dev migration                  |
| `pnpm prisma:studio`   | GUI for the DB → <http://localhost:5555>            |

### Targeting a single workspace

```bash
pnpm --filter @auth-axion/api add zod              # add a dep to the API
pnpm --filter @auth-axion/web add -D @types/foo    # devDep to the web
pnpm --filter @auth-axion/api test                 # tests, API only
pnpm --filter @auth-axion/api exec nest g resource posts   # nest CLI
```

### Useful pnpm patterns

| Pattern                          | Meaning                                              |
| :------------------------------- | :--------------------------------------------------- |
| `pnpm <script>`                  | Run script from the root `package.json`              |
| `pnpm --filter <name> <command>` | Run command inside a single workspace                |
| `pnpm -r <command>`              | Recursive — run in every workspace                   |
| `pnpm -P --filter './apps/*'`    | Filter only the `apps/` workspaces (not `packages/`) |

---

## 🔑 Getting credentials

You need credentials for **4 external services**. Without them, basic register/login still works locally, but OAuth + email won't fire until you fill them in. Each one is free.

### 1. Google OAuth

1. Go to <https://console.cloud.google.com>.
2. Create a new project (or pick one). Name doesn't matter.
3. Sidebar → **APIs & Services** → **OAuth consent screen** → configure (External, your email).
4. Sidebar → **Credentials** → **Create credentials** → **OAuth client ID** → **Web application**.
5. Under **Authorized redirect URIs**, add exactly:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
6. After saving, copy the **Client ID** and **Client Secret** (the secret starts with `GOCSPX-`).

Paste into `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

### 2. GitHub OAuth

1. GitHub → **Settings** (top right) → **Developer settings** → **OAuth Apps** → **New OAuth App**.
   Direct link: <https://github.com/settings/developers>
2. Fill in:
   - **Application name** → anything (e.g. `Auth-Axion`)
   - **Homepage URL** → `http://localhost:3000`
   - **Authorization callback URL** → `http://localhost:3000/api/auth/github/callback`
3. After saving, GitHub shows the **Client ID**. Click **Generate a new client secret** to create the **Client Secret** (only displayed once — copy it immediately).

Paste into `.env`:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
```

### 3. Mailtrap (dev email capture)

Mailtrap has **two products** — make sure you pick the right one:

> Use **Email Testing** (Sandbox), **not** Email Sending. Sandbox catches emails in a fake inbox; no domain verification needed.

1. Sign up at <https://mailtrap.io>.
2. In the sidebar, go to **Email Testing** → **Inboxes**.
3. Open your inbox (or create one) → tab **SMTP Settings** → integration **Nodemailer** or generic **SMTP**.
4. Copy `Username` and `Password`. Host is `sandbox.smtp.mailtrap.io`, port `2525`.

Paste into `.env`:

```env
MAIL_DRIVER=smtp
MAIL_SMTP_HOST=sandbox.smtp.mailtrap.io
MAIL_SMTP_PORT=2525
MAIL_SMTP_USER=...
MAIL_SMTP_PASS=...
```

### 4. Resend (prod email — optional for dev)

Resend is only used in production (`MAIL_DRIVER=resend`). In dev we use Mailtrap. You can configure it now or skip.

1. Sign up at <https://resend.com>.
2. Sidebar → **API Keys** → **Create API Key** → copy the value (starts with `re_`).

Paste into `.env`:

```env
RESEND_API_KEY=re_...
```

To send real emails in prod you also need to **verify a domain** in Resend (DNS records). For dev, you can use `MAIL_FROM="Auth Axion <onboarding@resend.dev>"` which is Resend's special test sender — but it can only deliver to **your own verified account email**.

---

## 🗂 Repository layout

```
.
├── apps/
│   ├── api/                  NestJS auth service       → @auth-axion/api
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── config/       Zod-validated env
│   │       ├── prisma/       PrismaService + module
│   │       ├── common/       Guards, decorators, filters, interceptors
│   │       └── modules/
│   │           ├── auth/     ★ register, login, refresh, OAuth, email flows
│   │           ├── users/    Profile read/write
│   │           ├── mail/     Resend / Nodemailer dual driver
│   │           └── health/   Liveness + readiness
│   └── web/                  Next.js demo frontend     → @auth-axion/web
│       └── src/
│           ├── app/          App Router pages
│           ├── components/   UI primitives + forms
│           └── lib/          API client + auth context
├── docs/                     README assets (logo)
├── docker-compose.yml        Postgres 16-alpine container
├── .env.example              Documented env-var template
├── pnpm-workspace.yaml
└── package.json              Root orchestration scripts
```

Per-app deep dives:

- 📘 **[`apps/api/README.md`](./apps/api/README.md)** — full API architecture, endpoint table, auth-flow design decisions
- 📗 **[`apps/web/README.md`](./apps/web/README.md)** — frontend pages and integration

---

## 🧪 Testing

**Automated** — run the Jest integration suite against the dev Postgres:

```bash
pnpm --filter @auth-axion/api test
```

Covers refresh-token rotation, reuse detection, OAuth account linking, and the email-verification gate. Tests truncate and re-seed between cases, so they need Docker up (`pnpm db:up`).

**Manual smoke test** — after `pnpm dev`, with everything green:

| Flow                   | How to trigger                                                                               |
| :--------------------- | :------------------------------------------------------------------------------------------- |
| **Local register**     | <http://localhost:3001/auth/register> → email/password. Verification mail lands in Mailtrap. |
| **Verify email**       | Click the link inside the Mailtrap email — lands at `/auth/verify-email?token=…`.            |
| **Local login**        | Form on the landing page.                                                                    |
| **Google OAuth**       | Click **Google** in the login card. Redirects to Google → back to `/auth/oauth-callback`.    |
| **GitHub OAuth**       | Same flow, GitHub button.                                                                    |
| **Forgot / reset pwd** | `/auth/forgot-password` → submit email → click reset link in Mailtrap → set new password.    |
| **Logout-all**         | API endpoint `POST /api/auth/logout-all` — revokes every active refresh token for the user.  |

You can poke individual endpoints from Swagger UI at <http://localhost:3000/api/docs>.

---

## 🧯 Troubleshooting

| Symptom                                     | Cause / Fix                                                                          |
| :------------------------------------------ | :----------------------------------------------------------------------------------- |
| API: `EADDRINUSE :::3000`                   | Another process is on 3000. `netstat -ano \| findstr ":3000"` → `taskkill /F /PID …` |
| API: `Invalid environment variables`        | Read the message — Zod prints the missing/invalid keys.                              |
| Prisma: `Environment variable not found: …` | The CLI is missing the root `.env`. Scripts use `dotenv-cli` already — re-run.       |
| Web: `ERR_CONNECTION_REFUSED` on OAuth      | API is not running. Start it: `pnpm dev:api` and wait for the 🚀 boot log.           |
| `Refresh token reuse detected`              | Working as intended — a revoked refresh token was replayed. All sessions wiped.      |
| `pnpm: command not found`                   | Install with `corepack enable pnpm` or `npm i -g pnpm`.                              |

---

## 🧑‍💻 Author

**Aron Soto** — [@AronSoto](https://github.com/AronSoto) on GitHub
