import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type DepthCase = { level: number; expression: string };

type Props = {
  clusterRulesText: string;
  setClusterRulesText: (v: string) => void;
  clusterLevelRulesText: string;
  setClusterLevelRulesText: (v: string) => void;
  lookerClusterCase: string;
  lookerClusterCaseGroupedRegex: string;
  clusterRulesetName: string;
  setClusterRulesetName: (v: string) => void;
  saveCurrentClusterRuleset: () => void;
  clusterRulesets: Array<{ name: string }>;
  loadClusterRuleset: (name: string) => void;
  deleteClusterRuleset: (name: string) => void;
  lookerClusterLevel1Case: string;
  lookerClusterLevel2Case: string;
  lookerClusterLevel1CaseGroupedRegex: string;
  lookerClusterLevel2CaseGroupedRegex: string;
  lookerClusterLevelGroupedCases: DepthCase[];
  clusterDepthLevels: number;
  setClusterDepthLevels: (value: number) => void;
  lookerDepthCases: DepthCase[];
};

export const ClusterizationRulesPanel = ({
  clusterRulesText,
  setClusterRulesText,
  clusterLevelRulesText,
  setClusterLevelRulesText,
  lookerClusterCase,
  lookerClusterCaseGroupedRegex,
  clusterRulesetName,
  setClusterRulesetName,
  saveCurrentClusterRuleset,
  clusterRulesets,
  loadClusterRuleset,
  deleteClusterRuleset,
  lookerClusterLevel1Case,
  lookerClusterLevel2Case,
  lookerClusterLevel1CaseGroupedRegex,
  lookerClusterLevel2CaseGroupedRegex,
  lookerClusterLevelGroupedCases,
  clusterDepthLevels,
  setClusterDepthLevels,
  lookerDepthCases,
}: Props) => (
  <div className="mt-3 surface-subtle p-3">
    <h4 className="text-sm font-semibold">Clustering por niveles + código Data Looker Studio</h4>
    <p className="mt-1 text-xs text-muted">Define clusters por path y genera CASE para usarlo como campo calculado en Looker Studio.</p>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className="metric-label">Reglas de cluster (Cluster|/path1,/path2)</label>
        <textarea className="form-control min-h-[112px]" value={clusterRulesText} onChange={(e) => setClusterRulesText(e.target.value)} />
      </div>
      <div>
        <label className="metric-label">CASE cluster proyecto (auto con dominio GSC)</label>
        <textarea className="form-control min-h-[112px] font-mono text-xs" value={lookerClusterCase} readOnly />
      </div>
      <div>
        <label className="metric-label">CASE cluster proyecto (regex agrupado)</label>
        <textarea className="form-control min-h-[112px] font-mono text-xs" value={lookerClusterCaseGroupedRegex} readOnly />
      </div>
    </div>
    <div className="mt-3 surface-panel p-3">
      <p className="metric-label">Guardar / cargar set de clusterización</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Input value={clusterRulesetName} onChange={(e) => setClusterRulesetName(e.target.value)} placeholder="Nombre del set" />
        <Button variant="secondary" onClick={saveCurrentClusterRuleset}>Guardar set</Button>
      </div>
      {clusterRulesets.length > 0 && <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">{clusterRulesets.map((ruleset) => <div key={ruleset.name} className="flex items-center justify-between rounded border border-border/50 p-2"><span className="text-sm">{ruleset.name}</span><div className="flex gap-2"><Button variant="secondary" onClick={() => loadClusterRuleset(ruleset.name)}>Cargar</Button><Button variant="ghost" onClick={() => deleteClusterRuleset(ruleset.name)}>Eliminar</Button></div></div>)}</div>}
    </div>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className="metric-label">Reglas niveles (Nivel1|Nivel2|Nivel3|...|/path1,/path2)</label>
        <textarea className="form-control min-h-[112px]" value={clusterLevelRulesText} onChange={(e) => setClusterLevelRulesText(e.target.value)} />
      </div>
      <div><label className="metric-label">CASE cluster nivel 1 (reglas)</label><textarea className="form-control min-h-[112px] font-mono text-xs" value={lookerClusterLevel1Case} readOnly /></div>
      <div><label className="metric-label">CASE cluster nivel 2 (reglas)</label><textarea className="form-control min-h-[112px] font-mono text-xs" value={lookerClusterLevel2Case} readOnly /></div>
      <div><label className="metric-label">CASE cluster nivel 1 (regex agrupado)</label><textarea className="form-control min-h-[112px] font-mono text-xs" value={lookerClusterLevel1CaseGroupedRegex} readOnly /></div>
      <div><label className="metric-label">CASE cluster nivel 2 (regex agrupado)</label><textarea className="form-control min-h-[112px] font-mono text-xs" value={lookerClusterLevel2CaseGroupedRegex} readOnly /></div>
    </div>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">{lookerClusterLevelGroupedCases.map((levelCase) => <div key={`grouped-level-case-${levelCase.level}`}><label className="metric-label">CASE cluster nivel {levelCase.level} (regex agrupado)</label><textarea className="form-control min-h-[88px] font-mono text-xs" value={levelCase.expression} readOnly /></div>)}</div>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className="metric-label">CASE cluster nivel 1 (path)</label>
        <Input type="number" min={1} max={10} value={clusterDepthLevels} onChange={(e) => setClusterDepthLevels(Number(e.target.value) || 1)} />
      </div>
    </div>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">{lookerDepthCases.map((depthCase) => <div key={`depth-case-${depthCase.level}`}><label className="metric-label">CASE cluster nivel {depthCase.level}</label><textarea className="form-control min-h-[88px] font-mono text-xs" value={depthCase.expression} readOnly /></div>)}</div>
  </div>
);
