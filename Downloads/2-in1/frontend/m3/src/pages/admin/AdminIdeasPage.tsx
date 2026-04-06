import React, { useState } from 'react';
import { Lightbulb, Plus, CheckCircle2, Circle, Clock } from 'lucide-react';

interface Idea {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

const INITIAL_IDEAS: Idea[] = [
    {
      id: '1',
      title: 'Integración con API de Google Search Console',
      description:
        'Automatizar la obtención de datos de clics, impresiones y posiciones para mostrar un gráfico de tendencia en el Dashboard general.',
      status: 'pending',
      createdAt: '2026-03-23T00:00:00.000Z',
    },
    {
      id: '2',
      title: 'Sistema de notificaciones push',
      description:
        'Avisar a los usuarios (clientes y operadores) cuando haya un cambio de estado en una tarea crítica del Roadmap o en un módulo.',
      status: 'in_progress',
      createdAt: '2026-03-22T00:00:00.000Z',
    },
]

const AdminIdeasPage: React.FC = () => {
  const [ideas, setIdeas] = useState<Idea[]>(INITIAL_IDEAS);

  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');

  const handleAddIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaTitle.trim()) return;

    const newIdea: Idea = {
      id: Date.now().toString(),
      title: newIdeaTitle,
      description: newIdeaDesc,
      status: 'pending',
      createdAt: '2026-03-23T00:00:00.000Z',
    };

    setIdeas([newIdea, ...ideas]);
    setNewIdeaTitle('');
    setNewIdeaDesc('');
  };

  const getStatusIcon = (status: Idea['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'in_progress':
        return <Clock className="text-blue-500" size={20} />;
      case 'pending':
        return <Circle className="text-slate-400" size={20} />;
    }
  };

  const getStatusLabel = (status: Idea['status']) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En progreso';
      case 'pending':
        return 'Pendiente';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="text-amber-500" />
            Ideas de Mejora (Admin)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Espacio exclusivo para administradores donde registrar y hacer seguimiento de nuevas
            funcionalidades.
          </p>
        </div>
      </div>

      {/* Formulario Nueva Idea */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Añadir nueva idea
        </h2>
        <form onSubmit={handleAddIdea} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Título
            </label>
            <input
              type="text"
              value={newIdeaTitle}
              onChange={(e) => setNewIdeaTitle(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:text-white"
              placeholder="Ej: Modo oscuro mejorado..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descripción
            </label>
            <textarea
              value={newIdeaDesc}
              onChange={(e) => setNewIdeaDesc(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:text-white resize-none h-24"
              placeholder="Detalles sobre la implementación..."
            />
          </div>
          <button
            type="submit"
            disabled={!newIdeaTitle.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Guardar Idea
          </button>
        </form>
      </div>

      {/* Lista de Ideas */}
      <div className="space-y-4">
        {ideas.map((idea) => (
          <div
            key={idea.id}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-start"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(idea.status)}
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {idea.title}
                </h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full border font-medium ${
                    idea.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                      : idea.status === 'in_progress'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  {getStatusLabel(idea.status)}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{idea.description}</p>
            </div>
            <div className="text-xs text-slate-400 whitespace-nowrap">
              {new Date(idea.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
        {ideas.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            No hay ideas registradas aún.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminIdeasPage;
