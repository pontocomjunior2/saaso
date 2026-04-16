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
import { WhatsAppSettingsSection } from '@/components/configuracoes/WhatsAppSettingsSection';

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
      tone: whatsappOperational
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-amber-200 bg-amber-50 text-amber-700',
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
      tone: activeForms.length > 0
        ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
        : 'border-gray-200 bg-gray-50 text-gray-600',
      icon: FileText,
      href: '/formularios',
      cta: activeForms.length > 0 ? 'Gerenciar formularios' : 'Criar formulario',
    },
    {
      title: 'Entrada manual',
      detail: 'Operadores podem criar contato, empresa, card e takeover inicial direto pelo modulo Clientes.',
      badge: 'Operacional',
      tone: 'border-violet-200 bg-violet-50 text-violet-700',
      icon: Hand,
      href: '/contatos',
      cta: 'Abrir Clientes',
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 p-6 lg:p-8">
      {/* Page header */}
      <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#9e9e9e]">Configurações</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#393939]">Centro operacional de canais e prontidão.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#6b6b6b]">
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#f2f2f2]"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar sinais
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
            >
              <LogOut className="h-4 w-4" />
              Encerrar sessao
            </button>
          </div>
        </div>
      </section>

      {/* Status cards */}
      <section className="grid gap-4 xl:grid-cols-4">
        <StatusCard
          icon={Activity}
          label="API principal"
          value={apiStatus === 'checking' ? 'Consultando' : apiStatus === 'online' ? 'Online' : 'Offline'}
          detail={apiBaseUrl}
          tone={
            apiStatus === 'online'
              ? 'text-emerald-600'
              : apiStatus === 'offline'
                ? 'text-rose-600'
                : 'text-[#6b6b6b]'
          }
        />
        <StatusCard
          icon={MessageSquare}
          label="WhatsApp"
          value={whatsappLoading ? 'Consultando' : `${accounts.length} conta(s)`}
          detail={whatsappOperational ? `${whatsappOperationalAccounts.length} operacional(is)` : 'Sem conta operacional'}
          tone={whatsappOperational ? 'text-emerald-600' : 'text-amber-600'}
        />
        <StatusCard
          icon={FileText}
          label="Formularios ativos"
          value={formsLoading ? 'Consultando' : String(activeForms.length)}
          detail={forms.length > 0 ? `${forms.length} formulario(s) no workspace` : 'Nenhum formulario criado'}
          tone={activeForms.length > 0 ? 'text-cyan-600' : 'text-[#6b6b6b]'}
        />
        <StatusCard
          icon={Globe}
          label="Sessao"
          value={isDemoSession ? 'Demo guiada' : 'Manual'}
          detail={email}
          tone="text-[#393939]"
        />
      </section>

      {(formsError || whatsappError) && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600">
          {formsError || whatsappError}
        </div>
      )}

      {/* Channel cards + checklist */}
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Channel cards */}
        <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#6b6b6b]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Canais operacionais</p>
              <h2 className="mt-1 text-xl font-semibold text-[#393939]">Entrada pronta para rodar</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {channelCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[26px] border border-[#e8e8e8] bg-[#fafafa] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-white text-[#6b6b6b]">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] ${card.tone}`}>
                    {card.badge}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#393939]">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#6b6b6b]">{card.detail}</p>
                <Link
                  href={card.href}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#594ded] transition hover:text-[#4d42cc]"
                >
                  {card.cta}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Checklist</p>
              <h2 className="mt-1 text-xl font-semibold text-[#393939]">Prontidão operacional</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {checklist.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border ${
                      item.ready
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-amber-200 bg-amber-50 text-amber-600'
                    }`}
                  >
                    {item.ready ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#393939]">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Forms published + Next steps */}
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Published forms */}
        <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Formularios publicados</p>
              <h2 className="mt-1 text-xl font-semibold text-[#393939]">Captação via link e embed</h2>
            </div>
            <Link
              href="/formularios"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#f2f2f2]"
            >
              Abrir builder
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {latestForms.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#d0d0d0] bg-[#fafafa] px-5 py-6 text-sm text-[#6b6b6b]">
                Ainda nao existem formularios. O proximo passo desta fase e publicar pelo menos um ponto de captura
                inbound ligado a uma etapa do pipeline.
              </div>
            ) : (
              latestForms.map((form) => (
                <div key={form.id} className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#393939]">{form.name}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] ${
                            form.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {form.isActive ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#6b6b6b]">
                        {form.stage.pipeline.name} · {form.stage.name}
                      </p>
                      <p className="mt-2 text-xs text-[#9e9e9e]">
                        {publicBaseUrl ? `${publicBaseUrl}/${form.slug}` : form.slug}
                      </p>
                    </div>
                    <Link
                      href={`/formularios`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-[#594ded] transition hover:text-[#4d42cc]"
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

        {/* Next steps */}
        <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#6b6b6b]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Proximo corte</p>
              <h2 className="mt-1 text-xl font-semibold text-[#393939]">O que a Phase 4 precisa fechar</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              'Fechar a configuracao de canais a partir deste painel, sem depender de paginas soltas.',
              'Consolidar formularios publicados como origem real de contatos, cards e conversas.',
              'Evoluir o runtime de WhatsApp oficial com credenciais de producao, verify token e observabilidade de erros.',
              'Acoplar o builder de agentes e as reguas ao contexto de canal, etapa e inbox.',
            ].map((item) => (
              <div key={item} className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm leading-6 text-[#6b6b6b]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp multicanal */}
      <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">WhatsApp multicanal</p>
            <h2 className="mt-1 text-xl font-semibold text-[#393939]">Providers, QR e vínculo por funil</h2>
          </div>
          <Link
            href="/whatsapp"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#f2f2f2]"
          >
            Abrir central WhatsApp
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#594ded]" />
              <p className="text-sm font-medium text-[#393939]">Contas no workspace</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-[#393939]">{accounts.length}</p>
            <p className="mt-2 text-sm text-[#6b6b6b]">Cada pipeline pode apontar para uma conta dedicada.</p>
          </div>
          <div className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[#594ded]" />
              <p className="text-sm font-medium text-[#393939]">Evolution prontas</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-[#393939]">{evolutionAccounts.length}</p>
            <p className="mt-2 text-sm text-[#6b6b6b]">Leitura de QR e estado da instância ficam na central WhatsApp.</p>
          </div>
          <div className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium text-[#393939]">Operacionais</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-[#393939]">{whatsappOperationalAccounts.length}</p>
            <p className="mt-2 text-sm text-[#6b6b6b]">Contas já prontas para rodar automação e inbound.</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {accounts.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#d0d0d0] bg-[#fafafa] px-5 py-6 text-sm text-[#6b6b6b]">
              Nenhuma conta WhatsApp cadastrada. Crie a primeira conta na central WhatsApp e depois vincule-a ao pipeline.
            </div>
          ) : (
            accounts.slice(0, 4).map((account) => (
              <div key={account.id} className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#393939]">{account.phoneNumber || account.instanceName || account.id}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[#9e9e9e]">{account.provider}</p>
                    <p className="mt-2 text-sm text-[#6b6b6b]">
                      {account.assignedPipelineName ? `Ligada ao pipeline ${account.assignedPipelineName}` : 'Sem pipeline vinculado'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${account.isOperational ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {account.isOperational ? 'Operacional' : 'Pendente'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <MetaWebhookConfigSection />

      <WhatsAppSettingsSection />
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
    <div className="rounded-[26px] border border-[#e8e8e8] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#594ded]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">{label}</p>
          <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#6b6b6b]">{detail}</p>
    </div>
  );
}
