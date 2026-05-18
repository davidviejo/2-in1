import { BarChart3, CircleDashed, ListTodo, PencilRuler, Target, TrendingUp, Workflow, Wrench } from 'lucide-react';
import type { Module, Phase, Resource } from '@/types/metodologia';

const modules: Module[] = [
  { id: 'M1', title: 'Auditoría inicial', description: 'Análisis del estado actual del sitio y detección de oportunidades.', status: 'Completado', docs: 6, links: 3 },
  { id: 'M2', title: 'Estrategia y verticales', description: 'Definición de verticales, segmentos y priorización de acciones.', status: 'En progreso', docs: 5, links: 2 },
  { id: 'M3', title: 'SEO editorial', description: 'Plan editorial, clusters y optimización de contenido.', status: 'En progreso', docs: 4, links: 2 },
  { id: 'M4', title: 'Técnico avanzado', description: 'Rendimiento, indexabilidad, datos estructurados y arquitectura.', status: 'Pendiente', docs: 3, links: 1 },
  { id: 'M5', title: 'Autoridad y E-E-A-T', description: 'Señales de autoridad, reputación y experiencia demostrada.', status: 'Pendiente', docs: 3, links: 2 },
  { id: 'M6', title: 'Distribución y enlaces', description: 'Link building, PR digital y estrategias de distribución.', status: 'Pendiente', docs: 3, links: 2 },
  { id: 'M7', title: 'Medición y reporting', description: 'Consolidación de KPIs, tableros y seguimiento de evolución.', status: 'Pendiente', docs: 2, links: 1 },
  { id: 'M8', title: 'Escalado y optimización', description: 'Iteración continua y mejora de procesos para escalar resultados.', status: 'Pendiente', docs: 2, links: 1 },
];

const phases: Phase[] = [
  { id: 'P1', title: 'Descubrimiento', description: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', objective: 'Entender el negocio, objetivos y contexto del proyecto.', keyActions: ['Kickoff', 'Entrevistas', 'Inventario de activos', 'Benchmark'], deliverables: ['Brief inicial', 'Mapa de stakeholders'], owner: 'Estratega SEO', status: 'Completado', icon: Target },
  { id: 'P2', title: 'Auditoría inicial', description: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', objective: 'Detectar oportunidades y problemas actuales.', keyActions: ['Crawl', 'Logs', 'CWV', 'Contenidos', 'Arquitectura'], deliverables: ['Informe de auditoría', 'Checklist técnico'], owner: 'Analista Técnico', status: 'En progreso', icon: CircleDashed },
  { id: 'P3', title: 'Priorización', description: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', objective: 'Focalizar en lo que genera más impacto.', keyActions: ['Impacto', 'Esfuerzo', 'Dependencias', 'Matriz ICE'], deliverables: ['Matriz ICE', 'Backlog priorizado'], owner: 'Estratega SEO', status: 'En progreso', icon: TrendingUp },
  { id: 'P4', title: 'Plan de acción', description: 'Definimos roadmap, responsables, timings y entregables.', objective: 'Convertir prioridades en un plan ejecutable.', keyActions: ['Roadmap', 'Recursos', 'Timings', 'Entregables'], deliverables: ['Roadmap trimestral', 'Plan de acción'], owner: 'Project Manager', status: 'Pendiente', icon: PencilRuler },
  { id: 'P5', title: 'Implementación', description: 'Ejecución de cambios técnicos, editoriales y de enlazado interno.', objective: 'Ejecutar cambios y mejoras planificadas.', keyActions: ['Técnicos', 'Contenidos', 'Enlazado interno'], deliverables: ['Cambios implementados', 'Registro de tareas'], owner: 'Desarrollador', status: 'Pendiente', icon: Wrench },
  { id: 'P6', title: 'Validación', description: 'Comprobación de resultados, QA y seguimiento de KPIs.', objective: 'Verificar resultados y asegurar calidad.', keyActions: ['QA', 'Tests', 'KPIs', 'Monitorización'], deliverables: ['Informe de validación', 'Dashboard temporal'], owner: 'Analista SEO', status: 'Pendiente', icon: ListTodo },
  { id: 'P7', title: 'Mejora continua', description: 'Iteración, aprendizaje y optimización recurrente.', objective: 'Aprender y optimizar de forma recurrente.', keyActions: ['Análisis', 'Iteración', 'Heurísticas', 'Experimentación'], deliverables: ['Lecciones aprendidas', 'Backlog iterativo'], owner: 'Estratega SEO', status: 'Pendiente', icon: BarChart3 },
];

const resources: Resource[] = [
  { id: 'R1', title: 'Guía de Metodología SEO - v2.1', meta: 'Google Docs · Actualizado hace 5 días', source: 'Google Docs', moduleId: 'M1', description: 'Manual completo de la metodología y estándares del proyecto.', lastUpdate: '12 mayo 2026 · Laura P.', type: 'doc', tags: ['documentacion'] },
  { id: 'R2', title: 'Brief inicial del proyecto', meta: 'Documento · v1.2', source: 'Google Docs', moduleId: 'M3', description: 'Plantilla para la creación de briefs editoriales.', lastUpdate: '07 mayo 2026 · Carlos T.', type: 'doc', tags: ['plantillas', 'documentacion'] },
  { id: 'R3', title: 'Checklist de auditoría', meta: 'Hoja de cálculo · v1.1', source: 'Google Sheets', moduleId: 'M4', description: 'Lista de verificación técnica para auditorías avanzadas.', lastUpdate: '03 mayo 2026 · Diego F.', type: 'sheet', tags: ['plantillas'] },
  { id: 'R4', title: 'Roadmap trimestral', meta: 'Documento · v1.0', source: 'Google Docs', moduleId: 'M2', description: 'Plan de acción con hitos trimestrales por vertical.', lastUpdate: '10 mayo 2026 · Ana R.', type: 'doc', tags: ['documentacion'] },
  { id: 'R5', title: 'Plan de enlazado interno', meta: 'Documento · v1.0', source: 'Google Sheets', moduleId: 'M5', description: 'Estrategia de anchor text y asignación de enlaces.', lastUpdate: '11 mayo 2026 · Marta L.', type: 'sheet', tags: ['enlazado'] },
  { id: 'R6', title: 'Dashboard de seguimiento', meta: 'Hoja de cálculo · v1.3', source: 'Looker Studio', moduleId: 'M7', description: 'Panel de KPIs y evolución de desempeño.', lastUpdate: '14 mayo 2026 · Paula G.', type: 'chart', tags: ['kpis', 'urls-clave'] },
  { id: 'R7', title: 'Sitemap Maestro & Taxonomía', meta: 'Notion · Actualizado hace 9 días', source: 'Notion', moduleId: 'M2', description: 'Estructura de sitemap y taxonomía por verticales.', lastUpdate: '09 mayo 2026 · Ana R.', type: 'notion', tags: ['urls-clave'] },
];

export const metodologiaService = {
  getModules: async (): Promise<Module[]> => modules,
  getPhases: async (): Promise<Phase[]> => phases,
  getResources: async (): Promise<Resource[]> => resources,
};
