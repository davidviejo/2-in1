import React from 'react';
import { Opportunity } from '@/types/intelligence';

export const ScoreBadge: React.FC<{ score: number }> = ({ score }) => <span className="badge badge-primary">Score {score}</span>;
export const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => <span className="badge badge-danger">{severity}</span>;
export const EmptyState: React.FC<{ title: string }> = ({ title }) => <div className="card p-6 text-center text-muted">{title}</div>;
export const ActionCTAGroup: React.FC<{ onTask?: () => void; onRoadmap?: () => void; onBrief?: () => void }> = ({ onTask, onRoadmap, onBrief }) => (
  <div className="flex gap-2 flex-wrap">
    <button className="btn btn-primary" onClick={onTask}>Crear tarea</button>
    <button className="btn btn-secondary" onClick={onRoadmap}>Enviar a roadmap</button>
    <button className="btn btn-secondary" onClick={onBrief}>Generar brief</button>
  </div>
);

export const OpportunityCard: React.FC<{ opportunity: Opportunity }> = ({ opportunity }) => (
  <div className="card p-4 space-y-2">
    <h3 className="font-semibold text-foreground">{opportunity.title}</h3>
    <p className="text-sm text-muted">{opportunity.type} · {opportunity.urlOrCluster}</p>
    <div className="flex gap-2 items-center"><ScoreBadge score={opportunity.score.total} /><SeverityBadge severity={opportunity.priority} /></div>
    <p className="text-xs text-muted">Confianza: {Math.round(opportunity.confidence * 100)}% · Esfuerzo: {opportunity.effort}/5</p>
    <ActionCTAGroup />
  </div>
);

export const SeoSignalCard: React.FC<{ title: string; detail: string }> = ({ title, detail }) => <div className="card p-4"><h4>{title}</h4><p className="text-sm text-muted">{detail}</p></div>;
export const PriorityMatrix: React.FC = () => <div className="card p-4">Priority Matrix (Impacto × Urgencia)</div>;
export const UrlIssueTable: React.FC<{ rows: Array<{ url: string; status: string; action: string }> }> = ({ rows }) => <table className="w-full text-sm"><thead><tr><th>URL</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map((r) => <tr key={r.url}><td>{r.url}</td><td>{r.status}</td><td>{r.action}</td></tr>)}</tbody></table>;
export const ClusterMap: React.FC = () => <div className="card p-4">Cluster map (mock)</div>;
export const ImpactBeforeAfter: React.FC<{ value: string }> = ({ value }) => <div className="badge badge-success">{value}</div>;
export const ForecastScenarioChart: React.FC = () => <div className="card p-4">Forecast scenarios chart (mock)</div>;
