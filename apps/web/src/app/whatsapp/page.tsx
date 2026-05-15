'use client';

import { useAppSession } from '@/components/layout/SessionProvider';
import api from '@/lib/api';
import { useWhatsAppAccountStore, type WhatsAppAccountSummary } from '@/stores/useWhatsAppAccountStore';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquarePlus,
  Plus,
  QrCode,
  RefreshCcw,
  Sparkles,
  Trash2,
  Unplug,
  Webhook,

  XCircle,
} from 'lucide-react';

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string }>;
}

interface EvolutionFormState {
  instanceName: string;
  phoneNumber: string;
}

interface MetaFormState {
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
}

interface SimulatorFormState {
  fromPhoneNumber: string;
  contactName: string;
  companyName: string;
  stageId: string;
  message: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  CONNECTED: { label: 'Conectado', cls: 'bg-emerald-50 text-emerald-700' },
  QR_READY: { label: 'Aguardando QR', cls: 'bg-amber-50 text-amber-700' },
  DISCONNECTED: { label: 'Desconectado', cls: 'bg-gray-100 text-gray-500' },
  ERROR: { label: 'Erro', cls: 'bg-rose-50 text-rose-600' },
};

function accountLabel(account: WhatsAppAccountSummary): string {
  return account.phoneNumber || account.instanceName || account.id;
}

