import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Terminal, Play } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { OperatorShell } from '../../components/shell/ShellVariants';

const OperatorPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [executionMode, setExecutionMode] = useState('simulation');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadHistory = async () => {
      try {
        const res = await api.getOperatorExecutions();
        setExecutionMode(res.mode || 'simulation');
        setOutput(
          res.items.map(
            (entry) =>
              `> [${entry.executed_at}] ${entry.executed_by} (${entry.role}) -> ${entry.tool} [${entry.mode}]`,
          ),
        );
      } catch {
        setOutput((prev) => [...prev, '> No se pudo cargar historial de ejecuciones']);
      }
    };

    void loadHistory();
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.authOperator(password);
      if (res.token) {
        setIsAuthenticated(true);
      } else {
        setError('Acceso denegado');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const runTool = async (toolName: string) => {
    try {
      const res = await api.runOperatorTool(toolName);
      setExecutionMode(res.mode || 'simulation');
      const trace = res.trace;
      setOutput((prev) => [
        ...prev,
        `> [${trace.executed_at}] ${trace.executed_by} (${trace.role}) -> ${toolName} [${res.mode}] :: ${res.status}`,
      ]);
    } catch {
      setOutput((prev) => [...prev, `> Error running ${toolName}`]);
    }
  };

  if (isAuthenticated) {
    return (
      <OperatorShell contentClassName="mx-auto w-full max-w-4xl px-4 py-8 font-mono">
          <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
            <h1 className="text-2xl font-bold text-green-400 flex items-center">
              <Terminal className="mr-2" /> Operator Console
            </h1>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-amber-300">
                Mode: {executionMode} (explicit)
              </p>
              <button
                onClick={() => {
                  api.logout();
                  navigate('/');
                }}
                className="text-sm text-slate-400 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase">Available Tools</h2>
              {['audit_crawl', 'gsc_sync', 'keyword_gap', 'backlink_check'].map((tool) => (
                <Button
                  key={tool}
                  onClick={() => runTool(tool)}
                  variant="secondary"
                  className="h-auto w-full justify-between border-slate-700 bg-slate-800 px-4 py-3 text-left text-slate-200 hover:bg-slate-700"
                >
                  <span>{tool}</span>
                  <Play className="w-4 h-4 text-green-500" />
                </Button>
              ))}
            </div>
            <div className="md:col-span-2">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-4">
                Console Output
              </h2>
              <Card className="h-96 overflow-y-auto border-slate-700 bg-black/50 p-4 text-sm">
                {output.length === 0 ? (
                  <EmptyState
                    className="border-slate-700/80 bg-transparent py-16"
                    title="Waiting for commands..."
                  />
                ) : (
                  output.map((line, i) => (
                    <div key={i} className="mb-1 border-b border-white/5 pb-1">
                      {line}
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
      </OperatorShell>
    );
  }

  return (
    <OperatorShell contentClassName="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800 p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
            <Terminal className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Operator Access</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Security Clearance
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/20 text-red-400 px-4 py-3 rounded-lg text-sm border border-red-900/50">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-green-600 text-white hover:bg-green-500"
          >
            {loading ? 'Authenticating...' : 'Initialize'}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-500 hover:text-slate-400"
          >
            Abort
          </button>
        </div>
      </Card>
    </OperatorShell>
  );
};

export default OperatorPage;
