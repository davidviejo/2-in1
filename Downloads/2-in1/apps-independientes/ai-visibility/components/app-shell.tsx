import Link from "next/link";
import { navItems } from "@/lib/nav-items";

type AppShellProps = {
  title: string;
  description: string;
};

export function AppShell({ title, description }: AppShellProps) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold">AI Visibility</h1>
          <p className="text-sm text-slate-600">Internal analytics</p>
        </div>
        <nav>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="p-6 md:p-10">
        <header className="mb-6 border-b border-slate-200 pb-4">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </header>

        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-700">
          Placeholder content. Business logic will be added in later iterations.
        </section>
      </main>
    </div>
  );
}
