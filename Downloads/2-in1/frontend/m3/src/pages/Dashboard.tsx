import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from 'recharts';
import { ModuleData } from '../types';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Download,
  Mic,
  Flame,
  LogIn,
  Settings,
  X,
  Search,
  Globe,
  HelpCircle,
  Upload,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { Skeleton } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useGSCAuth } from '../hooks/useGSCAuth';
import { GSCComparisonMode, useGSCData } from '../hooks/useGSCData';
import { GSCDateRangeControl } from '../components/GSCDateRangeControl';
import { InsightDetailModal } from '../components/InsightDetailModal';
import { SeoInsight, SeoInsightCategory } from '../types/seoInsights';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { buildIgnoredEntryKey, useSeoIgnoredItems } from '../hooks/useSeoIgnoredItems';

const GSC_COMPARISON_MODE_LABELS: Record<GSCComparisonMode, string> = {
  previous_period: 'Periodo anterior',
  previous_year: 'Mismo periodo del año pasado',
};

interface DashboardProps {
  modules: ModuleData[];
  globalScore: number;
  onReset?: () => void;
}

interface HeroMetricProps {
  title: string;
  value: string | number;
  description: string;
  tone: 'primary' | 'success' | 'warning';
}

export const getVisibleSelectedGscSite = (
  selectedSite: string,
  filteredGscSites: Array<{ siteUrl: string }>,
) => {
  if (!selectedSite) {
    return '';
  }

  return filteredGscSites.some((site) => site.siteUrl === selectedSite) ? selectedSite : '';
};

const heroToneStyles: Record<HeroMetricProps['tone'], string> = {
  primary: 'bg-primary text-on-primary',
  success: 'bg-success text-on-primary',
  warning: 'bg-warning text-on-primary',
};

const formatNumberSafe = (value: unknown, fallback = '—') => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : fallback;
};

const formatPositionSafe = (value: unknown, fallback = '—') => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(1) : fallback;
};

const HeroMetric: React.FC<HeroMetricProps> = ({ title, value, description, tone }) => (
  <Card className={`rounded-2xl p-5 shadow-brand ${heroToneStyles[tone]}`}>
    <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">{title}</div>
    <div className="mt-3 text-3xl font-bold">{value}</div>
    <div className="mt-2 line-clamp-3 text-xs opacity-80">{description}</div>
  </Card>
);

