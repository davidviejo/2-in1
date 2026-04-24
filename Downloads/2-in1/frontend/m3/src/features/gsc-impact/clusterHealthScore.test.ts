import { describe, expect, it } from 'vitest';
import { buildClusterHealthScores } from '@/features/gsc-impact/clusterHealthScore';

describe('buildClusterHealthScores', () => {
  it('prioriza peor salud para secciones con caídas claras', () => {
    const rows = [
      {
        key: 'https://example.com/blog/post-1',
        label: 'blog/post-1',
        preClicks: 400,
        rolloutClicks: 220,
        postClicks: 180,
        preImpressions: 4000,
        rolloutImpressions: 4200,
        postImpressions: 4500,
        prePosition: 7,
        rolloutPosition: 9,
        postPosition: 10.5,
      },
      {
        key: 'https://example.com/blog/post-2',
        label: 'blog/post-2',
        preClicks: 300,
        rolloutClicks: 200,
        postClicks: 170,
        preImpressions: 3000,
        rolloutImpressions: 3400,
        postImpressions: 3600,
        prePosition: 6.5,
        rolloutPosition: 8,
        postPosition: 9.8,
      },
      {
        key: 'https://example.com/categoria/fichas-1',
        label: 'categoria/fichas-1',
        preClicks: 120,
        rolloutClicks: 132,
        postClicks: 145,
        preImpressions: 1800,
        rolloutImpressions: 1900,
        postImpressions: 2100,
        prePosition: 8.2,
        rolloutPosition: 7.8,
        postPosition: 7.1,
      },
    ];

    const scores = buildClusterHealthScores(rows, { pre: 14, rollout: 14, post: 14 });
    const blog = scores.find((row) => row.cluster === '/blog/');
    const category = scores.find((row) => row.cluster === '/categoria/');

    expect(blog).toBeDefined();
    expect(category).toBeDefined();
    expect(blog!.healthScore).toBeLessThan(category!.healthScore);
    expect(blog!.dropRiskScore).toBeLessThan(category!.dropRiskScore);
  });

  it('agrupa urls raíz en el clúster /', () => {
    const scores = buildClusterHealthScores(
      [
        {
          key: 'https://example.com/',
          label: 'home',
          preClicks: 100,
          rolloutClicks: 100,
          postClicks: 100,
          preImpressions: 1000,
          rolloutImpressions: 1000,
          postImpressions: 1000,
          prePosition: 4,
          rolloutPosition: 4,
          postPosition: 4,
        },
      ],
      { pre: 7, rollout: 7, post: 7 },
    );

    expect(scores[0].cluster).toBe('/');
  });
});
