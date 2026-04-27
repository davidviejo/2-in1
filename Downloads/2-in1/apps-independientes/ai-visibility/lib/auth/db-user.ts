import { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';

export async function ensureDbUser(sessionUser: SessionUser): Promise<{ id: string }> {
  return prisma.user.upsert({
    where: { email: sessionUser.email.toLowerCase() },
    update: {
      name: sessionUser.name,
      isActive: true
    },
    create: {
      email: sessionUser.email.toLowerCase(),
      name: sessionUser.name,
      isActive: true
    },
    select: {
      id: true
    }
  });
}
