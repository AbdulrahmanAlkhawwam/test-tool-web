import type { Metadata } from 'next';
// Fonts are bundled from npm (no Google Fonts request at build or run time).
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Ejad Test Cases', template: '%s · Ejad Test Cases' },
  description: 'Manual and automated test case management for Ejad projects',
  icons: { icon: '/ejad-logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
