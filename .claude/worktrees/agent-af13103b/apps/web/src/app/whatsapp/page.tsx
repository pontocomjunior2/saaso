'use client';

import { useAppSession } from '@/components/layout/SessionProvider';
import api from '@/lib/api';
import { useWhatsAppStore, type WhatsAppAccount } from '@/stores/useWhatsAppStore';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  MessageSquarePlus,
  RefreshCcw,
  Save,
  Sparkles,
  Webhook,
  XCircle,
} from 'lucide-react';

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
  }>;
}

interface ChannelFormState {
  phoneNumber: string;
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
}

interface SimulatorFormState {
  fromPhoneNumber: string;
  contactName: string;
  companyName: string;
  stageId: string;
  message: string;
}

const emptyChannelForm: ChannelFormState = {
  phoneNumber: '',
  accessToken: '',
  phoneNumberId: '',
  wabaId: '',
};

const emptySimulatorForm: SimulatorFormState = {
  fromPhoneNumber: '',
  contactName: '',
  companyName: '',
  stageId: '',
  message: 'Olá, quero entender como vocês estruturam o diagnóstico comercial.',
};

function getConnectionModeLabel(account: WhatsAppAccount | null): string {
  if (!account) {
    return 'Sem conta';
  }

  switch (account.connectionMode) {
    case 'cloud_api':
      return 'Cloud API oficial';
    case 'local_demo':
      return 'Demo local';
    default:
      return 'Configuração parcial';
  }
}

function getConnectionModeDetail(account: WhatsAppAccount | null): string {
  if (!account) {
    return 'Nenhum numero configurado neste workspace.';
  }

  if (account.connectionMode === 'cloud_api') {
    return `Numero ${account.phoneNumber ?? 'configurado'} pronto para inbound e outbound oficiais.`;
  }

  if (account.connectionMode === 'local_demo') {
    return `Numero ${account.phoneNumber ?? 'configurado'} operacional em fallback local para validação.`;
  }

  return `Numero ${account.phoneNumber ?? 'configurado'} operacional, mas a configuracao oficial ainda nao esta completa.`;
}

