import React from 'react';
import AppShell from './AppShell';

interface ShellVariantProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}

export const PortalShell: React.FC<ShellVariantProps> = ({ header, children, contentClassName }) => (
  <AppShell
    header={header}
    className="bg-slate-50"
    headerClassName="fixed top-0 left-0 right-0 z-40"
    bodyClassName="pt-20"
    contentClassName={contentClassName ?? 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'}
  >
    {children}
  </AppShell>
);

export const OperatorShell: React.FC<ShellVariantProps> = ({ header, children, contentClassName }) => (
  <AppShell
    header={header}
    className="bg-slate-900 text-slate-200"
    headerClassName="border-b border-slate-700 bg-slate-900/95"
    bodyClassName="min-h-screen"
    contentClassName={contentClassName ?? 'mx-auto w-full max-w-5xl px-4 py-8'}
  >
    {children}
  </AppShell>
);

export const InternalShell: React.FC<ShellVariantProps> = ({
  header,
  sidebar,
  children,
  contentClassName,
}) => (
  <AppShell
    header={header}
    sidebar={sidebar}
    className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900"
    headerClassName="fixed top-0 left-0 right-0 z-50"
    bodyClassName="h-screen"
    sidebarClassName="shrink-0"
    contentClassName={contentClassName ?? 'overflow-auto pt-16'}
  >
    {children}
  </AppShell>
);
