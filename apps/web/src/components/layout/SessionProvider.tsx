'use client';

import api from '@/lib/api';
import {
  clearAccessToken,
  readAccessToken,
  readSessionHint,
  type SessionHint,
  writeAccessToken,
  writeSessionHint,
} from '@/lib/session-storage';
import { cn } from '@/lib/utils';
import { AlertCircle, KeyRound, LoaderCircle } from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface LoginInput {
  tenantSlug: string;
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface AppSessionContextValue {
  apiBaseUrl: string;
  authError: string | null;
  email: string;
  isDemoSession: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  status: SessionStatus;
  tenantName: string;
  tenantSlug: string;
  workspaceCount: number;
  workspaceName: string;
  workspaceSlug: string;
}

const DEFAULT_SESSION: LoginInput = {
  tenantSlug: process.env.NEXT_PUBLIC_DEMO_TENANT_SLUG ?? 'saaso-demo',
  email: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? 'admin@saaso.com',
  password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'admin123',
};

const DEFAULT_SESSION_HINT: SessionHint = {
  tenantName: 'Saaso Demo',
  tenantSlug: DEFAULT_SESSION.tenantSlug,
  email: DEFAULT_SESSION.email,
  workspaceName: 'Workspace principal',
  workspaceSlug: 'principal',
};

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      message?: string;
      response?: {
        data?: {
          message?: string | string[];
        };
      };
    };

    const apiMessage = maybeError.response?.data?.message;
    if (Array.isArray(apiMessage)) {
      return apiMessage.join(' ');
    }

    if (typeof apiMessage === 'string') {
      return apiMessage;
    }

    if (typeof maybeError.message === 'string') {
      return maybeError.message;
    }
  }

  return 'Não foi possível autenticar no workspace.';
}

function sanitizeErrorMessage(raw: string): string {
  return raw.replace(/^Erro no Backend:\s*/i, '').trim();
}

function formatTenantName(tenantSlug: string) {
  return tenantSlug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildLoginInput(hint: SessionHint, password = ''): LoginInput {
  return {
    tenantSlug: hint.tenantSlug,
    email: hint.email,
    password,
  };
}

function buildSessionHint(input: LoginInput, response?: LoginResponse): SessionHint {
  return {
    tenantName: response?.tenant?.name ?? formatTenantName(input.tenantSlug),
    tenantSlug: input.tenantSlug,
    email: input.email,
    workspaceName: response?.workspace?.name ?? 'Workspace principal',
    workspaceSlug: response?.workspace?.slug ?? 'principal',
  };
}

function shouldAutoLogin(hint: SessionHint) {
  return hint.tenantSlug === DEFAULT_SESSION.tenantSlug && hint.email === DEFAULT_SESSION.email;
}

function LoadingExperience() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 bg-[#080614]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22)_0%,transparent_65%)]" />
        <div className="absolute -bottom-32 -right-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,transparent_65%)]" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative w-full max-w-sm rounded-3xl border border-violet-500/20 bg-[rgba(15,10,30,0.88)] p-8 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
          <KeyRound className="h-5 w-5 text-violet-300" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-white">Entrar</h1>
        <p className="mt-1 text-sm text-slate-400">Verificando sessão...</p>

        <div className="mt-8 flex items-center gap-3 text-slate-400">
          <LoaderCircle className="h-5 w-5 animate-spin text-violet-400" />
          <span className="text-sm">Conectando com o workspace...</span>
        </div>
      </div>
    </div>
  );
}

