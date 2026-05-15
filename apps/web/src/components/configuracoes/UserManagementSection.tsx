'use client';

import { useAppSession } from '@/components/layout/SessionProvider';
import api from '@/lib/api';
import { ShieldPlus, UserCog, UserRoundPlus } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

type ManagedUserRole = 'MANAGER' | 'AGENT';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: ManagedUserRole | 'OWNER' | 'ADMIN';
  createdAt: string;
}

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: ManagedUserRole;
}

const INITIAL_FORM: CreateUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'AGENT',
};

function getApiErrorMessage(error: unknown) {
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

  return 'Não foi possível concluir a operação.';
}

function sanitizeErrorMessage(raw: string) {
  return raw.replace(/^Erro no Backend:\s*/i, '').trim();
}

function formatUserRole(role: ManagedUser['role']) {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN':
      return 'Admin';
    case 'MANAGER':
      return 'Gestor';
    case 'AGENT':
      return 'Operador';
    default:
      return role;
  }
}

function roleTone(role: ManagedUser['role']) {
  switch (role) {
    case 'OWNER':
      return 'bg-slate-100 text-slate-700';
    case 'ADMIN':
      return 'bg-amber-100 text-amber-700';
    case 'MANAGER':
      return 'bg-cyan-100 text-cyan-700';
    case 'AGENT':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function UserManagementSection() {
  useAppSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<CreateUserForm>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(
    null,
  );
  const stats = useMemo(
    () => ({
      owners: users.filter((user) => user.role === 'OWNER').length,
      admins: users.filter((user) => user.role === 'ADMIN').length,
      managers: users.filter((user) => user.role === 'MANAGER').length,
      agents: users.filter((user) => user.role === 'AGENT').length,
    }),
    [users],
  );

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        const response = await api.get<ManagedUser[]>('/users');
        if (!isMounted) {
          return;
        }

        setCanManageUsers(true);
        setAccessDeniedMessage(null);
        setUsers(response.data);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const status = (loadError as { response?: { status?: number } })?.response?.status;

        if (status === 401 || status === 403) {
          setCanManageUsers(false);
          setAccessDeniedMessage(
            'A API não liberou a gestão de usuários para esta sessão.',
          );
          setError(null);
        } else {
          setCanManageUsers(true);
          setAccessDeniedMessage(null);
          setError(sanitizeErrorMessage(getApiErrorMessage(loadError)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await api.post<ManagedUser>('/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });

      setUsers((current) => [...current, response.data]);
      setForm(INITIAL_FORM);
      setSuccessMessage(`${response.data.name} foi cadastrado com sucesso.`);
    } catch (submitError) {
      setError(sanitizeErrorMessage(getApiErrorMessage(submitError)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
      <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#594ded]">
            <UserRoundPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Usuários do workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-[#393939]">Cadastrar operadores e gestores</h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#6b6b6b]">
          Este fluxo cria apenas perfis não-admin dentro do tenant atual. Owners e admins continuam reservados para
          provisionamento interno.
        </p>

        {accessDeniedMessage ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {accessDeniedMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <StatCard label="Owners" value={String(stats.owners)} />
          <StatCard label="Admins" value={String(stats.admins)} />
          <StatCard label="Gestores" value={String(stats.managers)} />
          <StatCard label="Operadores" value={String(stats.agents)} />
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#393939]">Nome</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-2xl border border-[#d8d8d8] bg-[#fcfcfc] px-4 py-3 text-sm text-[#393939] outline-none transition focus:border-[#594ded]"
              placeholder="Nome do usuário"
              required
              disabled={!canManageUsers}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#393939]">E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-[#d8d8d8] bg-[#fcfcfc] px-4 py-3 text-sm text-[#393939] outline-none transition focus:border-[#594ded]"
              placeholder="usuario@empresa.com"
              required
              autoComplete="email"
              disabled={!canManageUsers}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#393939]">Senha inicial</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-2xl border border-[#d8d8d8] bg-[#fcfcfc] px-4 py-3 text-sm text-[#393939] outline-none transition focus:border-[#594ded]"
                placeholder="Mínimo de 6 caracteres"
                required
                autoComplete="new-password"
                disabled={!canManageUsers}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#393939]">Papel</span>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({ ...current, role: event.target.value as ManagedUserRole }))
                }
                className="w-full rounded-2xl border border-[#d8d8d8] bg-[#fcfcfc] px-4 py-3 text-sm text-[#393939] outline-none transition focus:border-[#594ded]"
                disabled={!canManageUsers}
              >
                <option value="AGENT">Operador</option>
                <option value="MANAGER">Gestor</option>
              </select>
            </label>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || !canManageUsers}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#594ded,#7c6cff)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(89,77,237,0.24)] transition hover:translate-y-[-1px] disabled:cursor-wait disabled:opacity-70"
          >
            <ShieldPlus className="h-4 w-4" />
            {isSubmitting ? 'Cadastrando...' : 'Cadastrar usuário'}
          </button>
        </form>
      </div>

      <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#6b6b6b]">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Acessos ativos</p>
            <h2 className="mt-1 text-xl font-semibold text-[#393939]">Equipe vinculada ao tenant</h2>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] px-5 py-6 text-sm text-[#6b6b6b]">
              Carregando usuários do workspace...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#d0d0d0] bg-[#fafafa] px-5 py-6 text-sm text-[#6b6b6b]">
              Ainda não existem usuários cadastrados neste tenant além do provisionamento inicial.
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#393939]">{user.name}</p>
                    <p className="mt-2 text-sm text-[#6b6b6b]">{user.email}</p>
                    <p className="mt-2 text-xs text-[#9e9e9e]">
                      Criado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${roleTone(user.role)}`}>
                    {formatUserRole(user.role)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#e8e8e8] bg-[#fafafa] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#9e9e9e]">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[#393939]">{value}</p>
    </div>
  );
}