const Dashboard: React.FC<DashboardProps> = ({ modules, globalScore }) => {
  const navigate = useNavigate();
  const { success: showSuccess } = useToast();
  const [quickTask, setQuickTask] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<SeoInsight | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SeoInsightCategory | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>(
    'all',
  );
  const [gscSiteQuery, setGscSiteQuery] = useState('');
  const [comparisonMode, setComparisonMode] = useState<GSCComparisonMode>('previous_period');
  const [showInsightsHelp, setShowInsightsHelp] = useState(false);

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const {
    gscAccessToken,
    googleUser,
    clientId,
    showGscConfig,
    setShowGscConfig,
    handleSaveClientId,
    handleLogoutGsc,
    login,
    setClientId,
  } = useGSCAuth();

  const {
    gscSites,
    selectedSite,
    setSelectedSite,
    gscData,
    comparisonGscData,
    comparisonPeriod,
    isLoadingGsc,
    insights: { insights, groupedInsights, topQueries },
  } = useGSCData(gscAccessToken, startDate, endDate, comparisonMode);

  const {
    entries: ignoredEntries,
    isIgnored,
    ignoreRow,
    unignoreKey,
    importEntries,
  } = useSeoIgnoredItems();

  const filteredGscSites = useMemo(() => {
    const normalizedQuery = gscSiteQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return gscSites;
    }

    return gscSites.filter((site) => site.siteUrl.toLowerCase().includes(normalizedQuery));
  }, [gscSiteQuery, gscSites]);

  const visibleSelectedGscSite = useMemo(
    () => getVisibleSelectedGscSite(selectedSite, filteredGscSites),
    [filteredGscSites, selectedSite],
  );

  const badge = useMemo(() => {
    if (globalScore >= 95) return { title: 'Chief SEO Officer', variant: 'success' as const };
    if (globalScore >= 80) return { title: 'Jefe de Audiencias', variant: 'warning' as const };
    if (globalScore >= 60) return { title: 'Líder Técnico SEO', variant: 'primary' as const };
    if (globalScore >= 40) return { title: 'Estratega SEO', variant: 'primary' as const };
    if (globalScore >= 20) return { title: 'Analista Junior', variant: 'primary' as const };
    return { title: 'Becario SEO', variant: 'neutral' as const };
  }, [globalScore]);

  const chartData = useMemo(
    () =>
      modules.map((m) => {
        const total = m.tasks.length;
        const completed = m.tasks.filter((t) => t.status === 'completed').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        return {
          name: `M${m.id}`,
          fullTitle: m.title,
          score: percentage,
          color: percentage === 100 ? '#10b981' : percentage > 50 ? '#3b82f6' : '#94a3b8',
        };
      }),
    [modules],
  );

  const radarData = useMemo(() => {
    const categoryScores: Record<string, { total: number; completed: number }> = {};
    modules.forEach((m) => {
      m.tasks.forEach((t) => {
        const cat = t.category || 'General';
        if (!categoryScores[cat]) {
          categoryScores[cat] = { total: 0, completed: 0 };
        }
        categoryScores[cat].total += 1;
        if (t.status === 'completed') {
          categoryScores[cat].completed += 1;
        }
      });
    });

    return Object.keys(categoryScores).map((cat) => ({
      subject: cat,
      A: Math.round((categoryScores[cat].completed / categoryScores[cat].total) * 100),
      fullMark: 100,
    }));
  }, [modules]);

  const nextModule = useMemo(
    () =>
      modules.find((m) => {
        const total = m.tasks.length;
        const completed = m.tasks.filter((t) => t.status === 'completed').length;
        return completed < total;
      }),
    [modules],
  );

  const actionableInsights = useMemo(
    () =>
      insights
        .map((insight) => {
          const visibleRows = insight.relatedRows.filter((row) => !isIgnored(row));
          return {
            ...insight,
            relatedRows: visibleRows,
            affectedCount: visibleRows.length,
          };
        })
        .filter((insight) => insight.relatedRows.length > 0),
    [insights, isIgnored],
  );

  const actionableGroupedInsights = useMemo(
    () =>
      groupedInsights
        .map((group) => ({
          ...group,
          insights: group.insights
            .map((insight) => {
              const visibleRows = insight.relatedRows.filter((row) => !isIgnored(row));
              return {
                ...insight,
                relatedRows: visibleRows,
                affectedCount: visibleRows.length,
              };
            })
            .filter((insight) => insight.relatedRows.length > 0),
        }))
        .filter((group) => group.insights.length > 0),
    [groupedInsights, isIgnored],
  );

  const actionableTopOpportunities = useMemo(
    () => actionableInsights.filter((insight) => insight.category === 'opportunity').slice(0, 3),
    [actionableInsights],
  );

  const actionableTopRisks = useMemo(
    () => actionableInsights.filter((insight) => insight.category === 'risk').slice(0, 3),
    [actionableInsights],
  );

  const topQueriesNormalized = useMemo(
    () =>
      topQueries?.items.slice(0, 5).map((item) => ({
        ...item,
        position: Number(item.position),
        clicks: Number(item.clicks),
        impressions: Number(item.impressions),
      })) ?? [],
    [topQueries],
  );

  const filteredInsights = useMemo(
    () =>
      actionableInsights.filter((insight) => {
        const categoryMatch = selectedCategory === 'all' || insight.category === selectedCategory;
        const priorityMatch = selectedPriority === 'all' || insight.priority === selectedPriority;
        return categoryMatch && priorityMatch;
      }),
    [actionableInsights, selectedCategory, selectedPriority],
  );

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas las categorías' },
      ...actionableGroupedInsights.map((group) => ({ value: group.category, label: group.label })),
    ],
    [actionableGroupedInsights],
  );

  const handleExport = () => {
    const date = new Date().toLocaleDateString();
    const text = `REPORTE SEO MEDIAFLOW - ${date}\nPuntuación Global: ${globalScore}% (${badge.title})\nInsights activos: ${actionableInsights.length}\n\n${modules.map((m) => `${m.title}: ${m.tasks.filter((t) => t.status === 'completed').length}/${m.tasks.length}`).join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_MediaFlow_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    showSuccess('Reporte descargado.');
  };

  const simulateVoiceRecording = () => {
    setIsRecording(true);
    setTimeout(() => {
      setQuickTask('Revisar etiquetas canonical en la sección de deportes...');
      setIsRecording(false);
      showSuccess('Nota de voz transcrita.');
    }, 1500);
  };

  const gscChartData = useMemo(() => {
    const maxLength = Math.max(gscData.length, comparisonGscData.length);

    return Array.from({ length: maxLength }, (_, index) => {
      const currentRow = gscData[index];
      const comparisonRow = comparisonGscData[index];

      return {
        label: currentRow?.keys?.[0] || comparisonRow?.keys?.[0] || `Fila ${index + 1}`,
        currentClicks: currentRow?.clicks ?? null,
        currentImpressions: currentRow?.impressions ?? null,
        comparisonClicks: comparisonRow?.clicks ?? null,
        comparisonImpressions: comparisonRow?.impressions ?? null,
      };
    });
  }, [gscData, comparisonGscData]);

  const comparisonSummary = useMemo(() => {
    if (!comparisonPeriod) {
      return 'Sin comparativa disponible.';
    }

    return `${GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode]}: ${comparisonPeriod.previous.startDate} a ${comparisonPeriod.previous.endDate}`;
  }, [comparisonPeriod]);

  const priorityLabel: Record<'high' | 'medium' | 'low', string> = {
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
  };

  const severityVariant: Record<'critical' | 'high' | 'medium' | 'low', 'danger' | 'warning' | 'success'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'warning',
    low: 'success',
  };

  const priorityVariant: Record<'high' | 'medium' | 'low', 'danger' | 'warning' | 'neutral'> = {
    high: 'danger',
    medium: 'warning',
    low: 'neutral',
  };

  const InsightCard = ({ insight }: { insight: SeoInsight }) => (
    <button
      onClick={() => setSelectedInsight(insight)}
      className="surface-panel text-left p-5 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              {insight.visualContext.categoryLabel}
            </span>
            <Badge variant={priorityVariant[insight.priority]} className="text-[10px]">
              Prioridad {priorityLabel[insight.priority]}
            </Badge>
            <Badge variant={severityVariant[insight.severity]} className="text-[10px]">
              {insight.severity}
            </Badge>
          </div>
          <h3 className="text-base font-bold text-foreground">{insight.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-muted">
            {insight.summary}
          </p>
        </div>
        <div className="text-right min-w-[74px]">
          <div className="text-2xl font-bold text-foreground">{insight.affectedCount}</div>
          <div className="text-xs text-muted">elementos</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
        <div className="metric-chip">
          <div className="metric-label">Score</div>
          <div className="text-lg font-bold text-foreground">{insight.score}</div>
        </div>
        <div className="metric-chip">
          <div className="metric-label">Oportunidad</div>
          <div className="text-lg font-bold text-foreground">{insight.opportunity}</div>
        </div>
        <div className="metric-chip">
          <div className="metric-label">Confianza</div>
          <div className="text-lg font-bold text-foreground">{insight.confidence}</div>
        </div>
      </div>
      <div className="mt-4 line-clamp-2 text-xs text-muted">{insight.reason}</div>
    </button>
  );

  return (
    <div className="page-shell relative animate-fade-in">
      {selectedInsight && (
        <div className="overlay-backdrop animate-fade-in">
          <ErrorBoundary>
            <InsightDetailModal
              insight={selectedInsight}
              onClose={() => setSelectedInsight(null)}
              isIgnored={isIgnored}
              onIgnoreRow={(row) => {
                ignoreRow(row);
                showSuccess('Fila marcada como ya gestionada.');
              }}
              onUnignoreRow={(key) => {
                unignoreKey(key);
                showSuccess('Fila reincorporada al análisis.');
              }}
              buildIgnoredKey={buildIgnoredEntryKey}
            />
          </ErrorBoundary>
        </div>
      )}

      {showInsightsHelp && (
        <Modal
          isOpen={showInsightsHelp}
          onClose={() => setShowInsightsHelp(false)}
          title="Ayuda · evitar reanalizar trabajo ya realizado"
          className="max-w-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                <HelpCircle size={20} />
              </h3>
              <p className="text-sm text-muted mt-2">
                Puedes excluir consultas/URLs ya gestionadas una a una o importando un listado en
                CSV.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="surface-subtle p-4">
              <div className="font-semibold text-foreground">
                Opción 1 · marcar desde cada insight
              </div>
              <ol className="mt-2 list-decimal pl-5 text-sm text-muted space-y-2">
                <li>Abre un insight concreto.</li>
                <li>
                  En cada fila usa el icono de bloquear para marcarla como &quot;ya
                  gestionada&quot;.
                </li>
                <li>La fila se ocultará aquí y dejará de entrar en futuros análisis del motor.</li>
              </ol>
            </div>
            <div className="surface-subtle p-4">
              <div className="font-semibold text-foreground">
                Opción 2 · importar un sheet/CSV
              </div>
              <p className="mt-2 text-sm text-muted">
                Sube un CSV con cabeceras <strong>query</strong> y <strong>url</strong>, o con esas
                dos columnas en ese orden.
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-brand-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover">
                <Upload size={16} /> Importar CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const content = await file.text();
                    const importedCount = importEntries(content);
                    showSuccess(`${importedCount} filas añadidas a exclusiones.`);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
            <div className="font-semibold">Formato recomendado del sheet</div>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white/80 dark:bg-slate-900/50 p-3 text-xs">{`query,url
