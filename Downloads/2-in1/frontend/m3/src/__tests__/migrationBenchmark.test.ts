import { describe, it } from 'vitest';
import { ClientRepository } from '../services/clientRepository';
import { Client } from '../types';

describe('Migration Benchmark', () => {
  it('measures migrateModules performance', () => {
    const clients: Client[] = [];
    const verticals: ('media' | 'ecom' | 'local' | 'national' | 'international')[] = [
      'media',
      'ecom',
      'local',
      'national',
      'international',
    ];

    // Create 2000 clients to make the performance difference measurable
    for (let i = 0; i < 2000; i++) {
      clients.push({
        id: `client-${i}`,
        name: `Client ${i}`,
        vertical: verticals[i % verticals.length],
        modules: [], // Trigger migration for all modules
        createdAt: Date.now(),
        notes: [],
        completedTasksLog: [],
        customRoadmapOrder: [],
      });
    }

    const start = performance.now();
    // @ts-expect-error - migrateModules is private
    ClientRepository.migrateModules(clients);
    const end = performance.now();
    console.log(`\n\n>>> Migration took ${end - start}ms for 2000 clients\n\n`);
  });
});
