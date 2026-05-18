import type { KPI, Module, Phase, Resource } from '@/types/metodologia';

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
  { id: 'P1', title: 'Descubrimiento', desc: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', deliverables: ['Brief inicial', 'Mapa de stakeholders'], status: 'Completado', objective: 'Entender el negocio, objetivos y contexto del proyecto.', actions: 'Kickoff · Entrevistas · Inventario de activos · Benchmark', owner: 'Estratega SEO' },
  { id: 'P2', title: 'Auditoría inicial', desc: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', deliverables: ['Informe de auditoría', 'Checklist técnico'], status: 'En progreso', objective: 'Detectar oportunidades y problemas actuales.', actions: 'Crawl · Logs · CWV · Contenidos · Arquitectura', owner: 'Analista Técnico' },
  { id: 'P3', title: 'Priorización', desc: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', deliverables: ['Matriz ICE', 'Backlog priorizado'], status: 'En progreso', objective: 'Focalizar en lo que genera más impacto.', actions: 'Impacto · Esfuerzo · Dependencias · Matriz ICE', owner: 'Estratega SEO' },
  { id: 'P4', title: 'Plan de acción', desc: 'Definimos roadmap, responsables, timings y entregables.', deliverables: ['Roadmap trimestral', 'Plan de acción'], status: 'Pendiente', objective: 'Convertir prioridades en un plan ejecutable.', actions: 'Roadmap · Recursos · Timings · Entregables', owner: 'Project Manager' },
  { id: 'P5', title: 'Implementación', desc: 'Ejecución de cambios técnicos, editoriales y de enlazado interno.', deliverables: ['Cambios implementados', 'Registro de tareas'], status: 'Pendiente', objective: 'Ejecutar cambios y mejoras planificadas.', actions: 'Técnicos · Contenidos · Enlazado interno', owner: 'Desarrollador' },
  { id: 'P6', title: 'Validación', desc: 'Comprobación de resultados, QA y seguimiento de KPIs.', deliverables: ['Informe de validación', 'Dashboard temporal'], status: 'Pendiente', objective: 'Verificar resultados y asegurar calidad.', actions: 'QA · Tests · KPIs · Monitorización', owner: 'Analista SEO' },
  { id: 'P7', title: 'Mejora continua', desc: 'Iteración, aprendizaje y optimización recurrente.', deliverables: ['Lecciones aprendidas', 'Backlog iterativo'], status: 'Pendiente', objective: 'Aprender y optimizar de forma recurrente.', actions: 'Análisis · Iteración · Heurísticas · Experimentación', owner: 'Estratega SEO' },
];

const resources: Resource[] = [
  { id: 'R1', source: 'Google Docs', title: 'Guía de Metodología SEO - v2.1', moduleId: 'M1', description: 'Manual completo de la metodología y estándares del proyecto.', updatedAt: '12 mayo 2026 · Laura P.', meta: 'Google Docs · Actualizado hace 5 días', type: 'doc' },
  { id: 'R2', source: 'Notion', title: 'Sitemap Maestro & Taxonomía', moduleId: 'M2', description: 'Estructura de sitemap y taxonomía por verticales.', updatedAt: '09 mayo 2026 · Ana R.', meta: 'Notion · Actualizado hace 8 días', type: 'notion' },
  { id: 'R3', source: 'Google Docs', title: 'Brief Editorial - Plantilla', moduleId: 'M3', description: 'Plantilla para la creación de briefs editoriales.', updatedAt: '07 mayo 2026 · Carlos T.', meta: 'Documento · v1.2', type: 'doc' },
  { id: 'R4', source: 'Google Sheets', title: 'Plan de Enlazado Interno', moduleId: 'M5', description: 'Estrategia de anchor text y asignación de enlaces.', updatedAt: '11 mayo 2026 · Marta L.', meta: 'Hoja de cálculo · v1.1', type: 'sheet' },
  { id: 'R5', source: 'PDF', title: 'Checklist Técnico Avanzado', moduleId: 'M4', description: 'Lista de verificación técnica para auditorías avanzadas.', updatedAt: '03 mayo 2026 · Diego F.', meta: 'PDF · v2.0', type: 'pdf' },
  { id: 'R6', source: 'Google Docs', title: 'Plan de Link Building 2026', moduleId: 'M6', description: 'Estrategias, partners y tácticas de link building.', updatedAt: '14 mayo 2026 · Paula G.', meta: 'Google Docs · v1.0', type: 'doc' },
  { id: 'R7', source: 'Google Sheets', title: 'Dashboard de seguimiento', moduleId: 'M7', description: 'Panel de KPIs y evolución por módulo.', updatedAt: '15 mayo 2026 · Laura P.', meta: 'Hoja de cálculo · v1.3', type: 'chart' },
];

export const metodologiaService = {
  getModules: async () => modules,
  getPhases: async () => phases,
  getResources: async () => resources,
  getKpis: async (): Promise<KPI[]> => [
    { id: 'modules', label: 'módulos', value: modules.length, subtitle: 'Estructura definida', icon: 'layers' },
    { id: 'phases', label: 'fases', value: phases.length, subtitle: 'De principio a fin', icon: 'workflow' },
    { id: 'resources', label: 'recursos', value: resources.length, subtitle: 'Documentación y guías', icon: 'bookOpen' },
    { id: 'links', label: 'enlaces internos', value: modules.reduce((acc, current) => acc + current.links, 0), subtitle: 'Referencias activas', icon: 'link2' },
  ],
};
