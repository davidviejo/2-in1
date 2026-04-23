import { prisma } from '@/lib/db';
import { normalizeAlias } from '@/lib/projects/validation';

export type CompetitorMatcher = {
  competitorId: string;
  competitorName: string;
  domain: string;
  aliases: string[];
  matchTerms: string[];
};

type CompetitorRecord = {
  id: string;
  name: string;
  domain: string;
  aliases: string[];
};

export async function getProjectCompetitorMatchers(projectId: string): Promise<CompetitorMatcher[]> {
  const competitors = (await prisma.competitor.findMany({
    where: {
      projectId,
      deletedAt: null,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      domain: true,
      aliases: true
    },
    orderBy: { name: 'asc' }
  })) as CompetitorRecord[];

  return competitors.map((competitor) => {
    const matchTerms = Array.from(new Set([competitor.name, ...competitor.aliases].map(normalizeAlias)));

    return {
      competitorId: competitor.id,
      competitorName: competitor.name,
      domain: competitor.domain,
      aliases: competitor.aliases,
      matchTerms
    };
  });
}
