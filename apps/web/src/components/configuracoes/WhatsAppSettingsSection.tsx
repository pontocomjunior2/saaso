'use client';

import { useEffect } from 'react';
import { CheckCircle2, WifiOff, AlertCircle, QrCode, ArrowUpRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useWhatsAppAccountStore } from '@/stores/useWhatsAppAccountStore';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  CONNECTED: {
    label: 'Conectado',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  },
  DISCONNECTED: {
    label: 'Desconectado',
    color: 'text-gray-500',
    dot: 'bg-gray-300',
    icon: <WifiOff className="h-5 w-5 text-gray-400" />,
  },
  QR_READY: {
    label: 'Aguardando QR Code',
    color: 'text-amber-600',
    dot: 'bg-amber-400',
    icon: <QrCode className="h-5 w-5 text-amber-500" />,
  },
  ERROR: {
    label: 'Erro na conexão',
    color: 'text-rose-600',
    dot: 'bg-rose-400',
    icon: <AlertCircle className="h-5 w-5 text-rose-500" />,
  },
};

export function WhatsAppSettingsSection() {
  const { accounts, isLoading, fetchAccounts } = useWhatsAppAccountStore();

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const operationalAccounts = accounts.filter((a) => a.isOperational);

  return (
    <div className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#9e9e9e]">WhatsApp</p>
          <h2 className="mt-1 text-xl font-semibold text-[#393939]">Canal de mensagens</h2>
        </div>
        <Link
          href="/whatsapp"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-2.5 text-sm font-medium text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#f2f2f2]"
        >
          Gerenciar
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5">
        {isLoading && accounts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[#9e9e9e]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando...
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[24px] border border-dashed border-[#d0d0d0] bg-[#fafafa] px-4 py-4">
            <WifiOff className="h-5 w-5 text-[#9e9e9e]" />
            <div>
              <p className="text-sm font-medium text-[#393939]">Nenhuma conta configurada</p>
              <p className="mt-0.5 text-xs text-[#9e9e9e]">Configure na Central WhatsApp para conectar.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const cfg = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.DISCONNECTED;
              return (
                <div key={account.id} className="flex items-center gap-3 rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] px-4 py-3">
                  {cfg.icon}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
                    <p className="mt-0.5 truncate text-xs text-[#9e9e9e]">
                      {account.provider === 'evolution' ? 'Evolution API' : 'Meta Cloud API'}
                      {account.instanceName ? ` · ${account.instanceName}` : ''}
                      {account.phoneNumber ? ` · ${account.phoneNumber}` : ''}
                    </p>
                  </div>
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {operationalAccounts.length > 0 && (
        <p className="mt-4 text-xs text-[#9e9e9e]">
          {operationalAccounts.length} conta(s) operacional(is) — mensagens sendo recebidas.
        </p>
      )}
    </div>
  );
}
