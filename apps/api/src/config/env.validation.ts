import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    API_URL: z.string().url(),
    FRONTEND_URL: z.string().url(),

    DATABASE_URL: z.string().url(),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    THROTTLE_TTL: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),

    // Disable in multi-replica or serverless deploys.
    ENABLE_CRON: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((v) => v === true || v === 'true')
      .default(true),

    // Blocks local login until email is verified; OAuth bypasses.
    REQUIRE_EMAIL_VERIFICATION: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((v) => v === true || v === 'true')
      .default(false),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().url().optional(),

    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_CALLBACK_URL: z.string().url().optional(),

    MAIL_DRIVER: z.enum(['smtp', 'resend']).default('smtp'),
    MAIL_FROM: z.string().default('Auth Axion <noreply@auth-axion.dev>'),
    MAIL_SMTP_HOST: z.string().optional(),
    MAIL_SMTP_PORT: z.coerce.number().int().positive().optional(),
    MAIL_SMTP_USER: z.string().optional(),
    MAIL_SMTP_PASS: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Mail driver requires its own creds, picked at runtime.
    if (env.MAIL_DRIVER === 'smtp') {
      const smtp = {
        MAIL_SMTP_HOST: env.MAIL_SMTP_HOST,
        MAIL_SMTP_PORT: env.MAIL_SMTP_PORT,
        MAIL_SMTP_USER: env.MAIL_SMTP_USER,
        MAIL_SMTP_PASS: env.MAIL_SMTP_PASS,
      } as const;
      for (const [key, value] of Object.entries(smtp)) {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when MAIL_DRIVER=smtp`,
          });
        }
      }
    }
    if (env.MAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when MAIL_DRIVER=resend',
      });
    }

    // OAuth provider opt-in: all three fields or none. Half-config breaks at runtime.
    const oauthProviders = [
      {
        name: 'Google',
        id: env.GOOGLE_CLIENT_ID,
        secret: env.GOOGLE_CLIENT_SECRET,
        cb: env.GOOGLE_CALLBACK_URL,
        keys: [
          'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_SECRET',
          'GOOGLE_CALLBACK_URL',
        ] as const,
      },
      {
        name: 'GitHub',
        id: env.GITHUB_CLIENT_ID,
        secret: env.GITHUB_CLIENT_SECRET,
        cb: env.GITHUB_CALLBACK_URL,
        keys: [
          'GITHUB_CLIENT_ID',
          'GITHUB_CLIENT_SECRET',
          'GITHUB_CALLBACK_URL',
        ] as const,
      },
    ];
    for (const p of oauthProviders) {
      const present = [p.id, p.secret, p.cb].filter(Boolean).length;
      if (present > 0 && present < 3) {
        for (const key of p.keys) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${p.name} OAuth is partially configured — set all three (${p.keys.join(', ')}) or none`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export const validate = (config: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.errors
      .map((e) => `  - ${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
};
