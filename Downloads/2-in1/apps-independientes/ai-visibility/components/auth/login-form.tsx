'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginError = string | null;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@internal.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<LoginError>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? 'Unable to sign in');
      setIsSubmitting(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="username"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
