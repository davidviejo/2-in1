import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clusterización KWS & Análisis SERP | David Viejo',
  description: 'Herramienta unificada de clustering de keywords por solapamiento SERP y benchmark competitivo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
