'use client';

import { usePathname } from 'next/navigation';
import { AppSessionProvider } from './SessionProvider';
import { DashboardLayout } from './DashboardLayout';
import { UIModeProvider, useUIMode } from './UIModeProvider';

function AppChromeShell({ children }: { children: React.ReactNode }) {
  useUIMode();

  return <DashboardLayout>{children}</DashboardLayout>;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicForm = pathname.startsWith('/f/');

  if (isPublicForm) {
    return <>{children}</>;
  }

  return (
    <AppSessionProvider>
      <UIModeProvider>
        <AppChromeShell>{children}</AppChromeShell>
      </UIModeProvider>
    </AppSessionProvider>
  );
}