function providerLabel(provider: string): string {
  return provider === 'evolution' ? 'Evolution API' : 'Meta Cloud API';
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
    syncInstanceStatus,
    simulateInbound,
    clearQrCode,
  } = useWhatsAppAccountStore();

  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [evoForm, setEvoForm] = useState<EvolutionFormState>({ instanceName: '', phoneNumber: '' });
  const [metaForm, setMetaForm] = useState<MetaFormState>({ phoneNumber: '', phoneNumberId: '', wabaId: '', accessToken: '' });
  const [simulatorForm, setSimulatorForm] = useState<SimulatorFormState>({
    fromPhoneNumber: '',
    contactName: '',
    companyName: '',
    stageId: '',
    message: 'Olá, quero entender como vocês estruturam o diagnóstico comercial.',
  });
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchAccounts();
    const loadPipelines = async () => {
      try {
        const response = await api.get<PipelineOption[]>('/pipelines');
        if (!active) return;
        setPipelines(response.data);
        setSimulatorForm((c) => ({ ...c, stageId: c.stageId || response.data[0]?.stages[0]?.id || '' }));
      } catch {
        if (active) setPipelines([]);
      }
    };
    void loadPipelines();
    return () => { active = false; };
  }, [fetchAccounts]);

  useEffect(() => {
    if (!selectedAccountId && accounts[0]) setSelectedAccountId(accounts[0].id);
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  useEffect(() => {
    clearQrCode();
    setPageMessage(null);
    if (!selectedAccount) {
      setEvoForm({ instanceName: '', phoneNumber: '' });
      setMetaForm({ phoneNumber: '', phoneNumberId: '', wabaId: '', accessToken: '' });
      return;
    }
    if (selectedAccount.provider === 'evolution') {
      setEvoForm({ instanceName: selectedAccount.instanceName ?? '', phoneNumber: selectedAccount.phoneNumber ?? '' });
    } else {
      setMetaForm({ phoneNumber: selectedAccount.phoneNumber ?? '', phoneNumberId: selectedAccount.phoneNumberId ?? '', wabaId: selectedAccount.wabaId ?? '', accessToken: '' });
    }
  }, [clearQrCode, selectedAccount]);

  const selectedStageLabel = useMemo(() => {
    for (const p of pipelines) {
      const s = p.stages.find((st) => st.id === simulatorForm.stageId);
      if (s) return `${p.name} / ${s.name}`;
    }
    return 'Sem etapa definida';
  }, [pipelines, simulatorForm.stageId]);

  const webhookUrl = `${apiBaseUrl.replace(/\/$/, '')}/whatsapp/webhook`;

  // ── Evolution handlers ──────────────────────────────────────────────────

  const handleSaveEvolution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!evoForm.instanceName.trim()) return;
    setIsSaving(true);
    setPageMessage(null);
    try {
      const payload = { provider: 'evolution' as const, instanceName: evoForm.instanceName.trim(), phoneNumber: evoForm.phoneNumber.trim() || undefined };
      const saved = selectedAccount ? await updateAccount(selectedAccount.id, payload) : await createAccount(payload);
      setSelectedAccountId(saved.id);
      await fetchAccounts();
      setPageMessage('Conta salva. Agora crie/atualize a instância na Evolution API para gerar o QR Code.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!selectedAccount || !evoForm.instanceName.trim()) return;
    setIsCreatingInstance(true);
    setPageMessage(null);
    try {
      await createEvolutionInstance({ name: evoForm.instanceName.trim(), phoneNumber: evoForm.phoneNumber.trim() || undefined });
      await fetchAccounts();
      await fetchQrCode(evoForm.instanceName.trim());
      setPageMessage('Instância criada. Escaneie o QR Code com o WhatsApp.');
      startQrPolling(evoForm.instanceName.trim());
    } catch {
      // error shown via store
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const handleLoadQr = async () => {
    const name = evoForm.instanceName.trim() || selectedAccount?.instanceName;
    if (!name) return;
    setIsFetchingQr(true);
    try {
      await fetchQrCode(name);
      startQrPolling(name);
    } finally {
      setIsFetchingQr(false);
    }
  };

  const startQrPolling = (name: string) => {
    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const state = await fetchConnectionState(name);
        if (state === 'open' || state === 'connected' || state === 'CONNECTED') {
          clearInterval(interval);
          setIsPolling(false);
          clearQrCode();
          await syncInstanceStatus(name);
          await fetchAccounts();
          setPageMessage('WhatsApp conectado com sucesso!');
        }
      } catch {
        // non-fatal
      }
    }, 3000);
  };

  // ── Meta Cloud handlers ─────────────────────────────────────────────────

  const handleSaveMeta = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setPageMessage(null);
    try {
      const payload = {
        provider: 'meta_cloud' as const,
        phoneNumber: metaForm.phoneNumber.trim() || undefined,
        phoneNumberId: metaForm.phoneNumberId.trim() || undefined,
        wabaId: metaForm.wabaId.trim() || undefined,
        accessToken: metaForm.accessToken.trim() || undefined,
      };
      const saved = selectedAccount ? await updateAccount(selectedAccount.id, payload) : await createAccount(payload);
      setSelectedAccountId(saved.id);
      setMetaForm((c) => ({ ...c, accessToken: '' }));
      await fetchAccounts();
      setPageMessage('Conta Meta Cloud salva com sucesso.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Common handlers ─────────────────────────────────────────────────────

  const handleNewAccount = () => {
    setSelectedAccountId('');
    clearQrCode();
    setPageMessage(null);
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

  const handleSimulate = async (event: React.FormEvent) => {
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
      setPageMessage('Mensagem simulada. Revise o Inbox para acompanhar card, thread e resposta do agente.');
      setSimulatorForm((c) => ({ ...c, fromPhoneNumber: '', contactName: '', companyName: '', message: 'Olá, quero entender como vocês estruturam o diagnóstico comercial.' }));
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setPageMessage('Copiado para a área de transferência.');
    } catch {
      setPageMessage('Não foi possível copiar automaticamente.');
    }
  };


  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 p-6 lg:p-8">

      {/* Header */}
      <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#9e9e9e]">WhatsApp</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#393939]">Central WhatsApp</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6b6b6b]">
              Gerencie contas Evolution API e Meta Cloud, leia o QR Code e vincule cada canal ao pipeline correto.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void fetchAccounts()} className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#f2f2f2]">
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Recarregar
            </button>
            <Link href="/inbox" className="inline-flex items-center gap-2 rounded-2xl bg-[#594ded] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4d42cc]">
              Abrir inbox
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feedback */}
      {(error || pageMessage) && (
        <div className={`rounded-3xl px-5 py-4 text-sm ${error ? 'border border-rose-200 bg-rose-50 text-rose-600' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || pageMessage}
        </div>
      )}

      {/* Main grid */}
      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">

        {/* Account list */}
        <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Contas</p>
              <h2 className="mt-1 text-xl font-semibold text-[#393939]">Canais disponíveis</h2>
            </div>
            <button type="button" onClick={handleNewAccount} className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#f2f2f2]">
              <Plus className="h-4 w-4" />
              Nova conta
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {accounts.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#d0d0d0] bg-[#fafafa] px-5 py-6 text-sm text-[#6b6b6b]">
                Nenhuma conta configurada ainda.
              </div>
            ) : (
              accounts.map((account) => {
                const badge = STATUS_BADGE[account.status] ?? { label: account.status, cls: 'bg-gray-100 text-gray-500' };
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${selectedAccountId === account.id ? 'border-[#594ded] bg-[#e8e6fc]' : 'border-[#e8e8e8] bg-[#fafafa] hover:border-[#d0d0d0]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#393939]">{accountLabel(account)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#9e9e9e]">{providerLabel(account.provider)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="mt-3 text-xs text-[#9e9e9e]">{account.assignedPipelineName ? `Pipeline: ${account.assignedPipelineName}` : 'Sem pipeline vinculado'}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail column */}
        <div className="space-y-6">

          {/* Evolution form */}
          {(!selectedAccount || selectedAccount.provider === 'evolution') && (
            <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#594ded]">
                  {selectedAccount?.status === 'CONNECTED' ? <CheckCircle2 className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Evolution API</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#393939]">
                    {selectedAccount ? 'Instância configurada' : 'Nova instância Evolution'}
                  </h2>
                </div>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleSaveEvolution}>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6b6b6b]">Nome da instância <span className="text-rose-500">*</span></label>
                  <input
                    value={evoForm.instanceName}
                    onChange={(e) => setEvoForm((c) => ({ ...c, instanceName: e.target.value }))}
                    placeholder="ex: minha-empresa"
                    required
                    className="w-full rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]"
                  />
                  <p className="mt-1 text-xs text-[#9e9e9e]">Identificador único da instância na Evolution API. Use letras, números e hífens.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6b6b6b]">Número de telefone <span className="text-[#9e9e9e]">(opcional)</span></label>
                  <input
                    value={evoForm.phoneNumber}
                    onChange={(e) => setEvoForm((c) => ({ ...c, phoneNumber: e.target.value }))}
                    placeholder="+5511999999999"
                    className="w-full rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="submit" disabled={isSaving || !evoForm.instanceName.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-[#594ded] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#4d42cc]">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {selectedAccount ? 'Salvar alterações' : 'Salvar conta'}
                  </button>
                  {selectedAccount && (
                    <>
                      <button
                        type="button"
                        onClick={handleCreateInstance}
                        disabled={isCreatingInstance || !evoForm.instanceName.trim()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#594ded] bg-white px-4 py-3 text-sm font-semibold text-[#594ded] disabled:opacity-50 hover:bg-[#f0effe]"
                      >
                        {isCreatingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        {selectedAccount.status === 'CONNECTED' ? 'Reconectar instância' : 'Criar instância e gerar QR'}
                      </button>
                      <button type="button" onClick={handleDisconnect} className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0]">
                        <Unplug className="h-4 w-4" />
                        Desconectar
                      </button>
                      <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100">
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </form>

              {/* QR Code area */}
              {selectedAccount && selectedAccount.status !== 'CONNECTED' && (
                <div className="mt-6 rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-5">
                  {qrCode ? (
                    <>
                      <p className="mb-3 text-sm font-medium text-[#393939]">Escaneie com o WhatsApp para conectar</p>
                      <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="mx-auto max-h-64 w-auto rounded-xl bg-white p-3" />
                      {isPolling && (
                        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#9e9e9e]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Aguardando conexão...
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[#6b6b6b]">
                        Estado: <span className="font-medium text-[#393939]">{connectionState || selectedAccount.status}</span>
                      </p>
                      <button type="button" onClick={handleLoadQr} disabled={isFetchingQr} className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-white px-4 py-2.5 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0] disabled:opacity-50">
                        {isFetchingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        Ler QR Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedAccount?.status === 'CONNECTED' && (
                <div className="mt-6 flex items-center gap-2 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  WhatsApp conectado e operacional.
                </div>
              )}
            </section>
          )}

          {/* Meta Cloud form */}
          {selectedAccount?.provider === 'meta_cloud' && (
            <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#594ded]">
                  {selectedAccount.isOperational ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Meta Cloud API</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#393939]">Credenciais oficiais</h2>
                </div>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleSaveMeta}>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6b6b6b]">Número de telefone</label>
                  <input value={metaForm.phoneNumber} onChange={(e) => setMetaForm((c) => ({ ...c, phoneNumber: e.target.value }))} placeholder="+5511999999999" className="w-full rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6b6b6b]">Phone Number ID</label>
                  <input value={metaForm.phoneNumberId} onChange={(e) => setMetaForm((c) => ({ ...c, phoneNumberId: e.target.value }))} placeholder="ID do número na Meta" className="w-full rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6b6b6b]">WABA ID</label>
                  <input value={metaForm.wabaId} onChange={(e) => setMetaForm((c) => ({ ...c, wabaId: e.target.value }))} placeholder="WhatsApp Business Account ID" className="w-full rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6b6b6b]">Access Token</label>
                  <input type="password" value={metaForm.accessToken} onChange={(e) => setMetaForm((c) => ({ ...c, accessToken: e.target.value }))} placeholder={selectedAccount.hasAccessToken ? 'Token configurado — informe outro para substituir' : 'Token de acesso da Meta'} className="w-full rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" />
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-2xl bg-[#594ded] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#4d42cc]">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Salvar conta
                  </button>
                  <button type="button" onClick={handleDisconnect} className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0]">
                    <Unplug className="h-4 w-4" />
                    Desconectar
                  </button>
                  <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100">
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Webhook URL */}
          <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#594ded]">
                <Webhook className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Webhook</p>
                <h2 className="mt-1 text-xl font-semibold text-[#393939]">Endpoint de recebimento</h2>
              </div>
            </div>
            <div className="mt-5 rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
              <p className="break-all font-mono text-sm text-[#6b6b6b]">{webhookUrl}</p>
              <button onClick={() => void handleCopy(webhookUrl)} className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-white px-4 py-2.5 text-sm text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#fafafa]">
                <Copy className="h-4 w-4" />
                Copiar
              </button>
            </div>
            <p className="mt-3 text-xs text-[#9e9e9e]">Configure este endpoint na Evolution API (ou na Meta) para receber mensagens inbound.</p>
          </section>
        </div>
      </section>

      {/* Simulator */}
      <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e8e8] bg-[#fafafa] text-[#594ded]">
            <MessageSquarePlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">Simulador inbound</p>
            <h2 className="mt-1 text-xl font-semibold text-[#393939]">Validar lead novo via WhatsApp</h2>
          </div>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]" onSubmit={handleSimulate}>
          <input value={simulatorForm.fromPhoneNumber} onChange={(e) => setSimulatorForm((c) => ({ ...c, fromPhoneNumber: e.target.value }))} placeholder="Telefone de origem" className="rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" required />
          <input value={simulatorForm.contactName} onChange={(e) => setSimulatorForm((c) => ({ ...c, contactName: e.target.value }))} placeholder="Nome do contato" className="rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" />
          <input value={simulatorForm.companyName} onChange={(e) => setSimulatorForm((c) => ({ ...c, companyName: e.target.value }))} placeholder="Empresa (opcional)" className="rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" />
          <select value={simulatorForm.stageId} onChange={(e) => setSimulatorForm((c) => ({ ...c, stageId: e.target.value }))} className="rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none focus:border-[#594ded]">
            <option value="">Usar primeira etapa do pipeline</option>
            {pipelines.flatMap((p) => p.stages.map((s) => (
              <option key={s.id} value={s.id}>{p.name} / {s.name}</option>
            )))}
          </select>
          <textarea value={simulatorForm.message} onChange={(e) => setSimulatorForm((c) => ({ ...c, message: e.target.value }))} rows={3} className="xl:col-span-4 rounded-[24px] border border-[#e8e8e8] bg-white px-4 py-3 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]" placeholder="Mensagem inbound" required />
          <div className="xl:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#6b6b6b]">Etapa: <span className="font-medium text-[#393939]">{selectedStageLabel}</span></p>
            <button type="submit" disabled={isSimulating} className="inline-flex items-center gap-2 rounded-2xl bg-[#594ded] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#4d42cc]">
              <Sparkles className="h-4 w-4" />
              {isSimulating ? 'Simulando...' : 'Simular inbound'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