function AuthExperience({
  authError,
  initialValues,
  onSubmit,
}: {
  authError: string | null;
  initialValues: LoginInput;
  onSubmit: (input: LoginInput) => Promise<void>;
}) {
  const [form, setForm] = useState<LoginInput>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(initialValues);
  }, [initialValues]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch {
      // authError já é definido pelo provider
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 bg-[#080614]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22)_0%,transparent_65%)]" />
        <div className="absolute -bottom-32 -right-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,transparent_65%)]" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative w-full max-w-sm rounded-3xl border border-violet-500/20 bg-[rgba(15,10,30,0.88)] p-8 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
          <KeyRound className="h-5 w-5 text-violet-300" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-white">Entrar</h1>
        <p className="mt-1 text-sm text-slate-400">{formatTenantName(initialValues.tenantSlug)}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
              placeholder="Digite sua senha"
              required
              autoComplete="current-password"
            />
          </label>

          {authError && (
            <div className="flex gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{sanitizeErrorMessage(authError)}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
              isSubmitting
                ? 'cursor-wait bg-violet-500/40 text-white'
                : 'bg-[linear-gradient(135deg,#8b5cf6,#3b82f6)] text-white shadow-[0_14px_40px_rgba(139,92,246,0.3)] hover:translate-y-[-1px]',
            )}
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {isSubmitting ? 'Autenticando...' : 'Entrar no workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionHint, setSessionHint] = useState<SessionHint>(DEFAULT_SESSION_HINT);
  const [sessionInput, setSessionInput] = useState<LoginInput>(DEFAULT_SESSION);

  const login = useCallback(async (input: LoginInput) => {
    const normalizedInput: LoginInput = {
      tenantSlug: input.tenantSlug.trim(),
      email: input.email.trim(),
      password: input.password,
    };

    setAuthError(null);
    setStatus('checking');

    try {
      const response = await api.post<LoginResponse>('/auth/login', normalizedInput);
      const nextSessionHint = buildSessionHint(normalizedInput, response.data);

      writeAccessToken(response.data.access_token);
      writeSessionHint(nextSessionHint);

      setSessionHint(nextSessionHint);
      setSessionInput(buildLoginInput(nextSessionHint));
      setStatus('authenticated');
    } catch (error) {
      const nextSessionHint = buildSessionHint(normalizedInput);

      writeSessionHint(nextSessionHint);

      setSessionHint(nextSessionHint);
      setSessionInput(buildLoginInput(nextSessionHint));
      setAuthError(getErrorMessage(error));
      setStatus('unauthenticated');
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setAuthError(null);
    setSessionInput(buildLoginInput(sessionHint));
    setStatus('unauthenticated');
  }, [sessionHint]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const token = readAccessToken();
    const storedSessionHint = readSessionHint(DEFAULT_SESSION_HINT);
    const shouldAttemptDemoLogin = shouldAutoLogin(storedSessionHint);
    const nextSessionInput = buildLoginInput(
      storedSessionHint,
      shouldAttemptDemoLogin ? DEFAULT_SESSION.password : '',
    );

    setSessionHint(storedSessionHint);
    setSessionInput(nextSessionInput);

    if (token) {
      setStatus('authenticated');
      return;
    }

    if (shouldAttemptDemoLogin) {
      void login(nextSessionInput).catch(() => undefined);
      return;
    }

    setStatus('unauthenticated');
  }, [login]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleAuthExpired = () => {
      clearAccessToken();
      setAuthError('Sua sessão expirou. Faça login novamente.');
      setSessionInput(buildLoginInput(sessionHint));
      setStatus('unauthenticated');
    };

    window.addEventListener('saaso-auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('saaso-auth-expired', handleAuthExpired);
    };
  }, [sessionHint]);

  const contextValue = useMemo<AppSessionContextValue>(
    () => ({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      authError,
      email: sessionHint.email,
      isDemoSession:
        sessionHint.tenantSlug === DEFAULT_SESSION.tenantSlug && sessionHint.email === DEFAULT_SESSION.email,
      login,
      logout,
      status,
      tenantName: sessionHint.tenantName ?? formatTenantName(sessionHint.tenantSlug),
      tenantSlug: sessionHint.tenantSlug,
      workspaceCount: 1,
      workspaceName: sessionHint.workspaceName ?? 'Workspace principal',
      workspaceSlug: sessionHint.workspaceSlug ?? 'principal',
    }),
    [authError, login, logout, sessionHint, status],
  );

  return (
    <AppSessionContext.Provider value={contextValue}>
      {status === 'authenticated' ? children : null}
      {status === 'checking' ? <LoadingExperience /> : null}
      {status === 'unauthenticated' ? (
        <AuthExperience authError={authError} initialValues={sessionInput} onSubmit={login} />
      ) : null}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const context = useContext(AppSessionContext);

  if (!context) {
    throw new Error('useAppSession must be used within AppSessionProvider');
  }

  return context;
}
