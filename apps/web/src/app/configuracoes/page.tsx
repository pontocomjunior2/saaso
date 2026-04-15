'use client';

import { useAppSession } from '@/components/layout/SessionProvider';
import api from '@/lib/api';
import { useLeadFormStore } from '@/stores/useLeadFormStore';
import { useWhatsAppAccountStore } from '@/stores/useWhatsAppAccountStore';
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  FileText,
  Globe,
  Hand,
  LogOut,
  MessageSquare,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { MetaWebhookConfigSection } from './MetaWebhookConfigSection';

type ApiStatus = 'checking' | 'online' | 'offline';

export default function SettingsPage() {
  const { apiBaseUrl, email, isDemoSession, logout, tenantSlug } = useAppSession();
  const { forms, isLoading: formsLoading, error: formsError, fetchForms } = useLeadFormStore();
  const { accounts, isLoading: whatsappLoading, error: whatsappError, fetchAccounts } = useWhatsAppAccountStore();
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [apiMessage, setApiMessage] = useState<string>('Consultando backend...');

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const [apiResponse] = await Promise.all([api.get<string>('/'), fetchForms(), fetchAccounts()]);
        if (!isMounted) {
          return;
        }

        setApiStatus('online');
        setApiMessage(typeof apiResponse.data === 'string' ? apiResponse.data : 'API respondeu com sucesso.');
      } catch {
        if (!isMounted) {
          return;
        }

        setApiStatus('offline');
        setApiMessage('Nao foi possivel alcançar a API principal.');
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [fetchAccounts, fetchForms]);

  const activeForms = useMemo(() => forms.filter((form) => form.isActive), [forms]);
  const latestForms = useMemo(() => forms.slice(0, 3), [forms]);
  const publicBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return `${window.location.origin}/f/${tenantSlug}`;
  }, [tenantSlug]);
  const whatsappOperationalAccounts = useMemo(
    () => accounts.filter((account) => account.isOperational),
    [accounts],
  );
  const evolutionAccounts = useMemo(
    () => accounts.filter((account) => account.provider === 'evolution'),
    [accounts],
  );
  const whatsappOperational = whatsappOperationalAccounts.length > 0;

  const checklist = [
    {
      label: 'API principal online',
      description: apiMessage,
      ready: apiStatus === 'online',
    },
    {
      label: 'Canal WhatsApp pronto',
      description:
        whatsappOperational
          ? `${whatsappOperationalAccounts.length} conta(s) operacional(is) no workspace.`
          : 'Workspace ainda sem conta WhatsApp operacional.',
      ready: whatsappOperational,
    },
    {
      label: 'Formularios publicados',
      description:
        activeForms.length > 0
          ? `${activeForms.length} formulario(s) ativo(s) prontos para captar leads.`
          : 'Nenhum formulario ativo para entrada inbound.',
      ready: activeForms.length > 0,
    },
    {
      label: 'Entrada manual operacional',
      description: 'Contatos, empresas, card e conversa ja entram vinculados no fluxo comercial.',
      ready: true,
    },
  ];

  const channelCards = [
    {
      title: 'WhatsApp',
      detail: whatsappOperational
        ? `${accounts.length} conta(s), ${whatsappOperationalAccounts.length} operacional(is), ${evolutionAccounts.length} em Evolution.`
        : 'Conecte uma ou mais contas para receber e responder mensagens direto no inbox.',
      badge: whatsappOperational ? `${whatsappOperationalAccounts.length} ativa(s)` : 'Pendente',
      tone:
        whatsappOperational
          ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
          : 'border-amber-400/20 bg-amber-500/10 text-amber-100',
      icon: MessageSquare,
      href: '/whatsapp',
      cta: whatsappOperational ? 'Gerenciar contas' : 'Configurar contas',
    },
    {
      title: 'Formularios',
      detail:
        activeForms.length > 0
          ? `${activeForms.length} formulario(s) ativo(s) publicados e vinculados a etapas do pipeline.`
          : 'Monte o primeiro formulario para transformar visitas em cards e conversas.',
      badge: activeForms.length > 0 ? 'Ativo' : 'Pendente',
      tone:
        activeForms.length > 0
          ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
          : 'border-white/10 bg-white/[0.06] text-slate-200',
      icon: FileText,
      href: '/formularios',
      cta: activeForms.length > 0 ? 'Gerenciar formularios' : 'Criar formulario',
    },
    {
      title: 'Entrada manual',
      detail: 'Operadores podem criar contato, empresa, card e takeover inicial direto pelo modulo Clientes.',
      badge: 'Operacional',
      tone: 'border-violet-400/20 bg-violet-500/10 text-violet-100',
      icon: Hand,
      href: '/contatos',
      cta: 'Abrir Clientes',
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Configurações</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Centro operacional de canais e prontidão.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Esta tela consolida os sinais que realmente importam para captação e atendimento: API, WhatsApp,
              formulários e entrada manual ligados ao inbox.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                void fetchForms();
                void fetchAccounts();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.12]"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar sinais
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 transition hover:border-rose-300/40 hover:bg-rose-500/15"
            >
              <LogOut className="h-4 w-4" />
              Encerrar sessao
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <StatusCard
          icon={Activity}
          label="API principal"
          value={apiStatus === 'checking' ? 'Consultando' : apiStatus === 'online' ? 'Online' : 'Offline'}
          detail={apiBaseUrl}
          tone={
            apiStatus === 'online'
              ? 'text-emerald-100'
              : apiStatus === 'offline'
                ? 'text-rose-100'
                : 'text-slate-100'
          }
        />
        <StatusCard
          icon={MessageSquare}
          label="WhatsApp"
          value={whatsappLoading ? 'Consultando' : `${accounts.length} conta(s)`}
          detail={whatsappOperational ? `${whatsappOperationalAccounts.length} operacional(is)` : 'Sem conta operacional'}
          tone={whatsappOperational ? 'text-emerald-100' : 'text-amber-100'}
        />
        <StatusCard
          icon={FileText}
          label="Formularios ativos"
          value={formsLoading ? 'Consultando' : String(activeForms.length)}
          detail={forms.length > 0 ? `${forms.length} formulario(s) no workspace` : 'Nenhum formulario criado'}
          tone={activeForms.length > 0 ? 'text-cyan-100' : 'text-slate-100'}
        />
        <StatusCard
          icon={Globe}
          label="Sessao"
          value={isDemoSession ? 'Demo guiada' : 'Manual'}
          detail={email}
          tone="text-white"
        />
      </section>

      {(formsError || whatsappError) && (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {formsError || whatsappError}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Canais operacionais</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Entrada pronta para rodar</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {channelCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-cyan-100">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] ${card.tone}`}>
                    {card.badge}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{card.detail}</p>
                <Link
                  href={card.href}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-cyan-100 transition hover:text-cyan-50"
                >
                  {card.cta}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Checklist</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Prontidão operacional</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {checklist.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border ${
                      item.ready
                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                        : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                    }`}
                  >
                    {item.ready ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Formularios publicados</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Captação via link e embed</h2>
            </div>
            <Link
              href="/formularios"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1]"
            >
              Abrir builder
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {latestForms.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-slate-400">
                Ainda nao existem formularios. O proximo passo desta fase e publicar pelo menos um ponto de captura
                inbound ligado a uma etapa do pipeline.
              </div>
            ) : (
              latestForms.map((form) => (
                <div key={form.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{form.name}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] ${
                            form.isActive ? 'bg-emerald-500/10 text-emerald-100' : 'bg-slate-500/10 text-slate-300'
                          }`}
                        >
                          {form.isActive ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {form.stage.pipeline.name} · {form.stage.name}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {publicBaseUrl ? `${publicBaseUrl}/${form.slug}` : form.slug}
                      </p>
                    </div>
                    <Link
                      href={`/formularios`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-cyan-100 transition hover:text-cyan-50"
                    >
                      Revisar
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Proximo corte</p>
              <h2 className="mt-1 text-xl font-semibold text-white">O que a Phase 4 precisa fechar</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              'Fechar a configuracao de canais a partir deste painel, sem depender de paginas soltas.',
              'Consolidar formularios publicados como origem real de contatos, cards e conversas.',
              'Evoluir o runtime de WhatsApp oficial com credenciais de producao, verify token e observabilidade de erros.',
              'Acoplar o builder de agentes e as reguas ao contexto de canal, etapa e inbox.',
            ].map((item) => (
              <div key={item} className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">WhatsApp multicanal</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Providers, QR e vínculo por funil</h2>
          </div>
          <Link
            href="/whatsapp"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1]"
          >
            Abrir central WhatsApp
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-100" />
              <p className="text-sm font-medium text-white">Contas no workspace</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{accounts.length}</p>
            <p className="mt-2 text-sm text-slate-400">Cada pipeline pode apontar para uma conta dedicada.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-cyan-100" />
              <p className="text-sm font-medium text-white">Evolution prontas</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{evolutionAccounts.length}</p>
            <p className="mt-2 text-sm text-slate-400">Leitura de QR e estado da instância ficam na central WhatsApp.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-100" />
              <p className="text-sm font-medium text-white">Operacionais</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{whatsappOperationalAccounts.length}</p>
            <p className="mt-2 text-sm text-slate-400">Contas já prontas para rodar automação e inbound.</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {accounts.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-slate-400">
              Nenhuma conta WhatsApp cadastrada. Crie a primeira conta na central WhatsApp e depois vincule-a ao pipeline.
            </div>
          ) : (
            accounts.slice(0, 4).map((account) => (
              <div key={account.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{account.phoneNumber || account.instanceName || account.id}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">{account.provider}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {account.assignedPipelineName ? `Ligada ao pipeline ${account.assignedPipelineName}` : 'Sem pipeline vinculado'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${account.isOperational ? 'bg-emerald-500/10 text-emerald-100' : 'bg-amber-500/10 text-amber-100'}`}>
                    {account.isOperational ? 'Operacional' : 'Pendente'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <MetaWebhookConfigSection />
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[rgba(8,18,34,0.78)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-cyan-100">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
          <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}
