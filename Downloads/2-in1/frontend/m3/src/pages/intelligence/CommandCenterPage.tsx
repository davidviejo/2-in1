import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useProject } from '@/context/ProjectContext';
import { useToast } from '@/components/ui/ToastContext';
import { calculateSeoHealthSummary, generatePrioritiesFromClient } from '@/features/intelligence/command-center/service';
import { CommandCenterPriority } from '@/features/intelligence/command-center/types';

const STATUS_KEY = 'mediaflow_command_center_status_v1';

const DETAIL_ROUTES: Record<string, string> = {
  kanban: '/app/kanban',
  'completed-tasks': '/app/completed-tasks',
  gsc: '/app/gsc-impact?view=individual',
  checklist: '/app/checklist',
  roadmap: '/app/client-roadmap',
  'ai-roadmap': '/app/ai-roadmap',
  trends: '/app/trends-media',
  tools: '/app/tools-hub',
  settings: '/app/settings',
};

export default function CommandCenterPage() {
  const { currentClient, currentClientId, modules, addTask, toggleCustomRoadmapTask, clients, switchClient } = useProject();
  const { success, info } = useToast();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'7' | '28' | '90'>('28');
  const [tick, setTick] = useState(0);
  const persisted = JSON.parse(localStorage.getItem(STATUS_KEY) || '{}') as Record<string, CommandCenterPriority['status']>;

  const data = useMemo(() => generatePrioritiesFromClient(currentClient, modules), [currentClient, modules, tick, period]);
  const priorities = data.priorities.map((p) => ({ ...p, status: persisted[p.id] || p.status }));
  const health = calculateSeoHealthSummary(priorities);

  const updateStatus = (id: string, status: CommandCenterPriority['status']) => {
    const next = { ...persisted, [id]: status };
    localStorage.setItem(STATUS_KEY, JSON.stringify(next));
    setTick((v) => v + 1);
  };

  const createTaskFromPriority = (p: CommandCenterPriority) => {
    const targetModule = p.moduleId || modules.find((m) => m.isCustom)?.id || modules[0]?.id;
    if (!targetModule) return;
    addTask(targetModule, p.title, `${p.recommendation}\n\nMotivo: ${p.reason}`, p.impact === 'high' ? 'High' : p.impact === 'medium' ? 'Medium' : 'Low', 'Command Center', { status: 'pending', isInCustomRoadmap: true });
    updateStatus(p.id, 'sent_to_task');
    success('Tarea creada y enviada al Kanban.');
  };

  return (
    <div className='space-y-4 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div><h1 className='section-title'>Command Center</h1><p className='section-subtitle'>Prioridades SEO detectadas para hoy según impacto, urgencia y confianza.</p></div>
        <div className='flex gap-2 items-center'>
          <select className='input' value={currentClientId} onChange={(e) => switchClient(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className='input' value={period} onChange={(e) => setPeriod(e.target.value as any)}><option value='7'>7 días</option><option value='28'>28 días</option><option value='90'>90 días</option></select>
          <Button onClick={() => setTick((v) => v + 1)}>Recalcular prioridades</Button>
          <Button variant='secondary' onClick={() => navigate('/app/kanban')}>Crear tarea manual</Button>
        </div>
      </div>

      <div className='card p-4 grid grid-cols-2 md:grid-cols-4 gap-3'>
        <div>Health Score <div className='text-2xl font-bold'>{health.healthScore}</div></div>
        <div>Issues críticos <div className='text-2xl font-bold'>{health.criticalIssues}</div></div>
        <div>Quick wins <div className='text-2xl font-bold'>{health.quickWins}</div></div>
        <div>Bloqueadas <div className='text-2xl font-bold'>{health.blockedTasks}</div></div>
      </div>

      <div className='card p-4'><h2 className='font-semibold mb-3'>Estado de fuentes</h2><div className='flex flex-wrap gap-2'>{data.sourceStatus.map((s) => <Badge key={s.source}>{s.source}: {s.status}</Badge>)}</div></div>

      <div className='space-y-3'>
        {priorities.filter((p) => p.status !== 'dismissed').map((p) => (
          <div key={p.id} className='card p-4 space-y-2'>
            <div className='flex justify-between gap-2'><h3 className='font-semibold'>{p.title}</h3><Badge>Score {p.score}</Badge></div>
            <p className='text-sm text-muted'>{p.type} · {p.target} · {p.sourceModule} · {p.dataMode}</p>
            <p className='text-sm'><strong>Motivo:</strong> {p.reason}</p>
            <p className='text-sm'><strong>Recomendación:</strong> {p.recommendation}</p>
            <div className='flex flex-wrap gap-2'>
              <Button variant='secondary' onClick={() => navigate(DETAIL_ROUTES[p.sourceModule] || '/app/tools-hub')}>Ver detalle</Button>
              <Button onClick={() => createTaskFromPriority(p)}>Crear tarea</Button>
              <Button variant='secondary' onClick={() => { createTaskFromPriority(p); toggleCustomRoadmapTask(p.moduleId || modules[0]?.id || 1, modules[0]?.tasks[0]?.id || ''); updateStatus(p.id, 'sent_to_roadmap'); info('Enviado a roadmap (vía tarea marcada).'); }}>Enviar a roadmap</Button>
              <Button variant='secondary' onClick={() => { updateStatus(p.id, 'brief_generated'); success('Brief generado con adapter local (TODO IA).'); }}>Generar brief</Button>
              <Button variant='ghost' onClick={() => updateStatus(p.id, 'reviewed')}>Marcar revisado</Button>
              <Button variant='ghost' onClick={() => updateStatus(p.id, 'dismissed')}>Descartar</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