mejores zapatillas running,https://dominio.com/running
auditoria seo local,https://dominio.com/seo-local`}</pre>
            <p className="mt-2">
              Exclusiones guardadas actualmente: <strong>{ignoredEntries.length}</strong>.
            </p>
          </div>
        </Modal>
      )}

      {showGscConfig && (
        <Modal
          isOpen={showGscConfig}
          onClose={() => setShowGscConfig(false)}
          title="Configuración Global API"
          className="max-w-md"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
              <Settings size={20} />
            </h3>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            Introduce el <strong>Client ID</strong> de tu proyecto en Google Cloud para conectar
            Search Console.
          </p>
          <label className="mb-1 block text-xs font-bold uppercase text-muted">
            OAuth 2.0 Client ID
          </label>
          <Input
            type="text"
            className="mb-4 font-mono"
            placeholder="xxxx-xxxx.apps.googleusercontent.com"
            defaultValue={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <Button onClick={() => handleSaveClientId(clientId)} className="w-full font-bold">
            Guardar Configuración Global
          </Button>
        </Modal>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            Visión General de Madurez
            <Badge variant={badge.variant}>{badge.title}</Badge>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Sigue la evolución SEO de tu publicación desde la auditoría hasta la autoridad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!googleUser ? (
            <>
              <button
                onClick={() => setShowGscConfig(true)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Settings size={20} />
              </button>
              <Button onClick={() => login()} variant="secondary">
                <LogIn size={16} className="text-blue-500" />
                <span>Login con Google</span>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 pr-4 shadow-sm">
              <div className="relative">
                <img
                  src={googleUser.picture}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-slate-200"
                />
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">
                  {googleUser.name}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">{googleUser.email}</span>
              </div>
              <button onClick={handleLogoutGsc} className="ml-2 text-slate-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2 hidden md:block"></div>
          <Button onClick={handleExport} variant="secondary">
            <Download size={16} /> Exportar
          </Button>
        </div>
      </header>

      <Card className="h-16 w-full max-w-2xl p-2 flex items-center gap-2">
        <Button
          onClick={simulateVoiceRecording}
          size="sm"
          className={`p-3 rounded-lg transition-colors ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
        >
          <Mic size={20} />
        </Button>
        <Input
          type="text"
          value={quickTask}
          onChange={(e) => setQuickTask(e.target.value)}
          placeholder={isRecording ? 'Escuchando...' : 'Nota rápida...'}
          className="flex-1 border-0 bg-transparent"
        />
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HeroMetric
          title="Insights activos"
          value={actionableInsights.length}
          description="Señales priorizadas por impacto, urgencia, confianza y facilidad de implementación."
          tone="bg-gradient-to-br from-slate-900 to-slate-700"
        />
        <HeroMetric
          title="Oportunidades top"
          value={actionableTopOpportunities.length}
          description={
            actionableTopOpportunities[0]?.title || 'Sin oportunidades destacadas en este periodo.'
          }
          tone="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <HeroMetric
          title="Riesgos top"
          value={actionableTopRisks.length}
          description={actionableTopRisks[0]?.title || 'No se detectan riesgos de alta prioridad.'}
          tone="bg-gradient-to-br from-rose-500 to-red-700"
        />
        <HeroMetric
          title="Comparativa"
          value={comparisonPeriod ? GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode] : 'N/A'}
          description={comparisonSummary}
          tone="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg">Motor de insights SEO</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Del dato GSC al diagnóstico: origen, regla, prioridad y acción quedan trazados en una
              estructura homogénea.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setShowInsightsHelp(true)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-sm font-medium text-blue-700 dark:text-blue-300 hover:border-blue-300"
            >
              <HelpCircle size={16} /> Ayuda
            </button>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as SeoInsightCategory | 'all')}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              value={selectedPriority}
              onChange={(e) =>
                setSelectedPriority(e.target.value as 'all' | 'high' | 'medium' | 'low')
              }
            >
              <option value="all">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredInsights.length > 0 ? (
            filteredInsights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
          ) : (
            <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-400">
              No hay insights que coincidan con los filtros seleccionados.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {actionableGroupedInsights.map((group) => (
            <div
              key={group.category}
              className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="font-bold text-slate-900 dark:text-white">{group.label}</h4>
                <Badge variant={priorityVariant[group.topPriority]} className="text-xs font-bold">
                  Prioridad {priorityLabel[group.topPriority]}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{group.description}</p>
              <div className="mt-4 space-y-3">
                {group.insights.slice(0, 3).map((insight) => (
                  <button
                    key={insight.id}
                    onClick={() => setSelectedInsight(insight)}
                    className="w-full text-left rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {insight.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {insight.summary}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{insight.score}</div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">
                          score
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ErrorBoundary
            title="Se interrumpió el panel de Search Console"
            message="Falló la carga de datos de Search Console. Puedes reintentar sin perder el resto del Dashboard."
          >
            {gscAccessToken ? (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                <Search size={200} />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                      Rendimiento en Búsqueda
                    </h3>
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Datos reales de Search Console
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <GSCDateRangeControl
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={(start, end) => {
                      setStartDate(start);
                      setEndDate(end);
                    }}
                  />
                  <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[240px]">
                    <select
                      className="w-full bg-white dark:bg-slate-950 text-xs font-medium px-2 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      value={comparisonMode}
                      onChange={(e) => setComparisonMode(e.target.value as GSCComparisonMode)}
                      aria-label="Tipo de comparativa GSC"
                    >
                      <option value="previous_period">Comparar con periodo pasado</option>
                      <option value="previous_year">Comparar con año pasado</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Search size={14} className="ml-1 text-slate-400" />
                      <input
                        type="search"
                        value={gscSiteQuery}
                        onChange={(e) => setGscSiteQuery(e.target.value)}
                        placeholder="Buscar propiedad"
                        aria-label="Buscar propiedad de Search Console"
                        className="w-full bg-transparent text-xs font-medium p-1 outline-none text-slate-700 placeholder:text-slate-400 dark:text-slate-300"
                      />
                    </div>
                    <div className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                      <Globe size={14} className="ml-1 text-slate-400" />
                      <select
                        className="w-full bg-transparent text-xs font-medium p-1.5 outline-none text-slate-700 dark:text-slate-300"
                        value={visibleSelectedGscSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                      >
                        {filteredGscSites.length > 0 ? (
                          <>
                            {!visibleSelectedGscSite && (
                              <option value="" disabled>
                                Selecciona una propiedad
                              </option>
                            )}
                            {filteredGscSites.map((site) => (
                              <option key={site.siteUrl} value={site.siteUrl}>
                                {(site.siteUrl || '').replace('sc-domain:', '') || 'Propiedad sin URL'}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="" disabled>
                            No hay propiedades que coincidan
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 text-xs text-slate-500 dark:text-slate-400 relative z-10">
                Periodo actual: <strong>{startDate}</strong> a <strong>{endDate}</strong>
                {comparisonPeriod && (
                  <>
                    {' '}
                    · {GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode]}:{' '}
                    <strong>{comparisonPeriod.previous.startDate}</strong> a{' '}
                    <strong>{comparisonPeriod.previous.endDate}</strong>
                  </>
                )}
              </div>

              <div className="h-72 w-full">
                {isLoadingGsc ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Spinner size={32} />
                    <Skeleton width="60%" height="20px" />
                    <span className="text-sm">Sincronizando datos de Google...</span>
                  </div>
                ) : gscChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={gscChartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                        opacity={0.5}
                      />
                      <XAxis dataKey="label" hide axisLine={false} tickLine={false} />
                      <YAxis
                        orientation="right"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          fontFamily: 'Inter, sans-serif',
                        }}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="currentClicks"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorClicks)"
                        name="Clics actuales"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="comparisonClicks"
                        stroke="#0f766e"
                        strokeWidth={2}
                        fillOpacity={0}
                        strokeDasharray="6 6"
                        name={
                          comparisonPeriod
                            ? `Clics ${GSC_COMPARISON_MODE_LABELS[comparisonPeriod.mode]}`
                            : 'Clics comparados'
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="currentImpressions"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        fillOpacity={0}
                        strokeDasharray="5 5"
                        name="Impresiones actuales"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <Search size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">Sin datos disponibles para este periodo.</p>
                    <p className="text-xs opacity-70">
                      Prueba cambiando de propiedad o verifica tu Search Console.
                    </p>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <CheckCircle2 size={24} />
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      Tareas Completadas
                    </p>
                    <h3 className="text-3xl font-bold mt-1">
                      {modules.reduce(
                        (acc, m) => acc + m.tasks.filter((t) => t.status === 'completed').length,
                        0,
                      )}
                      <span className="text-slate-300 dark:text-slate-600 text-lg ml-2 font-normal">
                        / {modules.reduce((acc, m) => acc + m.tasks.length, 0)}
                      </span>
                    </h3>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${globalScore}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={24} />
                      </div>
                      <span className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold px-2 py-1 rounded-full">
                        Acción Requerida
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      Próxima Prioridad
                    </p>
                    <h3 className="text-xl font-bold mt-1 line-clamp-2">
                      {nextModule ? nextModule.title : 'Todo Limpio'}
                    </h3>
                  </div>
                  {nextModule && (
                    <button
                      onClick={() => navigate(`/app/module/${nextModule.id}`)}
                      className="mt-4 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                    >
                      Ir al Módulo <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </ErrorBoundary>

          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold">Madurez por Módulo</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#334155"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {topQueriesNormalized.length > 0 ? (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Flame className="text-orange-500" size={20} /> Top Consultas
                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">
                  GSC Data
                </span>
              </h3>
              <div className="space-y-3">
                {topQueriesNormalized.map((t, i) => {
                  const queryLabel =
                    typeof t.keys?.[0] === 'string' && t.keys[0].trim().length > 0
                      ? t.keys[0]
                      : 'Consulta sin término';

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer group"
                    >
                      <div>
                        <div className="text-sm font-semibold group-hover:text-blue-500 line-clamp-1">
                          {queryLabel}
                        </div>
                        <div className="text-xs text-slate-400">
                          Posición: {formatPositionSafe(t.position)}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatNumberSafe(t.clicks, '0')} clics
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 opacity-60">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Flame className="text-slate-400" size={20} /> Top Consultas
              </h3>
              <div className="text-sm text-slate-400 text-center py-4">
                Sin datos de consultas recientes.
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#64748b" opacity={0.3} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Madurez"
                    dataKey="A"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((m) => {
          const completedCount = m.tasks.filter((t) => t.status === 'completed').length;
          const totalCount = m.tasks.length;
          const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

          return (
            <div
              key={m.id}
              onClick={() => navigate(`/app/module/${m.id}`)}
              className="group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Nivel {m.levelRange}
                </span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${progress === 100 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}
                >
                  M{m.id}
                </div>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {m.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 h-10">
                {m.description}
              </p>

              <div className="mt-6">
                <div className="flex justify-between text-xs font-medium text-slate-400 mb-1">
                  <span>Progreso</span>
                  <span>
                    {completedCount}/{totalCount}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
