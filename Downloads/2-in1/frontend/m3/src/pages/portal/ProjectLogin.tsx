import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { ArrowLeft, Key } from 'lucide-react';
import { PortalShell } from '../../components/shell/ShellVariants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const ProjectLogin: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.authProject(slug, password);
      if (res.token) {
        navigate(`/c/${slug}/overview`);
      } else {
        setError('Contraseña incorrecta');
      }
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalShell contentClassName="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
            <Key className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Acceso a Proyecto</h1>
          <p className="text-slate-500 mt-2">
            Proyecto: <span className="font-semibold text-slate-700">{slug}</span>
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Clave del Proyecto
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full"
          >
            {loading ? 'Desbloquear' : 'Entrar'}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <Button
            onClick={() => navigate('/clientes')}
            variant="ghost"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a lista de clientes
          </Button>
        </div>
      </Card>
    </PortalShell>
  );
};

export default ProjectLogin;
