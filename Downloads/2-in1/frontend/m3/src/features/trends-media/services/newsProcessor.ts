import { NewsArticle, NewsCluster, ScoreBreakdown } from '../types';

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(16);
};

const normalizeUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach((param) =>
      parsedUrl.searchParams.delete(param),
    );
    return parsedUrl.hostname.replace('www.', '') + parsedUrl.pathname;
  } catch {
    return url;
  }
};

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseRelativeDate = (dateStr: string): Date => {
  const now = new Date();
  if (!dateStr) return now;

  const str = dateStr.toLowerCase();
  if (str.includes('hace') || str.includes('ago')) {
    const value = parseInt(str.match(/\d+/)?.[0] || '0', 10);
    if (str.includes('min')) return new Date(now.getTime() - value * 60000);
    if (str.includes('hora') || str.includes('hour') || /\b\d+h\b/.test(str)) {
      return new Date(now.getTime() - value * 3600000);
    }
    if (str.includes('día') || str.includes('day') || /\b\d+d\b/.test(str)) {
      return new Date(now.getTime() - value * 86400000);
    }
  }

  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
};

const calculateScore = (cluster: NewsCluster): void => {
  const breakdown: ScoreBreakdown = {
    recency: 0,
    coverage: 0,
    authority: 10,
    visual: 0,
    position: 0,
    total: 0,
  };

  const latestDate = parseRelativeDate(cluster.latest_published_at);
  const hoursOld = (Date.now() - latestDate.getTime()) / 3600000;
  breakdown.recency = Math.max(0, Math.round(40 - hoursOld * 0.83));

  const count = cluster.coverage_count;
  if (count >= 5) breakdown.coverage = 25;
  else if (count >= 3) breakdown.coverage = 12 + (count - 3) * 4;
  else if (count === 2) breakdown.coverage = 8;

  breakdown.visual = cluster.articles.some((article) => !!article.thumbnail_url) ? 10 : 0;

  const averagePosition = cluster.articles.reduce((sum, article) => sum + article.position, 0) / count;
  if (averagePosition <= 1) breakdown.position = 5;
  else if (averagePosition <= 3) breakdown.position = 3;
  else if (averagePosition <= 10) breakdown.position = 1;

  breakdown.total =
    breakdown.recency +
    breakdown.coverage +
    breakdown.authority +
    breakdown.visual +
    breakdown.position;

  cluster.score = breakdown.total;
  cluster.score_breakdown = breakdown;
};

export const processNews = (rawArticles: NewsArticle[]): NewsCluster[] => {
  const clusters = new Map<string, NewsCluster>();
  const seenUrls = new Set<string>();
  const uniqueArticles: NewsArticle[] = [];

  rawArticles.forEach((article) => {
    article.article_id = simpleHash(normalizeUrl(article.url));
    if (!seenUrls.has(article.article_id)) {
      seenUrls.add(article.article_id);
      uniqueArticles.push(article);
    }
  });

  uniqueArticles.forEach((article) => {
    let foundCluster = false;
    const titleKey = normalizeTitle(article.title).substring(0, 30);

    for (const cluster of clusters.values()) {
      const clusterTitleNorm = normalizeTitle(cluster.title);
      const articleTitleNorm = normalizeTitle(article.title);
      if (
        clusterTitleNorm.includes(titleKey) ||
        articleTitleNorm.includes(normalizeTitle(cluster.title).substring(0, 30))
      ) {
        cluster.articles.push(article);
        cluster.coverage_count += 1;

        if (parseRelativeDate(article.published_at) > parseRelativeDate(cluster.latest_published_at)) {
          cluster.latest_published_at = article.published_at;
        }

        const currentTop = cluster.articles.find((entry) => entry.source_name === cluster.top_source);
        const currentPos = currentTop ? currentTop.position : Number.POSITIVE_INFINITY;
        if (article.position < currentPos) {
          cluster.top_source = article.source_name;
        }

        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      const clusterId = simpleHash(article.title + article.keyword);
      clusters.set(clusterId, {
        cluster_id: clusterId,
        title: article.title,
        articles: [article],
        coverage_count: 1,
        latest_published_at: article.published_at,
        top_source: article.source_name,
        score: 0,
        score_breakdown: {
          recency: 0,
          coverage: 0,
          authority: 0,
          visual: 0,
          position: 0,
          total: 0,
        },
      });
    }
  });

  const processedClusters = Array.from(clusters.values());
  processedClusters.forEach(calculateScore);
  return processedClusters.sort((a, b) => b.score - a.score);
};
