import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Notification Requests',
  description: 'Submit notification requests and track their delivery status.',
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
    <body className="bg-background text-foreground flex min-h-full flex-col">
      <Providers>{children}</Providers>
      <Toaster richColors position="top-right" />
    </body>
  </html>
);

export default RootLayout;
