import { useMemo } from 'react';
import {
  sharedToolsCatalog,
  ToolCatalogArea,
  ToolCatalogPriority,
  ToolCatalogStatus,
} from '@/config/toolsCatalog';

export interface ToolsCatalogSignals {
  total: number;
  byPriority: Record<ToolCatalogPriority, number>;
  byStatus: Record<ToolCatalogStatus, number>;
  byArea: Partial<Record<ToolCatalogArea, number>>;
  candidateOrPlanned: number;
  readyForDryRun: number;
  requiresHumanReview: number;
  readOnlySafe: number;
  queueEligible: number;
  p1ReadOnlySafe: number;
  queueWithoutDryRun: number;
  hasCatalog: boolean;
}

export const useToolsCatalogSignals = (): ToolsCatalogSignals =>
  useMemo(() => {
    const initialByPriority: Record<ToolCatalogPriority, number> = { P1: 0, P2: 0, P3: 0 };
    const initialByStatus: Record<ToolCatalogStatus, number> = {
      legacy: 0,
      migrated: 0,
      beta: 0,
      candidate: 0,
      planned: 0,
      unavailable: 0,
    };

    return sharedToolsCatalog.reduce<ToolsCatalogSignals>(
      (acc, tool) => {
        acc.total += 1;
        acc.byPriority[tool.priority] += 1;
        acc.byStatus[tool.status] += 1;
        acc.byArea[tool.area] = (acc.byArea[tool.area] || 0) + 1;
        if (tool.status === 'candidate' || tool.status === 'planned') acc.candidateOrPlanned += 1;
        if (tool.supportsDryRun) acc.readyForDryRun += 1;
        if (tool.requiresHumanReview) acc.requiresHumanReview += 1;
        if (tool.isReadOnlySafe) acc.readOnlySafe += 1;
        if (tool.canRunInQueue) acc.queueEligible += 1;
        if (tool.priority === 'P1' && tool.isReadOnlySafe) acc.p1ReadOnlySafe += 1;
        if (tool.canRunInQueue && !tool.supportsDryRun) acc.queueWithoutDryRun += 1;
        acc.hasCatalog = true;
        return acc;
      },
      {
        total: 0,
        byPriority: initialByPriority,
        byStatus: initialByStatus,
        byArea: {},
        candidateOrPlanned: 0,
        readyForDryRun: 0,
        requiresHumanReview: 0,
        readOnlySafe: 0,
        queueEligible: 0,
        p1ReadOnlySafe: 0,
        queueWithoutDryRun: 0,
        hasCatalog: sharedToolsCatalog.length > 0,
      },
    );
  }, []);
