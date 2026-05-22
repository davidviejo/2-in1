import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { analyzeInternalLinksByLines, InternalLinksByLineItem } from '../../services/pythonEngineClient';

export const InternalLinksByLinesPanel: React.FC = () => {
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<InternalLinksByLineItem[]>([]);

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await analyzeInternalLinksByLines(urls);
      setResults(response.results || []);
    } catch (e) {
      setError((e as Error)?.message || 'Error analizando URLs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">Backend · Enlazado interno por líneas</h2>
      <p className="text-sm text-slate-500">Pega una URL por línea para ver enlaces internos, anchor usado y URL objetivo.</p>
      <textarea
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        rows={8}
        className="w-full rounded-lg border border-slate-300 p-3 text-sm"
        placeholder={'https://example.com/\nhttps://example.com/blog/'}
      />
      <Button onClick={runAnalysis} variant="primary" disabled={loading}>
        {loading ? 'Analizando...' : 'Analizar URLs'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        {results.map((item) => (
          <div key={item.url} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2">
              <p className="font-semibold text-sm">{item.url}</p>
              {item.error ? (
                <p className="text-xs text-red-600">{item.error}</p>
              ) : (
                <p className="text-xs text-slate-500">Enlaces internos: {item.internal_links_count || 0}</p>
              )}
            </div>
            {item.internal_links.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th>Anchor</th>
                    <th>URL objetivo</th>
                    <th>Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  {item.internal_links.map((link, index) => (
                    <tr key={`${item.url}-${index}`}>
                      <td>{link.anchor || '(Sin anchor)'}</td>
                      <td className="truncate max-w-[420px]">{link.url_to}</td>
                      <td>{link.location || 'content'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

