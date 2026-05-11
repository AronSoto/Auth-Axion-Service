export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const baseHtml = (
  heading: string,
  body: string,
  ctaUrl: string,
  ctaLabel: string,
): string => `
<!doctype html>
<html>
  <body style="font-family:-apple-system,Segoe UI,sans-serif;background:#0b0b0c;color:#e6e6e6;padding:32px;">
    <div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid #232325;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;">${heading}</h1>
      <p style="margin:0 0 24px;line-height:1.55;color:#b9b9bd;">${body}</p>
      <a href="${ctaUrl}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${ctaLabel}</a>
      <p style="margin:24px 0 0;font-size:12px;color:#6b6b70;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </body>
</html>`;

export const verifyEmailTemplate = (verifyUrl: string): RenderedEmail => ({
  subject: 'Verify your email — Auth Axion',
  text: `Welcome to Auth Axion. Verify your email by opening this link: ${verifyUrl}`,
  html: baseHtml(
    'Verify your email',
    'Welcome to Auth Axion. Click the button below to confirm your email address. The link expires in 24 hours.',
    verifyUrl,
    'Verify email',
  ),
});

export const passwordResetTemplate = (resetUrl: string): RenderedEmail => ({
  subject: 'Reset your password — Auth Axion',
  text: `Reset your password by opening this link (expires in 1 hour): ${resetUrl}`,
  html: baseHtml(
    'Reset your password',
    'Use the button below to set a new password. The link expires in 1 hour.',
    resetUrl,
    'Reset password',
  ),
});
