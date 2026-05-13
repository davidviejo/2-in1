import { ImpactLedgerEntry, IndexationRecord, Opportunity, SeoSignal } from '@/types/intelligence';

export const mockOpportunities: Opportunity[] = [
  { id:'opp-1',projectId:'p1',clientId:'c1',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'new',source:'gsc',confidence:0.81,priority:'critical',title:'CTR bajo en página money keyword',type:'CTR bajo',urlOrCluster:'/servicios/seo-local',effort:2,score:{impact:4,confidence:4,ease:5,businessValue:5,urgency:5,total:2000}, hypothesis:'Si mejoramos snippet y FAQ schema, sube CTR +20%.' },
  { id:'opp-2',projectId:'p1',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'in_review',source:'crawler',confidence:0.72,priority:'high',title:'Canibalización en cluster auditoría',type:'Canibalización',urlOrCluster:'cluster-auditoria',effort:3,score:{impact:5,confidence:3,ease:3,businessValue:4,urgency:4,total:720} }
];

export const mockSignals: SeoSignal[] = [
  { id:'sig-1',projectId:'p1',createdAt:'2026-05-10',updatedAt:'2026-05-13',status:'new',source:'gsc',confidence:0.84,priority:'high',title:'Caída de clics -31%',metric:'clicks',delta:-31,urlOrCluster:'/blog/seo-tecnico' }
];

export const mockIndexation: IndexationRecord[] = [
  { id:'idx-1',projectId:'p1',createdAt:'2026-05-11',updatedAt:'2026-05-13',status:'new',source:'crawler',confidence:0.9,priority:'critical',url:'/categoria/seo-on-page',indexable:false,metaRobots:'noindex,follow',robotsTxt:'allow',canonicalDeclared:'self',canonicalDetected:'https://domain.com/categoria/seo-on-page',sitemapIncluded:true,httpStatus:200,lastCheckedAt:'2026-05-13',probableCause:'Meta robots heredada de template.',recommendation:'Eliminar noindex y solicitar reindexación.',suggestedAction:'Crear tarea técnica y enviar a roadmap.' }
];

export const mockImpactLedger: ImpactLedgerEntry[] = [
  { id:'led-1',projectId:'p1',createdAt:'2026-05-01',updatedAt:'2026-05-13',status:'completed',source:'kanban',confidence:0.78,priority:'high',action:'Optimización Title + Meta',urls:['/servicios/seo-local'],cluster:'seo-local',implementationDate:'2026-05-02',owner:'Ana',hypothesis:'Mejora CTR en top keywords locales',mainMetric:'CTR',secondaryMetrics:['Clicks','Posición media'],measurementWindows:[7,14,28,90],beforeAfter:'CTR 2.1% -> 3.4%',externalFactors:'Update menor de SERP',learning:'Snippet con propuesta de valor local funciona',nextAction:'Escalar a cluster servicios' }
];
