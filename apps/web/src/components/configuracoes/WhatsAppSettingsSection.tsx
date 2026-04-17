'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  WifiOff,
  ArrowUpRight,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { useWhatsAppAccountStore, WhatsAppAccountSummary } from '@/stores/useWhatsAppAccountStore';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CONNECTED: {
    label: 'Conectado',
    color: 'text-emerald-600',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  DISCONNECTED: {
    label: 'Desconectado',
    color: 'text-gray-500',
    icon: <WifiOff className="h-4 w-4" />,
  },
  QR_READY: {
    label: 'Aguardando QR Code',
    color: 'text-amber-600',
    icon: <QrCode className="h-4 w-4" />,
  },
  ERROR: {
    label: 'Erro na conexao',
    color: 'text-rose-600',
    icon: <AlertCircle className="h-4 w-4" />,
  },
};

const CONNECTION_STATE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  qrcode: {
    label: 'Escaneie o QR Code abaixo',
    color: 'text-amber-600',
    icon: <QrCode className="h-5 w-5" />,
  },
  connecting: {
    label: 'Conectando...',
    color: 'text-blue-600',
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
  },
  connected: {
    label: 'WhatsApp conectado!',
    color: 'text-emerald-600',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  disconnected: {
    label: 'Desconectado',
    color: 'text-gray-500',
    icon: <WifiOff className="h-5 w-5" />,
  },
};

