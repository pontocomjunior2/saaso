'use client';

import { useAppSession } from '@/components/layout/SessionProvider';
import api from '@/lib/api';
import { useWhatsAppAccountStore, type WhatsAppAccountSummary } from '@/stores/useWhatsAppAccountStore';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Copy, MessageSquarePlus, Plus, QrCode, RefreshCcw, Save, Sparkles, Trash2, Unplug, Webhook, XCircle } from 'lucide-react';

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string }>;
}

interface ChannelFormState {
  provider: 'meta_cloud' | 'evolution';
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  instanceName: string;
}

interface SimulatorFormState {
  fromPhoneNumber: string;
  contactName: string;
  companyName: string;
  stageId: string;
  message: string;
}

const emptyChannelForm: ChannelFormState = {
  provider: 'evolution',
  phoneNumber: '',
  phoneNumberId: '',
  wabaId: '',
  accessToken: '',
  instanceName: '',
};

const emptySimulatorForm: SimulatorFormState = {
  fromPhoneNumber: '',
  contactName: '',
  companyName: '',
  stageId: '',
  message: 'Olá, quero entender como vocês estruturam o diagnóstico comercial.',
};

function getConnectionModeLabel(account: WhatsAppAccountSummary | null): string {
  if (!account) return 'Sem conta';
  if (account.connectionMode === 'cloud_api') return 'Cloud API oficial';
  if (account.connectionMode === 'local_demo') return 'Demo local';
  return 'Configuração parcial';
}

