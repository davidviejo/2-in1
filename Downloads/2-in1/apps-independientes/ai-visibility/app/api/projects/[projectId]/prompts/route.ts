import { NextRequest, NextResponse } from 'next/server';

import { canAccessProject, hasRole } from '@/lib/auth/authorization';
import { getRequestUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { normalizeCountry, normalizeLanguage, normalizeSearchTerm, parseDateRange, safeTrim } from '@/lib/filters/normalization';
import { validatePromptInput } from '@/lib/projects/validation';

function canReadProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId });
}

function canWriteProject(request: NextRequest, projectId: string): boolean {
  const user = getRequestUser(request);

  if (!user) {
    return false;
  }

  return canAccessProject(user, { projectId }) && hasRole(user, 'editor');
}

function parseTagIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => safeTrim(value))
        .filter(Boolean)
    )
  );
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const { projectId } = context.params;

  if (!canReadProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const query = normalizeSearchTerm(request.nextUrl.searchParams.get('q'));
  const country = normalizeCountry(request.nextUrl.searchParams.get('country')) ?? '';
  const language = normalizeLanguage(request.nextUrl.searchParams.get('language')) ?? '';
  const intentClassification = normalizeSearchTerm(request.nextUrl.searchParams.get('intentClassification'));
  const activeFilter = request.nextUrl.searchParams.get('active');
  const tagIds = parseTagIds(request.nextUrl.searchParams.get('tagIds'));
  const lastRunRange = parseDateRange(request.nextUrl.searchParams.get('lastRunFrom'), request.nextUrl.searchParams.get('lastRunTo'));
  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20), 100);

  if (lastRunRange.errors) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: { lastRunFrom: 'Invalid last run date range.' } }, { status: 422 });
  }

  const where = {
    projectId,
    deletedAt: null,
    ...(query
      ? {
          OR: [{ promptText: { contains: query, mode: 'insensitive' as const } }, { title: { contains: query, mode: 'insensitive' as const } }, { notes: { contains: query, mode: 'insensitive' as const } }]
        }
      : {}),
    ...(country ? { country } : {}),
    ...(language ? { language } : {}),
    ...(intentClassification ? { intentClassification: { contains: intentClassification, mode: 'insensitive' as const } } : {}),
    ...(activeFilter === 'active' ? { isActive: true } : {}),
    ...(activeFilter === 'inactive' ? { isActive: false } : {}),
    ...(tagIds.length > 0
      ? {
          AND: tagIds.map((tagId) => ({
            promptTags: {
              some: {
                tagId,
                tag: { deletedAt: null }
              }
            }
          }))
        }
      : {}),
    ...(lastRunRange.from || lastRunRange.to
      ? {
          runs: {
            some: {
              executedAt: {
                ...(lastRunRange.from ? { gte: lastRunRange.from } : {}),
                ...(lastRunRange.to ? { lte: lastRunRange.to } : {})
              }
            }
          }
        }
      : {})
  };

  const [total, prompts] = await Promise.all([
    prisma.prompt.count({ where }),
    prisma.prompt.findMany({
      where,
      include: {
        promptTags: {
          where: { tag: { deletedAt: null } },
          include: { tag: true },
          orderBy: { tag: { name: 'asc' } }
        },
        runs: {
          where: { status: 'SUCCEEDED' },
          orderBy: { executedAt: 'desc' },
          include: {
            responses: {
              where: { isError: false },
              include: {
                citations: { select: { id: true } },
                brandMentions: {
                  where: { mentionType: 'OWN_BRAND' },
                  select: { id: true }
                }
              }
            }
          }
        }
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const rows = prompts.map((prompt: (typeof prompts)[number]) => {
    const responses = prompt.runs.flatMap((run: (typeof prompt.runs)[number]) => run.responses);
    const responsesCount = responses.length;
    const responsesWithMention = responses.filter((response: (typeof responses)[number]) => response.brandMentions.length > 0).length;
    const responsesWithCitations = responses.filter((response: (typeof responses)[number]) => response.citations.length > 0).length;

    return {
      id: prompt.id,
      promptText: prompt.promptText,
      country: prompt.country,
      language: prompt.language,
      isActive: prompt.isActive,
      priority: prompt.priority,
      notes: prompt.notes,
      intentClassification: prompt.intentClassification,
      promptTags: prompt.promptTags,
      responsesCount,
      mentionRate: responsesCount > 0 ? Number((responsesWithMention / responsesCount).toFixed(4)) : null,
      citationRate: responsesCount > 0 ? Number((responsesWithCitations / responsesCount).toFixed(4)) : null,
      lastRunDate: prompt.runs[0]?.executedAt ?? null
    };
  });

  return NextResponse.json({
    prompts: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
}

export async function POST(
  request: NextRequest,
  context: {
    params: {
      projectId: string;
    };
  }
) {
  const { projectId } = context.params;

  if (!canWriteProject(request, projectId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const validation = validatePromptInput(payload);

  if (!validation.values) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: validation.errors }, { status: 422 });
  }

  const { tagIds, ...rest } = validation.values;

  const validTagCount =
    tagIds.length === 0
      ? 0
      : await prisma.tag.count({
          where: {
            projectId,
            id: { in: tagIds },
            deletedAt: null
          }
        });

  if (validTagCount !== tagIds.length) {
    return NextResponse.json({ error: 'validation_failed', fieldErrors: { tagIds: 'One or more tags are invalid.' } }, { status: 422 });
  }

  const prompt = await prisma.prompt.create({
    data: {
      projectId,
      title: rest.promptText.slice(0, 80),
      objective: rest.notes,
      status: rest.isActive ? 'ACTIVE' : 'PAUSED',
      ...rest,
      promptTags: {
        create: tagIds.map((tagId) => ({ tagId }))
      }
    },
    include: {
      promptTags: { include: { tag: true }, orderBy: { tag: { name: 'asc' } } }
    }
  });

  return NextResponse.json({ prompt }, { status: 201 });
}
