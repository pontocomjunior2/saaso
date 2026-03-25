'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type UIMode = 'simple' | 'advanced';

const STORAGE_KEY = 'saaso.ui-mode';
const SIMPLE_ROUTE_PREFIXES = ['/', '/inbox', '/pipelines', '/wizard', '/workers'];

interface UIModeContextValue {
  hydrated: boolean;
  mode: UIMode;
  setMode: (mode: UIMode) => void;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

export function isSimpleRoute(pathname: string) {
  return SIMPLE_ROUTE_PREFIXES.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function UIModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UIMode>('simple');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedMode =
      typeof window !== 'undefined' ? (window.localStorage.getItem(STORAGE_KEY) as UIMode | null) : null;

    if (storedMode === 'advanced' || storedMode === 'simple') {
      setModeState(storedMode);
    }

    setHydrated(true);
  }, []);

  const value = useMemo<UIModeContextValue>(
    () => ({
      hydrated,
      mode,
      setMode: (nextMode) => {
        setModeState(nextMode);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, nextMode);
        }
      },
    }),
    [hydrated, mode],
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.uiMode = mode;
    }
  }, [mode]);

  return <UIModeContext.Provider value={value}>{children}</UIModeContext.Provider>;
}

export function useUIMode() {
  const context = useContext(UIModeContext);

  if (!context) {
    throw new Error('useUIMode must be used inside UIModeProvider.');
  }

  return context;
}
