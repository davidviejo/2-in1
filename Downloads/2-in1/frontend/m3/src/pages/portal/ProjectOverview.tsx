import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { BarChart, Activity, AlertTriangle, CheckCircle, LogOut, ArrowLeft } from 'lucide-react';
import { PortalShell } from '../../components/shell/ShellVariants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

interface ProjectData {
  project: string;
  traffic: string;
  keywords_top3: number;
  health_score: number;
  recent_issues: string[];
}

const ProjectOverview: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    const fetchData = async () => {
      try {
        const res = await api.getProjectOverview(slug);
        setData(res);
      } catch {
        navigate(`/p/${slug}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug, navigate]);

  if (loading)
    return (
      <PortalShell contentClassName="flex min-h-screen items-center justify-center px-4">
        <EmptyState title="Cargando dashboard..." icon={<Spinner size={28} />} />
      </PortalShell>
    );

  return (
    <PortalShell
      header={
        <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/clientes/dashboard')}
                variant="ghost"
                className="text-slate-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold leading-none text-slate-900">{data?.project}</h1>
                <span className="font-mono text-xs text-slate-500">Overview Dashboard</span>
              </div>
            </div>
            <Button onClick={() => api.logout()} variant="ghost" className="text-slate-500">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </nav>
      }
      contentClassName="w-full py-8 text-slate-800"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* KPI Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Tráfico Orgánico (Est.)</p>
              <p className="text-3xl font-bold text-slate-900">{data?.traffic}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <BarChart className="w-6 h-6" />
            </div>
          </Card>

          <Card className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Top 3 Keywords</p>
              <p className="text-3xl font-bold text-slate-900">{data?.keywords_top3}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
              <Activity className="w-6 h-6" />
            </div>
          </Card>

          <Card className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Health Score</p>
              <p
                className={`text-3xl font-bold ${data?.health_score && data.health_score > 80 ? 'text-green-600' : 'text-orange-500'}`}
              >
                {data?.health_score}/100
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${data?.health_score && data.health_score > 80 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}
            >
              <CheckCircle className="w-6 h-6" />
            </div>
          </Card>
        </div>

        {/* Issues List */}
        <Card className="overflow-hidden p-0">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center">
            <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
            <h3 className="font-bold text-slate-900">Problemas Recientes Detectados</h3>
          </div>
          <div className="p-0">
            {data?.recent_issues.map((issue, idx) => (
              <div
                key={idx}
                className="px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors flex items-center"
              >
                <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                <span className="text-slate-700 text-sm font-medium">{issue}</span>
              </div>
            ))}
            {(!data?.recent_issues || data.recent_issues.length === 0) && (
              <div className="p-6">
                <EmptyState title="Todo parece estar en orden." />
              </div>
            )}
          </div>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Datos actualizados en tiempo real desde el crawler.
          </p>
        </div>
      </div>
    </PortalShell>
  );
};

export default ProjectOverview;
