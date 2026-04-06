import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { LayoutGrid, Activity, ArrowRight, LogOut } from 'lucide-react';
import { PortalShell } from '../../components/shell/ShellVariants';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

interface Client {
  slug: string;
  name: string;
  status: string;
  description: string;
}

const ProjectsList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await api.getClients();
        setClients(data);
      } catch {
        // If error (likely 401), redirect to login
        navigate('/clientes');
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [navigate]);

  if (loading) {
    return (
      <PortalShell contentClassName="flex min-h-screen items-center justify-center px-4">
        <EmptyState title="Cargando proyectos..." icon={<Spinner size={28} />} />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      header={
        <nav className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
                D
              </div>
              <span className="text-lg font-bold text-slate-900">Portal de Clientes</span>
            </div>
            <Button onClick={() => api.logout()} variant="ghost" className="text-slate-600">
              <LogOut className="h-4 w-4" /> Cerrar Sesión
            </Button>
          </div>
        </nav>
      }
      contentClassName="w-full py-8 text-slate-800"
    >

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Proyectos Activos</h1>
            <p className="text-slate-500">
              Selecciona un proyecto para acceder a su dashboard detallado.
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-sm text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Sistema Operativo</span>
          </div>
        </div>

        {clients.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-16 w-16 text-slate-300" />}
            title="No hay proyectos asignados"
            description="Contacta con administración si crees que esto es un error."
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <Card
                key={client.slug}
                className="group flex h-64 cursor-pointer flex-col justify-between rounded-brand-lg border border-border p-6 transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
                onClick={() => navigate(`/p/${client.slug}`)}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Activity className="w-5 h-5" />
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {client.status === 'active' ? 'Activo' : 'Pausado'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {client.name}
                  </h3>
                  <p className="text-slate-500 text-sm line-clamp-3">{client.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-50 flex justify-between items-center mt-auto">
                  <span className="text-xs text-slate-400 font-mono">ID: {client.slug}</span>
                  <span className="text-blue-600 text-sm font-medium flex items-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
                    Acceder <ArrowRight className="ml-1 w-4 h-4" />
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
};

export default ProjectsList;
