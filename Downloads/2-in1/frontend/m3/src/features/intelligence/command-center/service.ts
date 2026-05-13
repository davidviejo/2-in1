import { Client, ModuleData, Task } from '@/types';
import { DataSourceStatus, CommandCenterPriority, Level } from './types';

const mapLevel = (value: number, bounds: [number, number]): Level => (value >= bounds[1] ? 'high' : value >= bounds[0] ? 'medium' : 'low');
const toScore = (impact: Level, confidence: number, effort: Level, urgency: Level, businessValue = 60) => {
  const map = { low: 30, medium: 60, high: 90 };
  const easeMap = { low: 90, medium: 60, high: 30 };
  const raw = map[impact] * 0.3 + confidence * 0.2 + easeMap[effort] * 0.2 + businessValue * 0.2 + map[urgency] * 0.1;
  return Math.max(0, Math.min(100, Math.round(raw)));
};

export const generatePrioritiesFromClient = (client: Client | null, modules: ModuleData[]): { priorities: CommandCenterPriority[]; sourceStatus: DataSourceStatus[] } => {
  if (!client) return { priorities: [], sourceStatus: [{ source: 'project', status: 'missing', message: 'Sin proyecto activo.' }] };

  const now = new Date().toISOString();
  const priorities: CommandCenterPriority[] = [];
  const roadmapTasks = modules.flatMap((m) => m.tasks.map((t) => ({ ...t, moduleId: m.id })));
  const blocked = roadmapTasks.filter((t) => ['blocked', 'client-feedback'].includes((t.status || '').toLowerCase()));

  blocked.forEach((task) => {
    const impact: Level = task.impact === 'High' ? 'high' : task.impact === 'Medium' ? 'medium' : 'low';
    const confidence = 72;
    const effort: Level = 'medium';
    const urgency: Level = 'high';
    priorities.push({
      id: `blk-${task.id}`,
      projectId: client.id,
      title: `Desbloquear: ${task.title}`,
      type: 'Tarea bloqueada',
      sourceModule: 'kanban',
      targetType: 'task',
      target: task.title,
      moduleId: (task as any).moduleId,
      score: toScore(impact, confidence, effort, urgency),
      impact,
      confidence,
      effort,
      urgency,
      reason: `La tarea está en estado ${task.status}.`,
      recommendation: 'Resolver dependencia y mover a in-progress.',
      status: 'new',
      createdAt: now,
      dataMode: 'real',
    });
  });

  (client.completedTasksLog || []).slice(0, 3).forEach((entry) => {
    priorities.push({
      id: `cmp-${entry.id}`,
      projectId: client.id,
      title: `Medir impacto: ${entry.title}`,
      type: 'Medición pendiente',
      sourceModule: 'completed-tasks',
      targetType: 'task',
      target: entry.title,
      score: toScore('medium', 70, 'low', 'medium'),
      impact: 'medium', confidence: 70, effort: 'low', urgency: 'medium',
      reason: 'Acción completada sin aprendizaje consolidado reciente.',
      recommendation: 'Abrir Completed Tasks y documentar before/after.',
      status: 'new', createdAt: now, dataMode: 'real',
    });
  });

  if (priorities.length === 0) {
    priorities.push({
      id: 'mock-1', projectId: client.id, title: 'Conectar fuente GSC para priorización automática', type: 'Configuración', sourceModule: 'settings', targetType: 'project', target: client.name,
      score: toScore('high', 55, 'low', 'high'), impact: 'high', confidence: 55, effort: 'low', urgency: 'high', reason: 'No se detectaron señales operativas suficientes.', recommendation: 'Configurar GSC y ejecutar checklist.', status: 'new', createdAt: now, dataMode: 'mock'
    });
  }

  const sourceStatus: DataSourceStatus[] = [
    { source: 'kanban', status: blocked.length ? 'connected' : 'partial', message: blocked.length ? `${blocked.length} bloqueadas.` : 'Sin bloqueos detectados.' },
    { source: 'completed-tasks', status: (client.completedTasksLog || []).length ? 'connected' : 'missing', message: (client.completedTasksLog || []).length ? 'Histórico disponible.' : 'Sin histórico.' },
    { source: 'gsc', status: 'partial', message: 'Integración disponible en módulos GSC; usar recalcular para enriquecer.' },
  ];

  return { priorities, sourceStatus };
};

export const calculateSeoHealthSummary = (priorities: CommandCenterPriority[]) => {
  const criticalIssues = priorities.filter((p) => p.impact === 'high' && p.urgency === 'high').length;
  const quickWins = priorities.filter((p) => p.impact === 'high' && p.effort === 'low').length;
  const blockedTasks = priorities.filter((p) => p.type === 'Tarea bloqueada').length;
  const healthScore = Math.max(0, Math.min(100, 82 - criticalIssues * 8 - blockedTasks * 5 + quickWins * 3));
  return { healthScore, criticalIssues, quickWins, blockedTasks };
};
