#!/usr/bin/env node

import prismaPkg from '@prisma/client';

const { PrismaClient, BrandMentionType, PromptStatus, RunSource, RunStatus, RunTriggerType, SnapshotGranularity } = prismaPkg;

const prisma = new PrismaClient();

const DEMO_OWNER_EMAIL = 'seed-bot@internal.local';
const DEMO_OWNER_NAME = 'Seed Bot';
const DEMO_PROJECT_SLUG = 'smilecraft-dental-austin';

const competitorsSeed = [
  {
    name: 'BrightSmile Dental Austin',
    domain: 'brightsmileaustin.com',
    aliases: ['BrightSmile', 'Bright Smile Dental'],
    category: 'General Dentistry',
    chartColor: '#0ea5e9'
  },
  {
    name: 'Lone Star Family Dentistry',
    domain: 'lonestarfamilydentistry.com',
    aliases: ['Lone Star Family Dental', 'LoneStar Dentistry'],
    category: 'Family Dentistry',
    chartColor: '#f97316'
  },
  {
    name: 'South Congress Dental Studio',
    domain: 'socodentalstudio.com',
    aliases: ['SoCo Dental', 'South Congress Dental'],
    category: 'Cosmetic Dentistry',
    chartColor: '#8b5cf6'
  },
  {
    name: 'Capitol City Orthodontics',
    domain: 'capcityortho.com',
    aliases: ['CapCity Ortho', 'Capitol City Ortho'],
    category: 'Orthodontics',
    chartColor: '#22c55e'
  },
  {
    name: 'Riverbend Emergency Dental',
    domain: 'riverbendemergencydental.com',
    aliases: ['Riverbend Dental ER', 'Riverbend Emergency'],
    category: 'Emergency Dentistry',
    chartColor: '#ef4444'
  }
];

const tagsSeed = [
  { name: 'Implants', description: 'Dental implants and restorative options.' },
  { name: 'Invisalign', description: 'Clear aligners and orthodontic options.' },
  { name: 'Emergency', description: 'Urgent and same-day dental care.' },
  { name: 'Pediatric', description: 'Kids and family dentistry concerns.' },
  { name: 'Insurance', description: 'Coverage, PPO, and payment support.' },
  { name: 'Bilingual Care', description: 'Spanish/English patient support.' },
  { name: 'Teeth Whitening', description: 'Cosmetic and whitening options.' },
  { name: 'Weekend Hours', description: 'Availability on Saturdays and after-work appointments.' }
];

const promptDefinitions = [
  { title: 'Best dentist in Austin for implants', objective: 'Visibility for implant treatment intent', tags: ['Implants'] },
  { title: 'Affordable Invisalign options in Austin TX', objective: 'Track clear aligner affordability queries', tags: ['Invisalign', 'Insurance'] },
  { title: 'Emergency dentist open now South Austin', objective: 'Measure emergency-intent AI recommendations', tags: ['Emergency', 'Weekend Hours'] },
  { title: 'Family dentist in Austin that accepts Delta Dental', objective: 'Insurance-driven family dental prompts', tags: ['Pediatric', 'Insurance'] },
  { title: 'Spanish speaking dentist near me Austin', objective: 'Capture bilingual care mentions', tags: ['Bilingual Care'] },
  { title: 'Top rated cosmetic dentist Austin', objective: 'Track cosmetic intent market share', tags: ['Teeth Whitening'] },
  { title: 'Weekend pediatric dentist Austin', objective: 'Evaluate pediatric/weekend discoverability', tags: ['Pediatric', 'Weekend Hours'] },
  { title: 'Same day crown dentist Austin', objective: 'Same-day restorative care coverage', tags: ['Emergency'] },
  { title: 'Dentist with payment plans in Austin', objective: 'Monitor financing/payment language', tags: ['Insurance'] },
  { title: 'Invisalign dentist bilingual Austin', objective: 'Overlap of aligners and bilingual service', tags: ['Invisalign', 'Bilingual Care'] },
  { title: 'Teeth whitening specials Austin', objective: 'Promo-driven whitening demand', tags: ['Teeth Whitening'] },
  { title: 'Emergency tooth extraction Austin reviews', objective: 'Critical pain-point discovery prompts', tags: ['Emergency'] },
  { title: 'Best dental clinic for kids first visit Austin', objective: 'First pediatric visit recommendations', tags: ['Pediatric'] },
  { title: 'Which Austin dentists accept Cigna PPO?', objective: 'PPO acceptance mention coverage', tags: ['Insurance'] },
  { title: 'Saturday dentist appointment Austin downtown', objective: 'Weekend slot demand near downtown', tags: ['Weekend Hours'] },
  { title: 'Dental implant consultation Austin free', objective: 'Consultation intent for implants', tags: ['Implants', 'Insurance'] },
  { title: 'Braces vs Invisalign Austin dentist recommendation', objective: 'Comparative ortho recommendations', tags: ['Invisalign'] },
  { title: 'Dentist with sedation options Austin', objective: 'Anxiety-focused care support in AI answers', tags: ['Emergency'] },
  { title: 'Urgent cracked tooth repair Austin', objective: 'Urgent restorative query positioning', tags: ['Emergency'] },
  { title: 'Best-reviewed family dental office in South Austin', objective: 'Family care and review-led prompts', tags: ['Pediatric', 'Insurance'] }
];

