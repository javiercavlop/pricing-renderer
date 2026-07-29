import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import 'pricing-renderer/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pricing Renderer · Next client island',
  description: 'A Pricing2Yaml renderer embedded in a Next App Router page.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
