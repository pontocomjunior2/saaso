'use client';

import { useAppSession } from './SessionProvider';
import { useUIMode, type UIMode } from './UIModeProvider';
import { Bell, ChevronRight, Command, Plus, Search, Settings2, SlidersHorizontal, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRouteMeta } from './shell-config';

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Header() {
  const pathname = usePathname();
  const { email, isDemoSession, workspaceName } = useAppSession();
  const { mode, setMode } = useUIMode();
  const meta = getRouteMeta(pathname);
  const initials = getInitials(workspaceName || email || 'S');

  const handleModeChange = (nextMode: UIMode) => {
    setMode(nextMode);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#f0f0f0] bg-[rgba(255,255,255,0.95)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-5 py-4 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 text-sm text-[#9e9e9e]">
              <span className="shrink-0">{meta.eyebrow}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span className="shrink-0">Workspace</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span className="truncate text-[#545a66]">{meta.title}</span>
            </div>
            <div className="mt-3 flex items-start gap-4 xl:items-center">
              <div className="h-12 w-12 shrink-0 rounded-xl border border-[#f0f0f0] bg-[#fbfbfb]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-[1.75rem] font-bold text-[#1a202c] xl:text-[2rem]">{meta.title}</h1>
                  {isDemoSession ? (
                    <span className="rounded-full bg-[#faf6e2] px-2.5 py-1 text-[11px] font-medium text-[#f5bd4f]">
                      Demo
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-[#a0aec0] xl:line-clamp-1">{meta.description}</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center">
            <div className="inline-flex items-center rounded-[14px] border border-[#f0f0f0] bg-[#fafcfd] p-1">
              {[
                { value: 'simple' as const, label: 'Simple' },
                { value: 'advanced' as const, label: 'Advanced' },
              ].map((item) => {
                const isActive = mode === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleModeChange(item.value)}
                    className={`rounded-[10px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      isActive ? 'bg-[#e8e6fc] text-[#594ded]' : 'text-[#9e9e9e] hover:text-[#545a66]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <form className="relative min-w-0 lg:w-[18rem] xl:w-[21rem]">
              <label htmlFor="search-field" className="sr-only">
                Pesquisar
              </label>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e9e9e]" />
              <input
                id="search-field"
                className="h-11 w-full rounded-[12px] border border-[#f0f0f0] bg-white pl-11 pr-16 text-sm text-[#393939] outline-none transition placeholder:text-[#9e9e9e] focus:border-[#d9d7f8]"
                placeholder="Search..."
                type="search"
                name="search"
              />
              <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#f8f8f8] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#9e9e9e]">
                <Command className="h-3 w-3" />
                <span>Ctrl K</span>
              </div>
            </form>

            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#f0f0f0] bg-white px-4 text-sm font-medium text-[#777777] transition hover:text-[#545a66]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </button>

            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#f0f0f0] bg-white text-[#777777] transition hover:text-[#545a66]"
            >
              <span className="sr-only">Notificacoes</span>
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>

            {mode === 'advanced' ? (
              <>
                <Link
                  href="/formularios"
                  className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-[#f0f0f0] bg-white px-4 text-sm font-medium text-[#545a66] transition hover:bg-[#fafcfd]"
                >
                  <Plus className="h-4 w-4 text-[#594ded]" />
                  Novo lead
                </Link>

                <Link
                  href="/configuracoes"
                  className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-[#594ded] px-4 text-sm font-semibold text-white transition hover:bg-[#4f44d7]"
                >
                  <Settings2 className="h-4 w-4" />
                  Canais
                </Link>
              </>
            ) : (
              <Link
                href="/wizard"
                className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-[#594ded] px-4 text-sm font-semibold text-white transition hover:bg-[#4f44d7]"
              >
                <Wand2 className="h-4 w-4" />
                Wizard
              </Link>
            )}

            <div className="flex items-center gap-3 rounded-[14px] bg-white pl-1 pr-2">
              <div className="h-10 w-10 rounded-full bg-[#d9d9d9]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#393939]">{workspaceName}</p>
                <p className="truncate text-[12px] text-[#9e9e9e]">{email}</p>
              </div>
              <div className="hidden rounded-full bg-[#f4f4f4] px-2 py-1 text-[10px] font-semibold text-[#777777] sm:block">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
