'use client';

import { ChangeEvent, useMemo, useState } from 'react';

import { useProjectContext } from '@/components/projects/project-context';

type FileType = 'csv' | 'json';

type ColumnMapping = {
  projectColumn: string;
  promptColumn: string;
  modelColumn: string;
  responseColumn: string;
  citationsColumn: string;
};

type PreviewIssue = {
  row: number;
  field: string;
  message: string;
};

type PreviewResult = {
  totalRows: number;
  validRows: number;
  promptCount: number;
  runCount: number;
  responseCount: number;
  citationCount: number;
  issues: PreviewIssue[];
};

const EMPTY_MAPPING: ColumnMapping = {
  projectColumn: '',
  promptColumn: '',
  modelColumn: '',
  responseColumn: '',
  citationsColumn: ''
};

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function inferHeaders(content: string, fileType: FileType): string[] {
  if (fileType === 'csv') {
    const firstLine = content
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .find((line) => line.length > 0);

    return firstLine ? splitCsvLine(firstLine) : [];
  }

  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }

  const firstObject = parsed.find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as Record<string, unknown> | undefined;
  return firstObject ? Object.keys(firstObject) : [];
}

function guessColumn(headers: string[], aliases: string[]): string {
  const normalized = headers.map((header) => ({ header, normalized: header.trim().toLowerCase() }));
  const byExact = normalized.find((entry) => aliases.includes(entry.normalized));

  if (byExact) {
    return byExact.header;
  }

  const byContains = normalized.find((entry) => aliases.some((alias) => entry.normalized.includes(alias)));
  return byContains?.header ?? '';
}

export function HistoricalImporter({ onImported }: { onImported: () => Promise<void> | void }) {
  const { currentProjectId } = useProjectContext();
  const [fileType, setFileType] = useState<FileType>('csv');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canPreview = useMemo(
    () => Boolean(currentProjectId && fileContent && mapping.promptColumn && mapping.modelColumn && mapping.responseColumn),
    [currentProjectId, fileContent, mapping.modelColumn, mapping.promptColumn, mapping.responseColumn]
  );

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextFileType: FileType = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    const content = await file.text();

    setFileType(nextFileType);
    setFileName(file.name);
    setFileContent(content);
    setPreview(null);
    setStatusMessage(null);

    try {
      const nextHeaders = inferHeaders(content, nextFileType);
      setHeaders(nextHeaders);
      setMapping({
        projectColumn: guessColumn(nextHeaders, ['project', 'projectid', 'project_id']),
        promptColumn: guessColumn(nextHeaders, ['prompt', 'prompttext', 'prompt_text', 'query']),
        modelColumn: guessColumn(nextHeaders, ['model', 'llm', 'engine']),
        responseColumn: guessColumn(nextHeaders, ['response', 'answer', 'output', 'rawtext', 'raw_text']),
        citationsColumn: guessColumn(nextHeaders, ['citations', 'sources', 'links', 'urls'])
      });
    } catch {
      setHeaders([]);
      setMapping(EMPTY_MAPPING);
      setStatusMessage('Unable to parse file headers. Verify CSV/JSON format.');
    }
  }

  async function runImport(mode: 'preview' | 'commit') {
    if (!currentProjectId) {
      return;
    }

    setBusy(true);
    setStatusMessage(null);

    const response = await fetch(`/api/projects/${currentProjectId}/imports/historical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        fileType,
        fileContent,
        mapping
      })
    });

    const data = (await response.json()) as {
      preview?: PreviewResult;
      committed?: PreviewResult;
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      setPreview(data.preview ?? null);
      setStatusMessage(data.message ?? 'Import failed. Review row errors and try again.');
      setBusy(false);
      return;
    }

    if (mode === 'preview') {
      setPreview(data.preview ?? null);
      setStatusMessage(data.preview?.issues.length ? 'Preview completed with errors.' : 'Preview completed successfully.');
    } else {
      setPreview(data.committed ?? null);
      setStatusMessage('Historical import committed successfully.');
      await onImported();
    }

    setBusy(false);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-semibold text-slate-900">Historical data import</h2>
      <p className="mt-1 text-xs text-slate-600">Upload CSV or JSON, map fields, run a preview, then commit when all rows are valid.</p>

      <div className="mt-3 grid gap-2 md:grid-cols-[1.8fr_1fr]">
        <input accept=".csv,.json,application/json,text/csv" className="rounded border border-slate-300 px-2 py-1 text-xs" onChange={(event) => void onFileSelected(event)} type="file" />
        <input className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600" disabled value={fileName || 'No file selected'} />
      </div>

      {headers.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            { key: 'projectColumn', label: 'Project column (optional)', optional: true },
            { key: 'promptColumn', label: 'Prompt column', optional: false },
            { key: 'modelColumn', label: 'Model column', optional: false },
            { key: 'responseColumn', label: 'Response column', optional: false },
            { key: 'citationsColumn', label: 'Citations column (optional)', optional: true }
          ].map((field) => (
            <label className="space-y-1 text-xs text-slate-700" key={field.key}>
              <span>{field.label}</span>
              <select
                className="w-full rounded border border-slate-300 px-2 py-1"
                onChange={(event) =>
                  setMapping((current) => ({
                    ...current,
                    [field.key]: event.target.value
                  }))
                }
                value={mapping[field.key as keyof ColumnMapping]}
              >
                <option value="">{field.optional ? 'None' : 'Select column'}</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" disabled={!canPreview || busy} onClick={() => void runImport('preview')} type="button">
          {busy ? 'Working…' : 'Preview import'}
        </button>
        <button
          className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          disabled={!preview || preview.issues.length > 0 || busy}
          onClick={() => void runImport('commit')}
          type="button"
        >
          Commit import
        </button>
      </div>

      {statusMessage ? <p className="mt-2 text-xs text-slate-700">{statusMessage}</p> : null}

      {preview ? (
        <div className="mt-3 space-y-2 text-xs text-slate-700">
          <p>
            Rows: {preview.totalRows} · Valid: {preview.validRows} · Prompts: {preview.promptCount} · Runs: {preview.runCount} · Responses: {preview.responseCount} · Citations: {preview.citationCount}
          </p>

          {preview.issues.length > 0 ? (
            <div className="max-h-48 overflow-auto rounded border border-red-200 bg-red-50 p-2">
              <p className="font-medium text-red-800">Validation errors ({preview.issues.length})</p>
              <ul className="mt-1 space-y-1 text-red-700">
                {preview.issues.slice(0, 50).map((issue, index) => (
                  <li key={`${issue.row}-${issue.field}-${index}`}>
                    Row {issue.row} · {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">No validation errors found. You can commit this import.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
