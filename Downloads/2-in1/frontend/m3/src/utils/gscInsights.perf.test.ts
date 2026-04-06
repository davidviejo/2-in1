import { describe, it } from 'vitest';
import { analyzeCannibalization } from './gscInsights';
import { GSCRow } from '../types';

describe('Performance Benchmark: analyzeCannibalization', () => {
  it('should process 50,000 rows efficiently', () => {
    const rows: GSCRow[] = [];
    const queries = Array.from({ length: 10000 }, (_, i) => `query_${i}`);

    // Generate 50,000 rows
    for (let i = 0; i < 50000; i++) {
      // Pick a random query from the 10,000 queries to ensure duplicates (cannibalization candidates)
      const query = queries[Math.floor(Math.random() * queries.length)];
      rows.push({
        keys: [query, `https://example.com/page_${i}`],
        clicks: Math.floor(Math.random() * 100),
        // 80% of rows have < 50 impressions (Long Tail), 20% have high volume
        impressions:
          Math.random() > 0.2
            ? Math.floor(Math.random() * 49)
            : Math.floor(Math.random() * 1000) + 50,
        ctr: Math.random() * 0.1,
        position: Math.floor(Math.random() * 20) + 1,
      });
    }

    const start = performance.now();
    const result = analyzeCannibalization(rows);
    const end = performance.now();

    console.log(`\n---------------------------------------------------`);
    console.log(`[Benchmark] analyzeCannibalization with 50,000 rows (Long Tail Scenario)`);
    console.log(`Execution Time: ${(end - start).toFixed(2)} ms`);
    console.log(`Result Count: ${result.count}`);
    console.log(`---------------------------------------------------\n`);
  });
});
