'use client';

import { useAppSession } from './SessionProvider';
import { useUIMode } from './UIModeProvider';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, ChevronRight, ChevronsUpDown, LogOut } from 'lucide-react';
import {
  getUtilityIcon,
  isNavHrefActive,
  isNavItemActive,
  mainNavigation,
  simpleNavigation,
  simpleUtilityNavigation,
  utilityNavigation,
} from './shell-config';

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Sidebar() {
  const pathname = usePathname();
  const { mode } = useUIMode();
  const { email, isDemoSession, logout, tenantName, workspaceCount, workspaceName } = useAppSession();
  const accountInitials = getInitials(workspaceName || tenantName || 'S');
  const navigation = mode === 'simple' ? simpleNavigation : mainNavigation;
  const shortcuts = mode === 'simple' ? simpleUtilityNavigation : utilityNavigation;
  return (
    <aside className="w-full shrink-0 border-r border-[#f0f0f0] bg-white lg:sticky lg:top-0 lg:h-screen lg:w-[280px]">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-[#f0f0f0] px-5 py-6">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#594ded] text-[20px] font-bold text-white shadow-sm">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#1a202c]">{workspaceName}</p>
            <p className="mt-0.5 truncate text-[12px] font-medium text-[#a0aec0]">{tenantName}</p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#a0aec0] transition hover:bg-[#f7f7f7]"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium text-[#9e9e9e]">Project & Companies</p>
                <div className="text-[#bfbfbf]">+</div>
              </div>

              <div className="mt-4 space-y-1">
                {navigation.map((item) => {
                  const isActive = isNavItemActive(pathname, item);
                  const isDisabled = !item.href && !item.children?.some((child) => child.href) || item.disabled;

                  const topLevel = (
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition',
                        isActive ? 'bg-white text-[#1a202c] shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : 'text-[#718096] hover:bg-[#fafafb]',
                        isDisabled ? 'opacity-70' : '',
                      )}
                    >
                      <div className={cn(
                        'flex h-[24px] w-[24px] items-center justify-center rounded-[6px]',
                        isActive ? 'bg-[#594ded]/10 text-[#594ded]' : 'text-[#a0aec0]'
                      )}>
                        <item.icon className="h-[15px] w-[15px]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('truncate text-[14px]', isActive ? 'font-bold' : 'font-medium')}>{item.label}</span>
                          {item.badge ? (
                            <span className="rounded-full bg-[#f7f7f7] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[#9e9e9e]">
                              {item.badge}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {item.href && !item.disabled ? <ChevronRight className="h-4 w-4 text-[#cbd5e0]" /> : null}
                    </div>
                  );

                  return (
                    <div key={item.label} title={item.description}>
                      {item.href && !item.disabled ? <Link href={item.href}>{topLevel}</Link> : topLevel}

                      {item.children?.length && isActive ? (
                        <div className="ml-[11px] border-l border-[#e9e9e9] pl-3">
                          {item.children.map((child) => {
                            const childIsActive = child.href ? isNavHrefActive(pathname, child.href) : false;
                            const childContent = (
                              <div
                                className={cn(
                                  'mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition',
                                  childIsActive ? 'bg-[#f4f4fb] text-[#393939]' : 'text-[#777777] hover:bg-[#fafafb]',
                                )}
                              >
                                <span className="truncate">{child.label}</span>
                                {child.badge ? <span className="text-[10px] text-[#bfbfbf]">{child.badge}</span> : null}
                              </div>
                            );

                            if (!child.href || child.disabled) {
                              return <div key={child.label}>{childContent}</div>;
                            }

                            return (
                              <Link key={child.label} href={child.href} title={child.description}>
                                {childContent}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-7">
              <p className="text-[12px] font-medium text-[#9e9e9e]">Categories</p>
              <div className="mt-4 space-y-3 px-1">
                {navigation.slice(0, 4).map((item, index) => {
                  const palette = ['#fc736f', '#3b78f5', '#f5bd4f', '#22bd73'][index] ?? '#8f8cb6';
                  return (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-[14px]">
                      <div className="flex items-center gap-3 text-[#777777]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette }} />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-[12px] text-[#9e9e9e]">{index + 2}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {shortcuts.length > 0 ? (
              <div className="mt-7">
                <p className="text-[12px] font-medium text-[#9e9e9e]">Shortcuts</p>
                <div className="mt-4 space-y-2">
                  {shortcuts.map((item) => {
                    const Icon = getUtilityIcon(item.label);
                    const isActive = item.href ? isNavHrefActive(pathname, item.href) : false;
                    return (
                      <Link
                        key={item.label}
                        href={item.href ?? '#'}
                        title={item.description}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3 py-3 transition',
                          isActive ? 'text-[#594ded]' : 'text-[#777777] hover:bg-[#fafafb]',
                        )}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f8fd] text-[#8f8cb6]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="truncate text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#f0f0f0] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d9d9d9] text-sm font-semibold text-[#545a66]">
                {accountInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#393939]">{email}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#9e9e9e]">
                  {isDemoSession ? 'Sessao demo' : 'Sessao ativa'}
                </p>
              </div>
              <button
                onClick={logout}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#a0aec0] bg-transparent transition hover:bg-[#fff1f1] hover:text-[#fc736f]"
                title="Encerrar sessao"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
      </div>
    </aside>
  );
}
