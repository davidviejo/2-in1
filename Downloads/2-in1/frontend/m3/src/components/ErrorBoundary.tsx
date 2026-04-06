import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  title?: string;
  message?: string;
  retryLabel?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className={`flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm text-center ${this.props.className || ''}`}
        >
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            {this.props.title || 'Algo salió mal al mostrar estos datos'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-md">
            {this.props.message ||
              'Ocurrió un error inesperado. Hemos registrado el problema. Por favor intenta recargar.'}
          </p>
          {this.state.error && (
            <pre className="text-xs text-left bg-slate-100 dark:bg-slate-800 p-4 rounded-lg mb-4 w-full max-w-md overflow-auto font-mono text-red-500">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            <RefreshCcw size={16} /> {this.props.retryLabel || 'Reintentar'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
