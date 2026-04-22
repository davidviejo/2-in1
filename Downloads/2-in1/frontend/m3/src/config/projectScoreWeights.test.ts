import { describe, expect, it } from 'vitest';
import { computeProjectScoreContext } from './projectScoreWeights';
import { ModuleData } from '@/types';

const module = (id: number, completed: number, total = 10): ModuleData => ({
  id,
  title: `M${id}`,
  subtitle: '',
  levelRange: '0-100',
  description: '',
  iconName: 'BarChart2',
  tasks: Array.from({ length: total }, (_, index) => ({
    id: `${id}-${index}`,
    title: `Task ${index}`,
    description: '',
    impact: 'Medium',
    status: index < completed ? 'completed' : 'pending',
  })),
});

describe('computeProjectScoreContext', () => {
  it('prioritizes local modules and changes weighted score by context', () => {
    const modules = [
      module(1, 5),
      module(2, 5),
      module(3, 5),
      module(4, 5),
      module(5, 10),
      module(6, 2),
      module(7, 8),
      module(8, 6),
      module(9, 4),
    ];

    const local = computeProjectScoreContext({
      modules,
      projectType: 'LOCAL',
      sector: 'Legal',
      geoScope: 'local',
    });

    const media = computeProjectScoreContext({
      modules,
      projectType: 'MEDIA',
      sector: 'Medios / Editorial',
      geoScope: 'global',
    });

    expect(local.score).not.toBe(media.score);
    expect(local.criticalModuleIds).toContain(5);
    expect(local.appliedWeights[0].weight).toBeGreaterThan(0);
  });
});