export function WhatsAppSettingsSection() {
  const {
    accounts,
    isLoading,
    error,
    qrCode,
    connectionState,
    selectedProvider,
    fetchAccounts,
    createAccount,
    createEvolutionInstance,
    fetchQrCode,
    fetchConnectionState,
    disconnectAccount,
    deleteAccount,
    switchProvider,
    clearQrCode,
  } = useWhatsAppAccountStore();

  const [instanceName, setInstanceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [activeInstanceName, setActiveInstanceName] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const evolutionAccounts = accounts.filter((a) => a.provider === 'evolution');
  const metaAccounts = accounts.filter((a) => a.provider === 'meta_cloud');
  const currentEvolutionAccount = evolutionAccounts[0] ?? null;

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(
    (name: string) => {
      setIsPolling(true);
      setActiveInstanceName(name);
      pollRef.current = setInterval(async () => {
        try {
          const state = await fetchConnectionState(name);
          if (state === 'open' || state === 'connected' || state === 'CONNECTED') {
            stopPolling();
            clearQrCode();
            void fetchAccounts();
          } else if (state === 'qrcode' || state === 'QR_CODE' || state === 'QR_READY') {
            try {
              await fetchQrCode(name);
            } catch {
              // QR fetch errors are non-fatal during polling
            }
          }
        } catch {
          // Connection state fetch errors are non-fatal during polling
        }
      }, 3000);
    },
    [fetchConnectionState, fetchQrCode, fetchAccounts, stopPolling, clearQrCode],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleCreateEvolutionInstance = async () => {
    if (!instanceName.trim()) return;
    const name = instanceName.trim();
    try {
      await createEvolutionInstance({ name, phoneNumber: phoneNumber.trim() || undefined });
      // After creation, fetch QR code and start polling
      try {
        await fetchQrCode(name);
      } catch {
        // QR might not be ready immediately
      }
      startPolling(name);
      void fetchAccounts();
    } catch {
      // Error is set in store
    }
  };

  const handleRefreshQr = async () => {
    const name = activeInstanceName ?? currentEvolutionAccount?.instanceName ?? null;
    if (name) {
      try {
        await fetchQrCode(name);
      } catch {
        // Error is set in store
      }
    }
  };

  const handleCreateMetaAccount = async () => {
    if (!phoneNumber.trim()) return;
    try {
      await createAccount({ provider: 'meta_cloud', phoneNumber: phoneNumber.trim() });
    } catch {
      // Error is set in store
    }
  };

  const handleDisconnect = async (account: WhatsAppAccountSummary) => {
    try {
      await disconnectAccount(account.id);
      stopPolling();
      clearQrCode();
    } catch {
      // Error is set in store
    }
  };

  const handleDelete = async (account: WhatsAppAccountSummary) => {
    try {
      await deleteAccount(account.id);
      stopPolling();
      clearQrCode();
      setInstanceName('');
    } catch {
      // Error is set in store
    }
  };

  return (
    <div className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-lg font-bold">WhatsApp</h2>
          <p className="text-slate-400 text-sm mt-1">
            Configure o canal de WhatsApp para envio e recebimento de mensagens.
          </p>
        </div>
        <Link
          href="/whatsapp"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.10]"
        >
          Central WhatsApp
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Provider Selection */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => switchProvider('evolution')}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition ${
            selectedProvider === 'evolution'
              ? 'border-[#594ded] bg-[#594ded]/10 text-[#594ded]'
              : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
          }`}
        >
          Evolution API
        </button>
        <button
          onClick={() => switchProvider('meta_cloud')}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition ${
            selectedProvider === 'meta_cloud'
              ? 'border-[#594ded] bg-[#594ded]/10 text-[#594ded]'
              : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
          }`}
        >
          Meta Cloud API
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Evolution API Flow */}
      {selectedProvider === 'evolution' && (
        <div className="mt-6 space-y-4">
          {/* Existing Evolution accounts */}
          {evolutionAccounts.length > 0 && (
            <div className="space-y-3">
              {evolutionAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-center gap-3">
                    {STATUS_CONFIG[account.status]?.icon ?? <WifiOff className="h-4 w-4 text-gray-400" />}
                    <span
                      className={`text-sm font-medium ${STATUS_CONFIG[account.status]?.color ?? 'text-gray-400'}`}
                    >
                      {STATUS_CONFIG[account.status]?.label ?? account.status}
                    </span>
                    {account.instanceName && (
                      <span className="ml-auto text-xs font-mono text-slate-500">{account.instanceName}</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {account.isOperational && (
                      <button
                        onClick={() => void handleDisconnect(account)}
                        className="rounded-xl border border-white/10 bg-white/[0.06] text-white px-3 py-2 text-xs font-bold hover:bg-white/[0.10] disabled:opacity-50"
                        disabled={isLoading}
                      >
                        Desconectar
                      </button>
                    )}
                    <button
                      onClick={() => void handleDelete(account)}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 px-3 py-2 text-xs font-bold hover:bg-rose-500/20 disabled:opacity-50"
                      disabled={isLoading}
                    >
                      Remover conta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instance creation (show when no evolution account or existing is disconnected/error) */}
          {(evolutionAccounts.length === 0 ||
            evolutionAccounts.every(
              (a) => a.status === 'DISCONNECTED' || a.status === 'ERROR',
            )) && (
            <div>
              <label className="text-sm text-slate-400">Nome da instancia</label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="ex: minha-empresa"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#594ded] focus:outline-none"
              />
              <label className="mt-3 block text-sm text-slate-400">Numero de telefone (opcional)</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+5511999999999"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#594ded] focus:outline-none"
              />
              <button
                onClick={() => void handleCreateEvolutionInstance()}
                disabled={isLoading || !instanceName.trim()}
                className="mt-3 rounded-xl bg-[#594ded] text-white px-4 py-2 text-sm font-bold disabled:opacity-50 hover:bg-[#4b3dd4] inline-flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Criar instancia
              </button>
            </div>
          )}

          {/* QR Code display */}
          {(connectionState === 'qrcode' || connectionState === 'QR_CODE' || connectionState === 'QR_READY' || qrCode) && (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 mb-4">
                <QrCode className="h-5 w-5" />
                <span className="text-sm font-bold">Escaneie o QR Code com seu WhatsApp</span>
              </div>
              {qrCode ? (
                <div className="inline-block rounded-2xl bg-white p-4">
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
              ) : (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
              )}
              <button
                onClick={() => void handleRefreshQr()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] text-white px-3 py-2 text-xs font-bold"
              >
                <RefreshCw className="h-3 w-3" />
                Atualizar QR Code
              </button>
              {isPolling && (
                <p className="mt-3 text-xs text-slate-500 flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Aguardando conexao...
                </p>
              )}
            </div>
          )}

          {/* Connection state labels */}
          {connectionState && CONNECTION_STATE_LABELS[connectionState] && (
            <div className={`flex items-center gap-2 text-sm ${CONNECTION_STATE_LABELS[connectionState].color}`}>
              {CONNECTION_STATE_LABELS[connectionState].icon}
              <span>{CONNECTION_STATE_LABELS[connectionState].label}</span>
            </div>
          )}
        </div>
      )}

      {/* Meta Cloud API */}
      {selectedProvider === 'meta_cloud' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-slate-400 text-sm">
              Meta Cloud API configurada via variaveis de ambiente. Para alterar, atualize{' '}
              <code className="text-xs bg-white/[0.06] px-1 py-0.5 rounded">META_PHONE_NUMBER_ID</code> e{' '}
              <code className="text-xs bg-white/[0.06] px-1 py-0.5 rounded">META_ACCESS_TOKEN</code>.
            </p>
            {metaAccounts.map((account) => (
              <div key={account.id} className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                <Smartphone className="h-4 w-4" />
                <span>{account.phoneNumber || account.instanceName || account.id}</span>
                <span
                  className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                    account.isOperational ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {account.isOperational ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            ))}
            {metaAccounts.length === 0 && (
              <p className="mt-3 text-xs text-slate-500">Nenhuma conta Meta Cloud API cadastrada.</p>
            )}
          </div>

          {/* Create Meta account */}
          <div>
            <label className="text-sm text-slate-400">Numero de telefone</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+5511999999999"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#594ded] focus:outline-none"
            />
            <button
              onClick={() => void handleCreateMetaAccount()}
              disabled={isLoading || !phoneNumber.trim()}
              className="mt-3 rounded-xl bg-[#594ded] text-white px-4 py-2 text-sm font-bold disabled:opacity-50 hover:bg-[#4b3dd4] inline-flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Adicionar conta Meta
            </button>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
        <MessageSquare className="h-4 w-4" />
        <span>
          {accounts.length} conta(s) cadastrada(s) —{' '}
          {accounts.filter((a) => a.isOperational).length} operacional(is)
        </span>
      </div>
    </div>
  );
}
