'use client';

import { useAppSession } from './SessionProvider';
import { useUIMode, type UIMode } from './UIModeProvider';
import { Bell, Command, Plus, Search, Settings2, SlidersHorizontal, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  const { email, workspaceName } = useAppSession();
  const { mode, setMode } = useUIMode();
  const initials = getInitials(workspaceName || email || 'S');

  const handleModeChange = (nextMode: UIMode) => {
    setMode(nextMode);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#f0f0f0] bg-[rgba(255,255,255,0.95)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-6 px-6 py-3 lg:px-8">
        {/* Left Side: System Switcher & Search */}
        <div className="flex flex-1 items-center gap-6 min-w-0">
          <div className="inline-flex items-center rounded-[14px] border border-[#f0f0f0] bg-[#fafcfd] p-1 shrink-0">
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
                  className={`rounded-[10px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
                    isActive ? 'bg-[#e8e6fc] text-[#594ded]' : 'text-[#9e9e9e] hover:text-[#545a66]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <form className="relative flex-1 max-w-[420px] hidden md:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0aec0]" />
            <input
              id="search-field"
              className="h-10 w-full rounded-[12px] border border-[#f0f0f0] bg-white pl-11 pr-16 text-sm text-[#393939] outline-none transition placeholder:text-[#a0aec0] focus:border-[#594ded]/30"
              placeholder="Search or jump to..."
              type="search"
              name="search"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#f8f8f8] px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-[#9e9e9e]">
              <Command className="h-3 w-3" />
              <span>Ctrl K</span>
            </div>
          </form>
        </div>

        {/* Right Side: Actions & Profile */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#f0f0f0] bg-white px-3.5 text-sm font-medium text-[#777777] transition hover:text-[#545a66]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden xl:inline">Filter</span>
            </button>

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#f0f0f0] bg-white text-[#777777] transition hover:text-[#545a66]"
            >
              <Bell className="h-4 w-4" />
            </button>

            <div className="h-6 w-px bg-[#f0f0f0] mx-1" />

            {mode === 'advanced' ? (
              <>
                <Link
                  href="/formularios"
                  className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#f0f0f0] bg-white px-4 text-sm font-medium text-[#545a66] transition hover:bg-[#fafcfd]"
                >
                  <Plus className="h-4 w-4 text-[#594ded]" />
                  Novo lead
                </Link>

                <Link
                  href="/configuracoes"
                  className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#594ded] px-4 text-sm font-semibold text-white transition hover:bg-[#4f44d7]"
                >
                  <Settings2 className="h-4 w-4" />
                  Canais
                </Link>
              </>
            ) : (
              <Link
                href="/wizard"
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#594ded] px-5 text-sm font-bold text-white shadow-sm transition hover:translate-y-[-1px] hover:shadow-md active:translate-y-0"
              >
                <Wand2 className="h-4 w-4" />
                Wizard
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-transparent bg-white/50 pl-2 pr-1 py-1 transition hover:border-[#f0f0f0] hover:bg-white">
            <div className="hidden text-right xl:block">
              <p className="truncate text-[13px] font-bold text-[#1a202c]">{workspaceName}</p>
              <p className="truncate text-[11px] text-[#a0aec0]">{email}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f4] text-[11px] font-bold text-[#594ded] ring-2 ring-white">
              {initials}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
