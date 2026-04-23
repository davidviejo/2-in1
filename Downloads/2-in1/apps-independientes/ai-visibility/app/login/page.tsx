import { LoginForm } from '@/components/auth/login-form';
import { getSeededDevUsers } from '@/lib/auth/dev-users';

export default function LoginPage() {
  const seededUsers = getSeededDevUsers();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internal app</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">AI Visibility sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use one of the seeded local users below.</p>

        <ul className="mt-3 space-y-2 rounded-md bg-slate-100 p-3 text-xs text-slate-700">
          {seededUsers.map((user) => (
            <li key={user.id}>
              <span className="font-semibold">{user.role}</span>: {user.email} / {user.password}
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
