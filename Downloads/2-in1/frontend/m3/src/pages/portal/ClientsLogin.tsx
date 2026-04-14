import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ArrowLeft, HardDrive, Lock, Server } from 'lucide-react';
import { PortalShell } from '../../components/shell/ShellVariants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

type AccessMode = 'remote' | 'local';

const ClientsLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AccessMode>('remote');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.authClientsArea(password);
      if (res.token) {
        navigate('/clientes/dashboard');
      } else {
        setError('Contraseña incorrecta');
      }
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalAccess = () => {
    navigate('/app/');
  };

  return (
    <PortalShell contentClassName="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            {mode === 'remote' ? <Lock className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Área de Clientes</h1>
          <p className="text-slate-500 mt-2">
            Elige cómo quieres acceder: remoto con contraseña o local en este navegador.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('remote');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === 'remote' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="h-4 w-4" />
            Remoto
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('local');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === 'local' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            Local
          </button>
        </div>

        {mode === 'remote' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
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
              {loading ? 'Verificando...' : 'Acceder en remoto'}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Accede directamente a tus datos guardados localmente en este navegador.
            </p>
            <Button className="h-12 w-full" onClick={handleLocalAccess}>
              Acceder en local
            </Button>
          </div>
        )}

        <div className="mt-6 text-center">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Button>
        </div>
      </Card>
    </PortalShell>
  );
};

export default ClientsLogin;