export default function WhatsAppPage() {
  const { apiBaseUrl } = useAppSession();
  const { account, isLoading, isSimulatingInbound, error, fetchAccount, connect, simulateInbound } = useWhatsAppStore();
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [channelForm, setChannelForm] = useState<ChannelFormState>(emptyChannelForm);
  const [simulatorForm, setSimulatorForm] = useState<SimulatorFormState>(emptySimulatorForm);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let active = true;

    void fetchAccount();

    const loadPipelines = async () => {
      try {
        const response = await api.get<PipelineOption[]>('/pipelines');
        if (!active) {
          return;
        }

        setPipelines(response.data);
        setSimulatorForm((current) => ({
          ...current,
          stageId: current.stageId || response.data[0]?.stages[1]?.id || response.data[0]?.stages[0]?.id || '',
        }));
      } catch {
        if (active) {
          setPipelines([]);
        }
      }
    };

    void loadPipelines();

    return () => {
      active = false;
    };
  }, [fetchAccount]);

  useEffect(() => {
    if (!account) {
      return;
    }

    setChannelForm((current) => ({
      phoneNumber: current.phoneNumber || account.phoneNumber || '',
      accessToken: current.accessToken,
      phoneNumberId: current.phoneNumberId || account.phoneNumberId || '',
      wabaId: current.wabaId || account.wabaId || '',
    }));
  }, [account]);

  const selectedStageLabel = useMemo(() => {
    for (const pipeline of pipelines) {
      const stage = pipeline.stages.find((item) => item.id === simulatorForm.stageId);
      if (stage) {
        return `${pipeline.name} / ${stage.name}`;
      }
    }

    return 'Sem etapa definida';
  }, [pipelines, simulatorForm.stageId]);

  const webhookUrl = `${apiBaseUrl.replace(/\/$/, '')}/whatsapp/webhook`;
  const isOperational = Boolean(account?.isOperational);
  const canSimulateInbound = Boolean(account?.supportsSimulator);
  const connectionModeLabel = useMemo(() => getConnectionModeLabel(account), [account]);
  const connectionModeDetail = useMemo(() => getConnectionModeDetail(account), [account]);
  const outboundLabel = account?.canSendOfficialOutbound
    ? 'Pronto'
    : account?.isOperational
      ? 'Fallback local'
      : 'Pendente';
  const outboundDetail = account?.canSendOfficialOutbound
    ? 'Mensagens outbound usam a Cloud API oficial.'
    : account?.isOperational
      ? 'O envio continua funcional em demo local ate concluir Phone Number ID e access token.'
      : 'Configure um numero para liberar o canal.';
  const webhookLabel = account?.canReceiveOfficialWebhook ? 'Mapeado' : account ? 'Pendente' : 'Sem conta';
  const webhookDetail = account?.canReceiveOfficialWebhook
    ? `Phone Number ID ${account.phoneNumberId ?? 'configurado'} pronto para payload oficial.`
    : 'Informe o Phone Number ID para casar os eventos oficiais da Meta.';
  const verifyTokenDetail = account?.verifyTokenConfigured
    ? 'Verify token definido no ambiente.'
    : 'Sem token no ambiente; fallback local saaso-dev-webhook-token ativo para desenvolvimento.';

  const handleConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageMessage(null);
    setIsConnecting(true);

    try {
      await connect({
        phoneNumber: channelForm.phoneNumber,
        accessToken: channelForm.accessToken || undefined,
        phoneNumberId: channelForm.phoneNumberId || undefined,
        wabaId: channelForm.wabaId || undefined,
      });
      setChannelForm((current) => ({ ...current, accessToken: '' }));
      setPageMessage('Canal WhatsApp atualizado com sucesso.');
    } catch {
      // erro tratado na store
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSimulate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageMessage(null);

    try {
      await simulateInbound({
        fromPhoneNumber: simulatorForm.fromPhoneNumber,
        contactName: simulatorForm.contactName || undefined,
        companyName: simulatorForm.companyName || undefined,
        stageId: simulatorForm.stageId || undefined,
        message: simulatorForm.message,
      });

      setPageMessage('Mensagem inbound simulada. Revise o Inbox para acompanhar card, thread e resposta do agente.');
      setSimulatorForm((current) => ({
        ...current,
        fromPhoneNumber: '',
        contactName: '',
        companyName: '',
        message: emptySimulatorForm.message,
      }));
    } catch {
      // erro tratado na store
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setPageMessage('Valor copiado para a area de transferencia.');
    } catch {
      setPageMessage('Nao foi possivel copiar automaticamente. Copie manualmente.');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">WhatsApp</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Canal, webhook e validação operacional.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Configure o canal, revise o endpoint oficial da Meta e valide o workspace em dois modos: Cloud API
              quando a conta estiver completa, ou fallback local para continuar operando enquanto a configuração oficial
              não termina.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                void fetchAccount();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.12]"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Recarregar status
            </button>
            <Link
              href="/inbox"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(89,211,255,0.28)] transition hover:translate-y-[-1px]"
            >
              Abrir inbox
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {(error || pageMessage) && (
        <div
          className={`rounded-3xl px-5 py-4 text-sm ${
            error
              ? 'border border-rose-400/20 bg-rose-500/10 text-rose-100'
              : 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          {error || pageMessage}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-4">
        <StatusCard
          label="Modo do canal"
          value={connectionModeLabel}
          detail={connectionModeDetail}
          good={isOperational}
        />
        <StatusCard
          label="Outbound oficial"
          value={outboundLabel}
          detail={outboundDetail}
          good={Boolean(account?.canSendOfficialOutbound)}
        />
        <StatusCard
          label="Webhook oficial"
          value={webhookLabel}
          detail={`${webhookDetail} ${verifyTokenDetail}`}
          good={Boolean(account?.canReceiveOfficialWebhook)}
        />
        <StatusCard
          label="Etapa teste"
          value={selectedStageLabel}
          detail="Destino usado pelo simulador inbound."
          good={Boolean(simulatorForm.stageId)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
              {isOperational ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Credenciais</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Conectar o canal do workspace</h2>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleConnect}>
            <input
              value={channelForm.phoneNumber}
              onChange={(event) => setChannelForm((current) => ({ ...current, phoneNumber: event.target.value }))}
              placeholder="Numero do WhatsApp com DDI/DDD"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
              required
            />
            <input
              value={channelForm.phoneNumberId}
              onChange={(event) => setChannelForm((current) => ({ ...current, phoneNumberId: event.target.value }))}
              placeholder="Phone Number ID da Meta"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            />
            <input
              value={channelForm.wabaId}
              onChange={(event) => setChannelForm((current) => ({ ...current, wabaId: event.target.value }))}
              placeholder="WABA ID"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            />
            <input
              type="password"
              value={channelForm.accessToken}
              onChange={(event) => setChannelForm((current) => ({ ...current, accessToken: event.target.value }))}
              placeholder={account?.hasAccessToken ? 'Token configurado. Informe outro para substituir.' : 'Access token / API key'}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            />
            <button
              type="submit"
              disabled={isConnecting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isConnecting ? 'Salvando...' : 'Salvar configuracao'}
            </button>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Modo ativo</p>
                <p className="mt-2 text-sm font-medium text-white">{connectionModeLabel}</p>
                <p className="mt-2 text-xs leading-6 text-slate-400">{connectionModeDetail}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Leitura operacional</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {account?.canSendOfficialOutbound ? 'Cloud API oficial' : isOperational ? 'Fallback local' : 'Indisponivel'}
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-400">
                  Preencha Phone Number ID e access token para enviar outbound oficial. Sem isso, o workspace segue
                  validando em modo local.
                </p>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Webhook</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Endpoint operacional</h2>
            </div>
          </div>

          <div className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-medium text-white">URL pública de recebimento</p>
            <p className="mt-3 break-all text-sm leading-7 text-slate-400">{webhookUrl}</p>
            <button
              onClick={() => void handleCopy(webhookUrl)}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white transition hover:border-white/20 hover:bg-white/[0.1]"
            >
              <Copy className="h-4 w-4" />
              Copiar endpoint
            </button>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs leading-6 text-slate-400">
              <p className="font-medium uppercase tracking-[0.24em] text-slate-300">Verificação</p>
              <p className="mt-2">
                O webhook aceita `GET /whatsapp/webhook` no formato oficial da Meta e `POST /whatsapp/webhook` tanto
                para payload oficial quanto para o simulador local.
              </p>
              <p className="mt-2">
                {account?.verifyTokenConfigured ? (
                  <>O verify token está definido no ambiente.</>
                ) : (
                  <>
                    O ambiente ainda não define `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; o fallback local é{' '}
                    <span className="text-cyan-200">saaso-dev-webhook-token</span>.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-medium text-white">Payload aceito no ambiente local e oficial da Meta</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-400">
{`{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "metadata": {
              "display_phone_number": "${account?.phoneNumber || '5511999990000'}",
              "phone_number_id": "${account?.phoneNumberId || 'phone-number-id'}"
            },
            "contacts": [{ "profile": { "name": "Lead WhatsApp" } }],
            "messages": [
              {
                "id": "wamid.demo.inbound",
                "from": "5511999998888",
                "type": "text",
                "text": { "body": "Quero falar com o time comercial" }
              }
            ]
          }
        }
      ]
    }
  ]
}`}
            </pre>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              O endpoint também processa `statuses` da Meta para atualizar mensagens outbound para `sent`,
              `delivered`, `read` ou `failed`. Quando `Phone Number ID + access token` estiverem completos, o envio
              outbound sai pela Cloud API oficial; caso contrário, o workspace permanece em fallback local.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
            <MessageSquarePlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Simulador inbound</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Validar lead novo via WhatsApp</h2>
          </div>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]" onSubmit={handleSimulate}>
          <input
            value={simulatorForm.fromPhoneNumber}
            onChange={(event) =>
              setSimulatorForm((current) => ({ ...current, fromPhoneNumber: event.target.value }))
            }
            placeholder="Telefone de origem"
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            required
          />
          <input
            value={simulatorForm.contactName}
            onChange={(event) => setSimulatorForm((current) => ({ ...current, contactName: event.target.value }))}
            placeholder="Nome do contato"
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
          />
          <input
            value={simulatorForm.companyName}
            onChange={(event) => setSimulatorForm((current) => ({ ...current, companyName: event.target.value }))}
            placeholder="Empresa (opcional)"
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
          />
          <select
            value={simulatorForm.stageId}
            onChange={(event) => setSimulatorForm((current) => ({ ...current, stageId: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
          >
            <option value="">Usar primeira etapa do pipeline</option>
            {pipelines.flatMap((pipeline) =>
              pipeline.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {pipeline.name} / {stage.name}
                </option>
              )),
            )}
          </select>
          <textarea
            value={simulatorForm.message}
            onChange={(event) => setSimulatorForm((current) => ({ ...current, message: event.target.value }))}
            rows={4}
            className="xl:col-span-4 rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            placeholder="Mensagem inbound recebida"
            required
          />
          <div className="xl:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              O simulador cria ou reaproveita o contato, abre card se necessário, registra a mensagem inbound e aciona o
              agente da etapa. Modo atual: <span className="text-slate-200">{connectionModeLabel}</span>.
            </p>
            <button
              type="submit"
              disabled={isSimulatingInbound || !canSimulateInbound}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isSimulatingInbound ? 'Simulando...' : 'Simular inbound'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StatusCard({
  label,
  value,
  detail,
  good,
}: {
  label: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[rgba(8,18,34,0.78)] p-5">
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className={`mt-3 text-lg font-semibold ${good ? 'text-emerald-100' : 'text-slate-100'}`}>{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}