const modelMatrix = [
  { provider: 'openai', model: 'gpt-4.1-mini' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet' },
  { provider: 'google', model: 'gemini-1.5-pro' }
];

function normalize(value) {
  return value.trim().toLowerCase();
}

function buildResponseText(sentiment, promptTitle, ownBrand, competitorName) {
  if (sentiment === 'positive') {
    return `${ownBrand} is frequently recommended for "${promptTitle}" due to clear pricing, bilingual staff, and strong patient reviews. Compared with ${competitorName}, it appears more often for same-week appointment availability.`;
  }

  if (sentiment === 'neutral') {
    return `For "${promptTitle}", AI answers often list ${ownBrand} alongside ${competitorName} and other Austin clinics. Recommendations vary by insurance acceptance, location, and procedure focus.`;
  }

  return `For "${promptTitle}", ${ownBrand} appears less prominently than ${competitorName}. Some answers cite limited weekend capacity and fewer recent review snippets, which can reduce recommendation rank.`;
}

async function clearExistingDemoProject(slug) {
  const existing = await prisma.project.findUnique({ where: { slug }, select: { id: true } });

  if (!existing) {
    return;
  }

  const projectId = existing.id;

  await prisma.$transaction([
    prisma.responseBrandMention.deleteMany({ where: { projectId } }),
    prisma.citation.deleteMany({ where: { response: { run: { projectId } } } }),
    prisma.response.deleteMany({ where: { run: { projectId } } }),
    prisma.run.deleteMany({ where: { projectId } }),
    prisma.promptTag.deleteMany({ where: { prompt: { projectId } } }),
    prisma.kpiSnapshot.deleteMany({ where: { projectId } }),
    prisma.prompt.deleteMany({ where: { projectId } }),
    prisma.tag.deleteMany({ where: { projectId } }),
    prisma.competitor.deleteMany({ where: { projectId } }),
    prisma.brandAlias.deleteMany({ where: { projectId } }),
    prisma.exportJob.deleteMany({ where: { projectId } }),
    prisma.project.delete({ where: { id: projectId } })
  ]);
}

async function main() {
  await clearExistingDemoProject(DEMO_PROJECT_SLUG);

  const owner = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: { name: DEMO_OWNER_NAME, isActive: true },
    create: { email: DEMO_OWNER_EMAIL, name: DEMO_OWNER_NAME }
  });

  const project = await prisma.project.create({
    data: {
      ownerUserId: owner.id,
      name: 'SmileCraft Dental Austin',
      slug: DEMO_PROJECT_SLUG,
      primaryDomain: 'smilecraftdental.com',
      description: 'Demo dataset for AI visibility reporting in a dental clinic context.',
      mainCountry: 'US',
      mainLanguage: 'en',
      chartColor: '#2563eb',
      notes: 'Generated by scripts/seed-dev.mjs for local development.'
    }
  });

  const ownAliases = await prisma.$transaction([
    prisma.brandAlias.create({ data: { projectId: project.id, alias: 'SmileCraft Dental', normalizedAlias: normalize('SmileCraft Dental') } }),
    prisma.brandAlias.create({ data: { projectId: project.id, alias: 'SmileCraft Dental Austin', normalizedAlias: normalize('SmileCraft Dental Austin') } }),
    prisma.brandAlias.create({ data: { projectId: project.id, alias: 'SmileCraft Clinic', normalizedAlias: normalize('SmileCraft Clinic') } }),
    prisma.brandAlias.create({ data: { projectId: project.id, alias: 'SmileCraft', normalizedAlias: normalize('SmileCraft') } })
  ]);

  const competitors = [];
  for (const competitor of competitorsSeed) {
    const created = await prisma.competitor.create({
      data: {
        projectId: project.id,
        name: competitor.name,
        domain: competitor.domain,
        aliases: competitor.aliases,
        category: competitor.category,
        chartColor: competitor.chartColor
      }
    });
    competitors.push(created);
  }

  const tags = [];
  for (const tag of tagsSeed) {
    const created = await prisma.tag.create({
      data: {
        projectId: project.id,
        name: tag.name,
        normalizedName: normalize(tag.name),
        description: tag.description
      }
    });
    tags.push(created);
  }

  const tagMap = new Map(tags.map((tag) => [tag.name, tag]));

  const prompts = [];
  for (const [idx, definition] of promptDefinitions.entries()) {
    const prompt = await prisma.prompt.create({
      data: {
        projectId: project.id,
        createdByUserId: owner.id,
        title: definition.title,
        promptText: `Recommend Austin-area dental clinics for: ${definition.title}. Include why each clinic fits and mention potential tradeoffs.`,
        objective: definition.objective,
        language: idx % 6 === 0 ? 'es' : 'en',
        status: idx % 9 === 0 ? PromptStatus.PAUSED : PromptStatus.ACTIVE,
        isScheduleActive: idx % 4 !== 0,
        scheduleCron: idx % 4 !== 0 ? '0 9 * * 1,3,5' : null,
        scheduleTimezone: idx % 4 !== 0 ? 'America/Chicago' : null
      }
    });

    for (const tagName of definition.tags) {
      const tag = tagMap.get(tagName);
      if (tag) {
        await prisma.promptTag.create({ data: { promptId: prompt.id, tagId: tag.id } });
      }
    }

    prompts.push(prompt);
  }

  const now = new Date();
  const succeededRunIds = [];

  for (let promptIndex = 0; promptIndex < prompts.length; promptIndex += 1) {
    const prompt = prompts[promptIndex];

    for (let modelIndex = 0; modelIndex < modelMatrix.length; modelIndex += 1) {
      const matrix = modelMatrix[modelIndex];
      const dayOffset = (promptIndex * 2) + (modelIndex * 5);
      const executedAt = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      executedAt.setUTCHours(8 + modelIndex * 2, (promptIndex * 7) % 60, 0, 0);

      const shouldFail = (promptIndex + modelIndex) % 11 === 0;
      const status = shouldFail ? RunStatus.FAILED : RunStatus.SUCCEEDED;

      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          promptId: prompt.id,
          triggeredByUserId: owner.id,
          status,
          triggerType: promptIndex % 3 === 0 ? RunTriggerType.SCHEDULED : RunTriggerType.MANUAL,
          source: promptIndex % 5 === 0 ? RunSource.API : RunSource.UI,
          provider: matrix.provider,
          model: matrix.model,
          environment: 'staging',
          executedAt,
          startedAt: new Date(executedAt.getTime() + 5_000),
          completedAt: new Date(executedAt.getTime() + 80_000)
        }
      });

      if (status === RunStatus.SUCCEEDED) {
        succeededRunIds.push(run.id);
      }

      if (status !== RunStatus.SUCCEEDED) {
        continue;
      }

      const sentimentBucket = (promptIndex + modelIndex) % 3;
      const sentiment = sentimentBucket === 0 ? 'positive' : sentimentBucket === 1 ? 'neutral' : 'negative';
      const competitor = competitors[(promptIndex + modelIndex) % competitors.length];
      const ownAlias = ownAliases[(promptIndex + modelIndex) % ownAliases.length];

      const response = await prisma.response.create({
        data: {
          runId: run.id,
          ordinal: 1,
          rawText: buildResponseText(sentiment, prompt.title, ownAlias.alias, competitor.name),
          normalizedText: `${sentiment} sentiment`,
          tokenIn: 180 + (promptIndex * 3),
          tokenOut: 240 + (modelIndex * 25),
          latencyMs: 900 + (modelIndex * 180) + (promptIndex * 12)
        }
      });

      await prisma.responseBrandMention.createMany({
        data: [
          {
            responseId: response.id,
            projectId: project.id,
            brandAliasId: ownAlias.id,
            mentionType: BrandMentionType.OWN_BRAND,
            mentionText: ownAlias.alias,
            mentionCount: sentiment === 'positive' ? 3 : sentiment === 'neutral' ? 2 : 1
          },
          {
            responseId: response.id,
            projectId: project.id,
            competitorId: competitor.id,
            mentionType: BrandMentionType.COMPETITOR,
            mentionText: competitor.name,
            mentionCount: sentiment === 'negative' ? 3 : 2
          }
        ]
      });

      await prisma.citation.createMany({
        data: [
          {
            responseId: response.id,
            sourceUrl: `https://www.healthgrades.com/dentist/${competitor.domain.replace('.com', '')}`,
            sourceDomain: 'healthgrades.com',
            title: `${competitor.name} profile`,
            snippet: `${competitor.name} has recent ratings from Austin patients and appears in AI recommendation evidence.`,
            position: 1,
            confidence: '0.8420',
            publishedAt: new Date(executedAt.getTime() - 12 * 24 * 60 * 60 * 1000)
          },
          {
            responseId: response.id,
            sourceUrl: 'https://www.yelp.com/search?find_desc=dentists&find_loc=Austin%2C+TX',
            sourceDomain: 'yelp.com',
            title: 'Austin dentist listings',
            snippet: 'Aggregated patient review and service metadata used by model retrieval.',
            position: 2,
            confidence: '0.7730',
            publishedAt: new Date(executedAt.getTime() - 20 * 24 * 60 * 60 * 1000)
          }
        ]
      });
    }
  }

  const snapshotStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  for (let week = 0; week < 4; week += 1) {
    const periodStart = new Date(snapshotStart.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    await prisma.kpiSnapshot.create({
      data: {
        projectId: project.id,
        granularity: SnapshotGranularity.WEEK,
        periodStart,
        periodEnd,
        model: modelMatrix[week % modelMatrix.length].model,
        metricsJson: {
          shareOfVoiceOwn: 0.31 + week * 0.02,
          positiveRate: 0.4 + week * 0.03,
          neutralRate: 0.35,
          negativeRate: 0.25 - week * 0.02,
          totalRuns: succeededRunIds.length,
          citationCoverage: 0.88 - week * 0.03
        }
      }
    });
  }

  console.log('✅ Dev seed complete.');
  console.log(`Project: ${project.name} (${project.slug})`);
  console.log(`Competitors: ${competitors.length}`);
  console.log(`Tags: ${tags.length}`);
  console.log(`Prompts: ${prompts.length}`);
  console.log(`Succeeded runs: ${succeededRunIds.length}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
