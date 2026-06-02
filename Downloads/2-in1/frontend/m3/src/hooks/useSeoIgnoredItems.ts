import { useCallback, useEffect, useMemo, useState } from 'react';
import { GSCRow } from '../types';

const STORAGE_KEY = 'mediaflow-seo-ignored-gsc-rows';

export interface SeoIgnoredEntry {
  key: string;
  query: string;
  url: string;
  scope?: string;
  source: 'manual' | 'import';
  createdAt: string;
}

const normalizeValue = (value?: string) => (value || '').trim().toLowerCase();
const GLOBAL_SCOPE = 'global';

export const buildIgnoredEntryKey = (query?: string, url?: string, scope?: string) =>
  `${normalizeValue(scope || GLOBAL_SCOPE)}::${normalizeValue(query)}||${normalizeValue(url)}`;

const buildLegacyIgnoredEntryKey = (query?: string, url?: string) =>
  `${normalizeValue(query)}||${normalizeValue(url)}`;

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, '').trim());
};

const parseImportedEntries = (content: string): SeoIgnoredEntry[] => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const rows = lines.map(parseCsvLine);
  const [firstRow, ...restRows] = rows;
  const normalizedHeader = firstRow.map((cell) => normalizeValue(cell));
  const hasHeader = normalizedHeader.includes('query') || normalizedHeader.includes('url');
  const dataRows = hasHeader ? restRows : rows;
  const queryIndex = hasHeader ? normalizedHeader.indexOf('query') : 0;
  const urlIndex = hasHeader ? normalizedHeader.indexOf('url') : 1;

  return dataRows
    .map((cells) => ({
      query: cells[queryIndex] || '',
      url: cells[urlIndex] || '',
    }))
    .filter((entry) => entry.query || entry.url)
    .map((entry) => ({
      key: buildIgnoredEntryKey(entry.query, entry.url),
      query: entry.query,
      url: entry.url,
      source: 'import' as const,
      createdAt: new Date().toISOString(),
    }));
};

export const useSeoIgnoredItems = () => {
  const [entries, setEntries] = useState<SeoIgnoredEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setEntries(parsed.filter((item) => item?.key));
      }
    } catch (error) {
      console.warn('Could not parse ignored SEO entries', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const ignoredKeys = useMemo(() => new Set(entries.map((entry) => entry.key)), [entries]);
  const ignoredByQueryOnly = useMemo(
    () => new Set(entries.filter((entry) => entry.query && !entry.url && !entry.scope).map((entry) => normalizeValue(entry.query))),
    [entries],
  );
  const ignoredByUrlOnly = useMemo(
    () => new Set(entries.filter((entry) => entry.url && !entry.query && !entry.scope).map((entry) => normalizeValue(entry.url))),
    [entries],
  );

  const isIgnored = useCallback(
    (row: Pick<GSCRow, 'keys'>, scope?: string) => {
      const query = row.keys?.[0] || '';
      const url = row.keys?.[1] || '';
      const normalizedQuery = normalizeValue(query);
      const normalizedUrl = normalizeValue(url);
      const scopedKey = buildIgnoredEntryKey(query, url, scope);
      const globalKey = buildIgnoredEntryKey(query, url);
      const legacyGlobalKey = buildLegacyIgnoredEntryKey(query, url);

      return (
        ignoredKeys.has(scopedKey) ||
        ignoredKeys.has(globalKey) ||
        ignoredKeys.has(legacyGlobalKey) ||
        (Boolean(normalizedQuery) && ignoredByQueryOnly.has(normalizedQuery)) ||
        (Boolean(normalizedUrl) && ignoredByUrlOnly.has(normalizedUrl))
      );
    },
    [ignoredByQueryOnly, ignoredByUrlOnly, ignoredKeys],
  );

  const ignoreEntry = useCallback((query: string, url: string, options?: { scope?: string; source?: SeoIgnoredEntry['source'] }) => {
    const key = buildIgnoredEntryKey(query, url, options?.scope);

    setEntries((current) => {
      if (current.some((entry) => entry.key === key)) {
        return current;
      }

      return [
        {
          key,
          query,
          url,
          scope: options?.scope,
          source: options?.source || 'manual',
          createdAt: new Date().toISOString(),
        },
        ...current,
      ];
    });
  }, []);

  const ignoreRow = useCallback((row: Pick<GSCRow, 'keys'>, scope?: string) => {
    const query = row.keys?.[0] || '';
    const url = row.keys?.[1] || '';
    ignoreEntry(query, url, { scope, source: 'manual' });
  }, [ignoreEntry]);

  const unignoreKey = useCallback((key: string) => {
    setEntries((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const importEntries = useCallback((content: string) => {
    const parsedEntries = parseImportedEntries(content);

    setEntries((current) => {
      const merged = new Map(current.map((entry) => [entry.key, entry]));
      parsedEntries.forEach((entry) => merged.set(entry.key, entry));
      return Array.from(merged.values());
    });

    return parsedEntries.length;
  }, []);

  return {
    entries,
    ignoredKeys,
    isIgnored,
    ignoreEntry,
    ignoreRow,
    unignoreKey,
    importEntries,
  };
};
