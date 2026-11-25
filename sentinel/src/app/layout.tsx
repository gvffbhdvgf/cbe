import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sentinel by Softflix | Education Intelligence',
  description: 'A connected, evidence-led platform for education operations, curriculum intelligence and learner progress.',
  applicationName: 'Sentinel',
  icons: { icon: '/icons/sentinel-mark.svg', shortcut: '/icons/sentinel-mark.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
