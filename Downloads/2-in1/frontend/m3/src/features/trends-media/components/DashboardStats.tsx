import React from 'react';
import { AlertTriangle, CheckCircle, Layers, TrendingUp } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardStats as StatsType, TrendItem } from '../types';

interface DashboardStatsProps {
  stats: StatsType;
  trends: TrendItem[];
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
}> = ({ title, value, icon, colorClass }) => (
  <div className="flex items-center space-x-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className={`rounded-lg p-3 ${colorClass}`}>{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, trends }) => (
  <div className="mb-8 space-y-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Fuentes Escaneadas" value={stats.sourcesScanned} icon={<Layers className="h-6 w-6 text-blue-600" />} colorClass="bg-blue-50" />
      <StatCard title="Items Detectados" value={stats.itemsFound} icon={<AlertTriangle className="h-6 w-6 text-amber-600" />} colorClass="bg-amber-50" />
      <StatCard title="Alta Prioridad (P1)" value={stats.highPriority} icon={<TrendingUp className="h-6 w-6 text-emerald-600" />} colorClass="bg-emerald-50" />
      <StatCard title="Filtrados/Duplicados" value={stats.duplicatesRemoved} icon={<CheckCircle className="h-6 w-6 text-slate-600" />} colorClass="bg-slate-50" />
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Tendencias de Búsqueda (Google Trends - Valencia)</h3>
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">En tiempo real</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trends} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="keyword" type="category" width={150} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={20}>
              {trends.map((entry, index) => (
                <Cell key={`trend-${entry.keyword}-${index}`} fill={entry.status === 'breakout' ? '#ef4444' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);
