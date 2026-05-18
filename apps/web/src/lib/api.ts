const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Bridge from the React context into this plain module (see auth-context.tsx).
interface AuthBridge {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
}

let authBridge: AuthBridge | null = null;

export function registerAuthBridge(bridge: AuthBridge): void {
  authBridge = bridge;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  _retried?: boolean;
}
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth, _retried, headers, ...rest } = options;

  const accessToken = auth ? authBridge?.getAccessToken() : undefined;

  const finalHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !_retried && authBridge) {
    const newToken = await authBridge.refresh();
    if (newToken) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const errBody = json as ApiErrorBody | undefined;
    const msg = Array.isArray(errBody?.message)
      ? errBody.message.join('; ')
      : (errBody?.message ?? `HTTP ${res.status}`);
    throw new ApiError(res.status, msg, errBody);
  }

  // Strip the {data, timestamp} envelope used by the API.
  const envelope = json as ApiResponse<T> | undefined;
  return (envelope?.data ?? (json as T)) as T;
}

// Typed API methods
export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export const authApi = {
  register: (input: { email: string; password: string; name?: string }) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input }),

  login: (input: { email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: input }),

  refresh: () => apiFetch<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  me: () => apiFetch<AuthUser>('/auth/me', { auth: true }),

  forgotPassword: (email: string) =>
    apiFetch<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  resendVerification: (email: string) =>
    apiFetch<{ ok: true }>('/auth/resend-verification', { method: 'POST', body: { email } }),

  verifyEmail: (token: string) =>
    apiFetch<{ verified: true }>(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ ok: true }>('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
    }),
};

export const oauthUrls = {
  google: `${API_URL}/auth/google`,
  github: `${API_URL}/auth/github`,
};