export default function WhatsAppPage() {
  const { apiBaseUrl } = useAppSession();
  const {
    accounts,
    isLoading,
    error,
    qrCode,
    connectionState,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    disconnectAccount,
    createEvolutionInstance,
    fetchQrCode,
    fetchConnectionState,
    simulateInbound,
    clearQrCode,
  } = useWhatsAppAccountStore();
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [channelForm, setChannelForm] = useState<ChannelFormState>(emptyChannelForm);
  const [simulatorForm, setSimulatorForm] = useState<SimulatorFormState>(emptySimulatorForm);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchAccounts();

    const loadPipelines = async () => {
      try {
        const response = await api.get<PipelineOption[]>('/pipelines');
        if (!active) return;
        setPipelines(response.data);
        setSimulatorForm((current) => ({
          ...current,
          stageId: current.stageId || response.data[0]?.stages[0]?.id || '',
        }));
      } catch {
        if (active) setPipelines([]);
      }
    };

    void loadPipelines();
    return () => {
      active = false;
    };
  }, [fetchAccounts]);

  useEffect(() => {
    if (!selectedAccountId && accounts[0]) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;

  useEffect(() => {
    if (!selectedAccount) {
      setChannelForm(emptyChannelForm);
      clearQrCode();
      return;
    }

    setChannelForm({
      provider: (selectedAccount.provider as 'meta_cloud' | 'evolution') ?? 'evolution',
      phoneNumber: selectedAccount.phoneNumber ?? '',
      phoneNumberId: selectedAccount.phoneNumberId ?? '',
      wabaId: selectedAccount.wabaId ?? '',
      accessToken: '',
      instanceName: selectedAccount.instanceName ?? '',
    });
    clearQrCode();
  }, [clearQrCode, selectedAccount]);

  const selectedStageLabel = useMemo(() => {
    for (const pipeline of pipelines) {
      const stage = pipeline.stages.find((item) => item.id === simulatorForm.stageId);
      if (stage) return `${pipeline.name} / ${stage.name}`;
    }
    return 'Sem etapa definida';
  }, [pipelines, simulatorForm.stageId]);

  const webhookUrl = `${apiBaseUrl.replace(/\/$/, '')}/whatsapp/webhook`;

  const handleSaveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageMessage(null);
    setIsSaving(true);
    try {
      const payload = {
        provider: channelForm.provider,
        phoneNumber: channelForm.phoneNumber || undefined,
        phoneNumberId: channelForm.phoneNumberId || undefined,
        wabaId: channelForm.wabaId || undefined,
        accessToken: channelForm.accessToken || undefined,
        instanceName: channelForm.instanceName || undefined,
      };
      const account = selectedAccount ? await updateAccount(selectedAccount.id, payload) : await createAccount(payload);
      setSelectedAccountId(account.id);
      setChannelForm((current) => ({ ...current, accessToken: '' }));
      await fetchAccounts();
      setPageMessage('Conta WhatsApp salva com sucesso.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewAccount = () => {
    setSelectedAccountId('');
    setChannelForm(emptyChannelForm);
    clearQrCode();
    setPageMessage(null);
  };

  const handleCreateEvolutionInstance = async () => {
    if (!selectedAccount || channelForm.provider !== 'evolution' || !channelForm.instanceName) return;
    setIsCreatingInstance(true);
    setPageMessage(null);
    try {
      await createEvolutionInstance({
        name: channelForm.instanceName,
        phoneNumber: channelForm.phoneNumber || undefined,
      });
      await fetchAccounts();
      setPageMessage('Instância Evolution criada/atualizada. Agora leia o QR Code para conectar.');
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const handleLoadQrCode = async () => {
    if (!channelForm.instanceName) return;
    setIsFetchingQr(true);
    setPageMessage(null);
    try {
      await fetchQrCode(channelForm.instanceName);
      await fetchConnectionState(channelForm.instanceName);
      setPageMessage('QR Code carregado.');
    } finally {
      setIsFetchingQr(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedAccount) return;
    await disconnectAccount(selectedAccount.id);
    await fetchAccounts();
    setPageMessage('Conta desconectada.');
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    await deleteAccount(selectedAccount.id);
    await fetchAccounts();
    setSelectedAccountId('');
    setPageMessage('Conta removida.');
  };

  const handleSimulate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSimulating(true);
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
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setPageMessage('Valor copiado para a área de transferência.');
    } catch {
      setPageMessage('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">WhatsApp</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Múltiplas contas, providers e conexão operacional.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Gerencie várias contas no mesmo tenant, escolha Evolution ou Meta Cloud por conta, leia o QR Code e vincule cada canal ao pipeline correto.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void fetchAccounts()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.12]">
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Recarregar status
            </button>
            <Link href="/inbox" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(89,211,255,0.28)] transition hover:translate-y-[-1px]">
              Abrir inbox
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {(error || pageMessage) && (
        <div className={`rounded-3xl px-5 py-4 text-sm ${error ? 'border border-rose-400/20 bg-rose-500/10 text-rose-100' : 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100'}`}>
          {error || pageMessage}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Contas</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Canais disponíveis</h2>
            </div>
            <button type="button" onClick={handleNewAccount} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Nova conta
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {accounts.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-slate-400">
                Nenhuma conta configurada ainda. Crie a primeira conta para conectar um funil.
              </div>
            ) : (
              accounts.map((account) => (
                <button key={account.id} type="button" onClick={() => setSelectedAccountId(account.id)} className={`w-full rounded-[24px] border p-4 text-left ${selectedAccountId === account.id ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/10 bg-white/[0.04]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{account.phoneNumber || account.instanceName || account.id}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">{account.provider}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${account.isOperational ? 'bg-emerald-500/10 text-emerald-100' : 'bg-amber-500/10 text-amber-100'}`}>
                      {getConnectionModeLabel(account)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{account.assignedPipelineName ? `Pipeline ${account.assignedPipelineName}` : 'Sem pipeline vinculado'}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
                {selectedAccount?.isOperational ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Conta ativa</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Provider e credenciais</h2>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSaveAccount}>
              <select value={channelForm.provider} onChange={(event) => setChannelForm((current) => ({ ...current, provider: event.target.value as 'meta_cloud' | 'evolution' }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none">
                <option value="evolution">Evolution API</option>
                <option value="meta_cloud">Meta Cloud API</option>
              </select>
              <input value={channelForm.phoneNumber} onChange={(event) => setChannelForm((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="Número do WhatsApp com DDI/DDD" className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" />
              {channelForm.provider === 'evolution' ? <input value={channelForm.instanceName} onChange={(event) => setChannelForm((current) => ({ ...current, instanceName: event.target.value }))} placeholder="Nome da instance Evolution" className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" /> : null}
              {channelForm.provider === 'meta_cloud' ? (
                <>
                  <input value={channelForm.phoneNumberId} onChange={(event) => setChannelForm((current) => ({ ...current, phoneNumberId: event.target.value }))} placeholder="Phone Number ID da Meta" className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" />
                  <input value={channelForm.wabaId} onChange={(event) => setChannelForm((current) => ({ ...current, wabaId: event.target.value }))} placeholder="WABA ID" className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" />
                </>
              ) : null}
              <input type="password" value={channelForm.accessToken} onChange={(event) => setChannelForm((current) => ({ ...current, accessToken: event.target.value }))} placeholder={selectedAccount?.hasAccessToken ? 'Token configurado. Informe outro para substituir.' : 'Access token / API key'} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" />

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Salvando...' : 'Salvar conta'}
                </button>
                {selectedAccount ? (
                  <>
                    <button type="button" onClick={handleDisconnect} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white">
                      <Unplug className="h-4 w-4" />
                      Desconectar
                    </button>
                    <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </>
                ) : null}
              </div>
            </form>
          </section>

          {channelForm.provider === 'evolution' ? (
            <section className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Evolution</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">QR Code e estado da conexão</h2>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={handleCreateEvolutionInstance} disabled={!selectedAccount || !channelForm.instanceName || isCreatingInstance} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
                  {isCreatingInstance ? 'Criando...' : 'Criar/atualizar instância'}
                </button>
                <button type="button" onClick={handleLoadQrCode} disabled={!channelForm.instanceName || isFetchingQr} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                  {isFetchingQr ? 'Carregando...' : 'Ler QR Code'}
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                Estado atual: <span className="text-white">{connectionState || selectedAccount?.status || 'Sem leitura'}</span>
              </div>
              {qrCode ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white p-4">
                  <img src={qrCode} alt="QR Code da instância Evolution" className="mx-auto max-h-[22rem] w-auto" />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
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
              <button onClick={() => void handleCopy(webhookUrl)} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white">
                <Copy className="h-4 w-4" />
                Copiar endpoint
              </button>
            </div>
          </section>
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
          <input value={simulatorForm.fromPhoneNumber} onChange={(event) => setSimulatorForm((current) => ({ ...current, fromPhoneNumber: event.target.value }))} placeholder="Telefone de origem" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" required />
          <input value={simulatorForm.contactName} onChange={(event) => setSimulatorForm((current) => ({ ...current, contactName: event.target.value }))} placeholder="Nome do contato" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" />
          <input value={simulatorForm.companyName} onChange={(event) => setSimulatorForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="Empresa (opcional)" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" />
          <select value={simulatorForm.stageId} onChange={(event) => setSimulatorForm((current) => ({ ...current, stageId: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none">
            <option value="">Usar primeira etapa do pipeline</option>
            {pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {pipeline.name} / {stage.name}
              </option>
            )))}
          </select>
          <textarea value={simulatorForm.message} onChange={(event) => setSimulatorForm((current) => ({ ...current, message: event.target.value }))} rows={4} className="xl:col-span-4 rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none" placeholder="Mensagem inbound recebida" required />
          <div className="xl:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              O simulador cria ou reaproveita o contato, abre card se necessário e aciona o agente da etapa. Etapa atual: <span className="text-slate-200">{selectedStageLabel}</span>.
            </p>
            <button type="submit" disabled={isSimulating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              <Sparkles className="h-4 w-4" />
              {isSimulating ? 'Simulando...' : 'Simular inbound'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
