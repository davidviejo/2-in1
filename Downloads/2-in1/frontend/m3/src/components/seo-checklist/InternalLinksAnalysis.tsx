import React, { useState, useMemo } from 'react';
import { Link, ExternalLink, ChevronDown, ChevronUp, Type, Check, X } from 'lucide-react';

export interface InternalLinkData {
  anchor: string;
  url_to: string;
  type: string; // 'dofollow' | 'nofollow' | 'ugc' | 'sponsored'
  target_blank?: boolean;
}

interface Props {
  internal_links: InternalLinkData[];
}

export const InternalLinksAnalysis: React.FC<Props> = ({ internal_links }) => {
  const [showAll, setShowAll] = useState(false);

  const displayedLinks = useMemo(() => {
    return showAll ? internal_links : internal_links.slice(0, 20);
  }, [internal_links, showAll]);

  const uniqueDestinations = useMemo(() => {
    const destinations = new Set(internal_links.map((link) => link.url_to));
    return destinations.size;
  }, [internal_links]);

  const topAnchors = useMemo(() => {
    const counts: Record<string, number> = {};
    internal_links.forEach((link) => {
      const anchor = link.anchor?.trim() || '(Sin anchor)';
      counts[anchor] = (counts[anchor] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [internal_links]);

  const getTypeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case 'dofollow':
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
      case 'nofollow':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'ugc':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'sponsored':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      default:
        return 'text-slate-600 bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800';
    }
  };

  if (!internal_links || internal_links.length === 0) {
    return (
      <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200">
        No se encontraron enlaces internos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 mb-2">
            <Link size={20} />
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {internal_links.length}
          </div>
          <div className="text-xs text-slate-400 font-bold uppercase">Total Enlaces</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 mb-2">
            <ExternalLink size={20} />
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {uniqueDestinations}
          </div>
          <div className="text-xs text-slate-400 font-bold uppercase">Destinos Únicos</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase">
            <Type size={14} /> Top Anchors
          </div>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {topAnchors.map(([anchor, count], i) => (
              <li key={i} className="flex justify-between items-center">
                <span className="truncate max-w-[120px]" title={anchor}>
                  {anchor}
                </span>
                <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 rounded text-[10px]">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold">
            <tr>
              <th className="px-3 py-2">Anchor</th>
              <th className="px-3 py-2">URL Destino</th>
              <th className="px-3 py-2 text-center">Rel</th>
              <th className="px-3 py-2 text-center" title="Target Blank">
                Blank
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
            {displayedLinks.map((link, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-2 font-medium truncate max-w-[200px]" title={link.anchor}>
                  {link.anchor || <span className="text-slate-400 italic">Sin anchor</span>}
                </td>
                <td className="px-3 py-2 truncate max-w-[250px]" title={link.url_to}>
                  {link.url_to}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-bold border uppercase tracking-wide ${getTypeStyle(
                      link.type,
                    )}`}
                  >
                    {link.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {link.target_blank ? (
                    <Check size={16} className="text-emerald-500 mx-auto" />
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {internal_links.length > 20 && (
          <div className="bg-slate-50 dark:bg-slate-800 p-2 text-center border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center justify-center gap-1 w-full"
            >
              {showAll ? (
                <>
                  <ChevronUp size={14} /> Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Ver todos ({internal_links.length - 20} más)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
