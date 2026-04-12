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
import { AlertCircle, Bot, KeyRound, LoaderCircle, Sparkles } from 'lucide-react';
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

function LoadingExperience({ session }: { session: LoginInput }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(89,211,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,177,104,0.16),transparent_26%)]" />
      <div className="relative w-full max-w-xl rounded-[32px] border border-white/10 bg-[rgba(6,14,26,0.78)] p-8 shadow-[0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="flex items-center gap-3 text-cyan-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-cyan-200/70">AI Revenue OS</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Preparando o workspace Saaso</h1>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3 text-slate-200">
            <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
            <span>Conectando com o tenant de demonstração</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Tentando autenticar automaticamente em <span className="text-slate-200">{session.tenantSlug}</span> com o
            usuário <span className="text-slate-200">{session.email}</span>.
          </p>
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
      // authError ja eh definido pelo provider
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(89,211,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,177,104,0.16),transparent_26%)]" />
      <div className="relative grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[36px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-8 shadow-[0_32px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.32em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            CRM + agentes de IA
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight text-white lg:text-5xl">
            Um cockpit comercial mais elegante, mais inteligente e pronto para demo.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            O frontend agora espera uma sessao real antes de abrir o workspace. O tenant e o e-mail ficam
            lembrados, mas a senha nao e mais persistida no navegador.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                label: 'Workspace',
                value: initialValues.tenantSlug,
              },
              {
                label: 'Usuario demo',
                value: initialValues.email,
              },
              {
                label: 'Fluxo',
                value: 'Sessao curta + fallback manual',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-sm font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-6 text-amber-50">
            <p className="font-medium">Se a autenticacao continuar falhando:</p>
            <p className="mt-2 text-amber-100/85">
              Garanta que a API esteja online, o banco em `localhost:5432` e rode novamente o seed de demo para
              popular pipeline, cards, contatos, agentes e journeys.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-amber-50">
docker compose up -d
cd apps/api
npx prisma db push
npx prisma db seed
            </pre>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/10 bg-[rgba(9,20,36,0.88)] p-8 shadow-[0_32px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Acesso ao workspace</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Entrar</h2>
            </div>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Tenant slug</span>
              <input
                value={form.tenantSlug}
                onChange={(event) => setForm((current) => ({ ...current, tenantSlug: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/8"
                placeholder="saaso-demo"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/8"
                placeholder="admin@saaso.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Senha</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/8"
                placeholder="Digite sua senha"
                required
              />
            </label>

            {authError && (
              <div className="flex gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                isSubmitting
                  ? 'cursor-wait bg-cyan-400/40 text-white'
                  : 'bg-[linear-gradient(135deg,#59d3ff,#7bf0c8)] text-slate-950 shadow-[0_18px_50px_rgba(89,211,255,0.3)] hover:translate-y-[-1px]',
              )}
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {isSubmitting ? 'Autenticando...' : 'Entrar no workspace'}
            </button>
          </form>
        </section>
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
      {status === 'checking' ? <LoadingExperience session={sessionInput} /> : null}
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
