import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { ProjectProvider } from '@/components/projects/project-context';
import { getSessionUser } from '@/lib/auth/session';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <ProjectProvider>
      <AppShell user={user}>{children}</AppShell>
    </ProjectProvider>
  );
}
