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
type AppUserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT';
type AuthMode = 'login' | 'register';

interface LoginInput {
  tenantSlug: string;
  email: string;
  password: string;
}

interface RegisterInput {
  tenantName: string;
  userName: string;
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: AppUserRole;
  };
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

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: AppUserRole;
  };
  tenant: {
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
  role: AppUserRole | null;
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

function parseRoleFromAccessToken(token: string | null): AppUserRole | null {
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalizedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decodedPayload =
      typeof window !== 'undefined'
        ? window.atob(normalizedBase64)
        : Buffer.from(normalizedBase64, 'base64').toString('utf8');
    const parsed = JSON.parse(decodedPayload) as { role?: AppUserRole };

    return parsed.role ?? null;
  } catch {
    return null;
  }
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
    role: response?.user?.role,
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
  onLogin,
  onRegister,
}: {
  authError: string | null;
  initialValues: LoginInput;
  onLogin: (input: LoginInput) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginForm, setLoginForm] = useState<LoginInput>(initialValues);
  const [registerForm, setRegisterForm] = useState<RegisterInput>({
    tenantName: '',
    userName: '',
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLoginForm(initialValues);
  }, [initialValues]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(loginForm);
      } else {
        await onRegister(registerForm);
      }
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

      <div className="relative w-full max-w-md rounded-3xl border border-violet-500/20 bg-[rgba(15,10,30,0.88)] p-8 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
          <KeyRound className="h-5 w-5 text-violet-300" />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition',
              mode === 'login' ? 'bg-white text-[#171326]' : 'text-slate-300 hover:text-white',
            )}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition',
              mode === 'register' ? 'bg-white text-[#171326]' : 'text-slate-300 hover:text-white',
            )}
          >
            Criar empresa
          </button>
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">
          {mode === 'login' ? 'Entrar' : 'Criar novo workspace'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === 'login'
            ? formatTenantName(initialValues.tenantSlug)
            : 'Cadastre a empresa e o primeiro usuário owner.'}
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {mode === 'login' ? (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">E-mail</span>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, email: event.target.value }))
                  }
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
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
                  placeholder="Digite sua senha"
                  required
                  autoComplete="current-password"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Empresa</span>
                <input
                  type="text"
                  value={registerForm.tenantName}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, tenantName: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
                  placeholder="Nome da empresa"
                  required
                  autoComplete="organization"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Primeiro usuário</span>
                <input
                  type="text"
                  value={registerForm.userName}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, userName: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
                  placeholder="Nome do responsável"
                  required
                  autoComplete="name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">E-mail</span>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, email: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
                  placeholder="responsavel@empresa.com"
                  required
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Senha inicial</span>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
                  placeholder="Mínimo de 6 caracteres"
                  required
                  autoComplete="new-password"
                />
              </label>
            </>
          )}

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
            {isSubmitting
              ? mode === 'login'
                ? 'Autenticando...'
                : 'Criando workspace...'
              : mode === 'login'
                ? 'Entrar no workspace'
                : 'Criar empresa e entrar'}
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

  const register = useCallback(
    async (input: RegisterInput) => {
      const normalizedInput: RegisterInput = {
        tenantName: input.tenantName.trim(),
        userName: input.userName.trim(),
        email: input.email.trim(),
        password: input.password,
      };

      setAuthError(null);

      try {
        const response = await api.post<RegisterResponse>(
          '/auth/register',
          normalizedInput,
        );

        await login({
          tenantSlug: response.data.tenant.slug,
          email: normalizedInput.email,
          password: normalizedInput.password,
        });
      } catch (error) {
        setAuthError(getErrorMessage(error));
        setStatus('unauthenticated');
        throw error;
      }
    },
    [login],
  );

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
    const resolvedRole = storedSessionHint.role ?? parseRoleFromAccessToken(token);
    const shouldAttemptDemoLogin = shouldAutoLogin(storedSessionHint);
    const nextSessionInput = buildLoginInput(
      storedSessionHint,
      shouldAttemptDemoLogin ? DEFAULT_SESSION.password : '',
    );
    const nextSessionHint = resolvedRole
      ? {
          ...storedSessionHint,
          role: resolvedRole,
        }
      : storedSessionHint;

    setSessionHint(nextSessionHint);
    setSessionInput(nextSessionInput);

    if (resolvedRole && resolvedRole !== storedSessionHint.role) {
      writeSessionHint(nextSessionHint);
    }

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
      role: (sessionHint.role as AppUserRole | undefined) ?? null,
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
        <AuthExperience
          authError={authError}
          initialValues={sessionInput}
          onLogin={login}
          onRegister={register}
        />
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
