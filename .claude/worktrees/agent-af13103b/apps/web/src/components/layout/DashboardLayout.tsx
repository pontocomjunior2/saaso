import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useUIMode } from './UIModeProvider';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  useUIMode();

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto grid min-h-screen max-w-[1920px] grid-cols-1 gap-0 lg:grid-cols-[318px_minmax(0,1fr)]">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-col border-l border-[#f0f0f0] bg-transparent">
          <Header />
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto focus:outline-none">{children}</main>
        </div>
      </div>
    </div>
  );
}
