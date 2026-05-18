import { KPI, MethodologyStatus, Module, Phase, Resource, ResourceType } from '@/types/metodologia';

export type { MethodologyStatus, Module as MethodologyModule, Phase as MethodologyPhase, Resource as MethodologyResource, ResourceType, KPI };

export type CreateResourceInput = Pick<Resource, 'type' | 'title' | 'moduleId' | 'description' | 'meta'> & {
  status: MethodologyStatus;
  links: string[];
  docs: number;
  metadata: string;
};

export type CreateModuleInput = Pick<Module, 'id' | 'title' | 'description' | 'status' | 'docs' | 'links'>;

const RESOURCE_STORAGE_KEY = 'metodologia:resources';
const MODULE_STORAGE_KEY = 'metodologia:modules';

const initialModules: Module[] = [
  { id: 'M1', title: 'Auditoría inicial', description: 'Análisis del estado actual del sitio y detección de oportunidades.', status: 'Completado', docs: 6, links: 3, order: 1 },
  { id: 'M2', title: 'Estrategia y verticales', description: 'Definición de verticales, segmentos y priorización de acciones.', status: 'En progreso', docs: 5, links: 2, order: 2 },
  { id: 'M3', title: 'SEO editorial', description: 'Plan editorial, clusters y optimización de contenido.', status: 'En progreso', docs: 4, links: 2, order: 3 },
];

const initialPhases: Phase[] = [
  { title: 'Descubrimiento', desc: 'Recopilación de contexto, objetivos, stakeholders y recursos existentes.', deliverables: ['Brief inicial', 'Mapa de stakeholders'], status: 'Completado', order: 1 },
  { title: 'Auditoría inicial', desc: 'Revisión SEO técnica, contenidos, arquitectura y rendimiento.', deliverables: ['Informe de auditoría', 'Checklist técnico'], status: 'En progreso', order: 2 },
  { title: 'Priorización', desc: 'Ordenamos hallazgos según impacto, esfuerzo y dependencia.', deliverables: ['Matriz ICE', 'Backlog priorizado'], status: 'Pendiente', order: 3 },
];

const initialResources: Resource[] = [
  { title: 'Guía de Metodología SEO - v2.1', meta: 'Google Docs · Actualizado hace 5 días', type: 'doc', moduleId: 'M1', description: 'Manual completo de la metodología y estándares compartidos para todos los proyectos.' },
  { title: 'Checklist de auditoría', meta: 'Hoja de cálculo · v1.1', type: 'sheet', moduleId: 'M2', description: 'Lista de validación técnica para auditoría.' },
  { title: 'Dashboard de seguimiento', meta: 'Hoja de cálculo · v1.3', type: 'chart', moduleId: 'M3', description: 'Control de KPIs y avance del plan.' },
];

const parseJsonArray = <T>(value: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readResources = () => {
  const saved = parseJsonArray<Resource>(localStorage.getItem(RESOURCE_STORAGE_KEY));
  return saved.length > 0 ? saved : initialResources;
};

const writeResources = (resources: Resource[]) => localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources));

const readModules = () => {
  const saved = parseJsonArray<Module>(localStorage.getItem(MODULE_STORAGE_KEY));
  return saved.length > 0 ? saved : initialModules;
};

const writeModules = (modules: Module[]) => localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(modules));

const buildKpis = (modules: Module[], phases: Phase[], resources: Resource[]): KPI[] => {
  const linksCount = modules.reduce((acc, module) => acc + module.links, 0);
  return [
    { label: 'módulos', value: String(modules.length), subtitle: 'Estructura definida' },
    { label: 'fases', value: String(phases.length), subtitle: 'De principio a fin' },
    { label: 'recursos', value: String(resources.length), subtitle: 'Documentación y guías' },
    { label: 'enlaces internos', value: String(linksCount), subtitle: 'Referencias activas' },
  ];
};

export const metodologiaService = {
  async getModules(): Promise<Module[]> { return readModules(); },
  async getPhases(): Promise<Phase[]> { return initialPhases; },
  async getResources(): Promise<Resource[]> { return readResources(); },
  async getKpis(): Promise<KPI[]> {
    const [modules, phases, resources] = await Promise.all([this.getModules(), this.getPhases(), this.getResources()]);
    return buildKpis(modules, phases, resources);
  },
  async createResource(input: CreateResourceInput): Promise<Resource> {
    const resource: Resource = { title: input.title.trim(), meta: input.meta.trim() || input.metadata.trim(), type: input.type, moduleId: input.moduleId, description: input.description.trim(), status: input.status, links: input.links, docs: input.docs, metadata: input.metadata.trim() };
    const current = readResources(); writeResources([resource, ...current]); return resource;
  },
  async createModule(input: CreateModuleInput): Promise<Module> {
    const module: Module = { ...input, title: input.title.trim(), description: input.description.trim(), id: input.id.trim(), order: readModules().length + 1 };
    const current = readModules(); writeModules([module, ...current]); return module;
  },
  async updateModule(module: Module): Promise<Module> { return Promise.resolve(module); },
  async updatePhase(phase: Phase): Promise<Phase> { return Promise.resolve(phase); },
  async updateResource(resource: Resource): Promise<Resource> { return Promise.resolve(resource); },
  async reorderModules(modules: Module[]): Promise<Module[]> { writeModules(modules); return Promise.resolve(modules); },
  async reorderPhases(phases: Phase[]): Promise<Phase[]> { return Promise.resolve(phases); },
};
