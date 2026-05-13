import { Client, ModuleData } from '@/types';

export type DataMode = 'real' | 'partial' | 'mock';
export type SuggestionStatus = 'new' | 'reviewed' | 'approved' | 'rejected' | 'dismissed' | 'opportunity_created' | 'sent_to_task' | 'sent_to_roadmap' | 'in_progress' | 'implemented' | 'measuring_impact';
export type SuggestionType =
  | 'orphan_url' | 'low_internal_links' | 'deep_page' | 'internal_broken_link' | 'anchor_opportunity' | 'anchor_conflict' | 'cluster_hub_link' | 'money_page_boost' | 'traffic_to_money_page' | 'content_gap_support' | 'cannibalization_anchor_fix' | 'new_content_linking' | 'outdated_anchor' | 'excessive_outbound_internal_links' | 'nofollow_internal_link' | 'redirecting_internal_link';

export interface InternalLinkSuggestion { id: string; projectId: string; type: SuggestionType; title: string; sourceUrl: string; targetUrl: string; suggestedAnchor: string; cluster?: string; severity: 'critical' | 'high' | 'medium' | 'low'; score: number; impact: 'low'|'medium'|'high'; effort: 'low'|'medium'|'high'; urgency: 'low'|'medium'|'high'; confidence: number; reason: string; recommendation: string; evidence: string[]; status: SuggestionStatus; sourceModule: string; dataMode: DataMode; detectedAt: string; updatedAt: string; }

const key = (projectId: string) => `agenciaseo:internal-linking:suggestions:${projectId}`;

export const loadSuggestions = (projectId: string): InternalLinkSuggestion[] => {
  try { return JSON.parse(localStorage.getItem(key(projectId)) || '[]'); } catch { return []; }
};
export const saveSuggestions = (projectId: string, suggestions: InternalLinkSuggestion[]) => localStorage.setItem(key(projectId), JSON.stringify(suggestions));

const calcScore = (s: Pick<InternalLinkSuggestion,'type'|'effort'|'impact'|'urgency'|'confidence'>) => {
  const targetValue = s.type === 'money_page_boost' ? 90 : s.type === 'orphan_url' ? 90 : s.type === 'cluster_hub_link' ? 80 : 60;
  const relevance = s.type === 'cluster_hub_link' || s.type === 'money_page_boost' ? 85 : 70;
  const authority = s.impact === 'high' ? 85 : s.impact === 'medium' ? 70 : 55;
  const ease = s.effort === 'low' ? 90 : s.effort === 'medium' ? 60 : 35;
  const urgency = s.urgency === 'high' ? 85 : s.urgency === 'medium' ? 65 : 45;
  const score = targetValue*0.25 + relevance*0.25 + authority*0.2 + ease*0.15 + s.confidence*0.1 + urgency*0.05;
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const detectSuggestions = (client: Client | null, modules: ModuleData[]): InternalLinkSuggestion[] => {
  if (!client) return [];
  const now = new Date().toISOString();
  const clusters = client.seoClusters || [];
  const fromClusters = clusters.flatMap((cluster) => {
    const urls = cluster.urls || [];
    const hub = urls[0] || '';
    return urls.slice(1).map((url, idx): InternalLinkSuggestion => {
      const base = { id: `${cluster.id}-${idx}`, projectId: client.id, sourceUrl: url, targetUrl: hub || url, suggestedAnchor: cluster.name, cluster: cluster.name, evidence: [`Cluster ${cluster.name} con ${urls.length} URLs.`], sourceModule: 'clustering', detectedAt: now, updatedAt: now };
      const effort: 'low' = 'low'; const impact: 'high' = 'high'; const urgency: 'medium' = 'medium'; const confidence = 80;
      return { ...base, type: 'cluster_hub_link', title: `Enlazar ${url} hacia hub de ${cluster.name}`, severity: 'high', impact, effort, urgency, confidence, reason: 'Página hija sin refuerzo explícito al hub.', recommendation: 'Añadir enlace contextual al hub dentro del primer tercio del contenido.', status: 'new', dataMode: 'real', score: calcScore({ type: 'cluster_hub_link', effort, impact, urgency, confidence }) };
    });
  });
  const blocked = modules.flatMap((m) => m.tasks).filter((t) => /404|broken|roto/i.test(`${t.title} ${t.description}`));
  const broken = blocked.map((t, idx): InternalLinkSuggestion => ({ id: `broken-${idx}-${t.id}`, projectId: client.id, type: 'internal_broken_link', title: `Corregir enlace roto detectado en tarea: ${t.title}`, sourceUrl: client.websiteDomain || '', targetUrl: '', suggestedAnchor: 'actualizar enlace', severity: 'critical', impact: 'high', effort: 'low', urgency: 'high', confidence: 72, reason: 'Existe señal en Kanban de enlace roto interno.', recommendation: 'Sustituir destino roto por URL válida y verificar rastreo.', evidence: [t.description || t.title], status: 'new', sourceModule: 'kanban', dataMode: 'partial', detectedAt: now, updatedAt: now, score: calcScore({ type: 'internal_broken_link', effort: 'low', impact: 'high', urgency: 'high', confidence: 72 }) }));
  const generated = [...fromClusters, ...broken];
  return generated.length ? generated : [{ id:'mock-1', projectId: client.id, type:'orphan_url', title:'Conectar fuentes para detección avanzada', sourceUrl:'', targetUrl:'', suggestedAnchor:'', severity:'medium', score:58, impact:'medium', effort:'low', urgency:'medium', confidence:50, reason:'No hay suficiente data real para detectar oportunidades robustas.', recommendation:'Importar crawl/checklist o añadir sugerencias manuales.', evidence:['Fallback local'], status:'new', sourceModule:'internal-linking', dataMode:'mock', detectedAt:now, updatedAt:now }];
};

export const typeLabel: Record<SuggestionType,string> = { orphan_url:'URL huérfana',low_internal_links:'Pocos enlaces internos',deep_page:'Página profunda',internal_broken_link:'Enlace interno roto',anchor_opportunity:'Oportunidad de anchor',anchor_conflict:'Conflicto de anchor',cluster_hub_link:'Enlace a hub de cluster',money_page_boost:'Refuerzo de página money',traffic_to_money_page:'Tráfico hacia página de negocio',content_gap_support:'Apoyo a content gap',cannibalization_anchor_fix:'Corrección de anchor por canibalización',new_content_linking:'Enlazado para contenido nuevo',outdated_anchor:'Anchor desactualizado',excessive_outbound_internal_links:'Exceso de enlaces internos salientes',nofollow_internal_link:'Enlace interno nofollow',redirecting_internal_link:'Enlace interno redirigido' };
