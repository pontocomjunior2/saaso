import type { Metadata } from 'next';
import './globals.css';
import { AppChrome } from '@/components/layout/AppChrome';

export const metadata: Metadata = {
  title: 'Saaso Revenue OS',
  description: 'Sistema operacional comercial com inbox, agentes de IA, reguas de nutricao e operacao visual.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
