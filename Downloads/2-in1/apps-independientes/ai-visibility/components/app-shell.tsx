import Link from 'next/link';
import { ReactNode } from 'react';

import { navItems } from '@/lib/navigation';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">Internal Analytics</p>
          <h1 className="text-xl font-semibold">AI Visibility</h1>
        </div>

        <nav aria-label="Main navigation" className="space-y-1">
          {navItems.map((item) => (
            <Link
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
