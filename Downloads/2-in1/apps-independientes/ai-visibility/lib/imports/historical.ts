import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { normalizeLanguage, normalizeModelLabel } from '@/lib/filters/normalization';
import { normalizeAnalysisMode, normalizeCaptureMethod, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';
import { normalizeRootDomain } from '@/lib/responses/citations';

export type ImportFileType = 'csv' | 'json';

export type HistoricalImportMapping = {
  projectColumn: string | null;
  promptColumn: string;
  modelColumn: string;
  responseColumn: string;
  citationsColumn: string | null;
  providerColumn?: string | null;
  surfaceColumn?: string | null;
  analysisModeColumn?: string | null;
  captureMethodColumn?: string | null;
  countryColumn?: string | null;
  languageColumn?: string | null;
};

export type HistoricalImportPayload = {
  fileContent: string;
  fileType: ImportFileType;
  mapping: HistoricalImportMapping;
};

export type HistoricalImportIssue = {
  row: number;
  field: 'project' | 'prompt' | 'model' | 'response' | 'citations' | 'row';
  message: string;
};

type ParsedRow = {
  rowNumber: number;
  values: Record<string, unknown>;
};

type NormalizedCitation = {
  sourceUrl: string;
  sourceDomain: string;
  title: string | null;
  snippet: string | null;
  position: number | null;
};

type ValidImportRow = {
  rowNumber: number;
  promptText: string;
  provider: string;
  surface: string;
  analysisMode: string;
  model: string;
  captureMethod: string;
  country: string | null;
  language: string | null;
  responseText: string;
  citations: NormalizedCitation[];
};

export type HistoricalImportPreview = {
  totalRows: number;
  validRows: number;
  promptCount: number;
  runCount: number;
  responseCount: number;
  citationCount: number;
  issues: HistoricalImportIssue[];
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

function parseCsvRows(content: string): ParsedRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line, offset) => {
    const cells = splitCsvLine(line);
    const values: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      values[header] = cells[index] ?? '';
    });

    return {
      rowNumber: offset + 2,
      values
    };
  });
}

function parseJsonRows(content: string): ParsedRow[] {
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('JSON imports must be an array of objects.');
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`JSON row ${index + 1} is not an object.`);
    }

    return {
      rowNumber: index + 1,
      values: entry as Record<string, unknown>
    };
  });
}

function parseRows(fileContent: string, fileType: ImportFileType): ParsedRow[] {
  return fileType === 'csv' ? parseCsvRows(fileContent) : parseJsonRows(fileContent);
}

function toTextValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return '';
}

function normalizeCitationEntry(raw: unknown, rowNumber: number, index: number, issues: HistoricalImportIssue[]): NormalizedCitation | null {
  if (typeof raw === 'string') {
    const sourceUrl = raw.trim();

    if (!sourceUrl) {
      return null;
    }

    const sourceDomain = normalizeRootDomain(sourceUrl);

    if (!sourceDomain) {
      issues.push({
        row: rowNumber,
        field: 'citations',
        message: `Citation ${index + 1} has an invalid URL/domain.`
      });
      return null;
    }

    return {
      sourceUrl,
      sourceDomain,
      title: null,
      snippet: null,
      position: index + 1
    };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push({
      row: rowNumber,
      field: 'citations',
      message: `Citation ${index + 1} must be a URL string or object.`
    });
    return null;
  }

  const citation = raw as Record<string, unknown>;
  const sourceUrl = toTextValue(citation.sourceUrl ?? citation.url ?? citation.href);
  const sourceDomain = toTextValue(citation.sourceDomain ?? citation.domain) || normalizeRootDomain(sourceUrl) || '';

  if (!sourceUrl || !sourceDomain) {
    issues.push({
      row: rowNumber,
      field: 'citations',
      message: `Citation ${index + 1} requires sourceUrl and sourceDomain (or a URL with a valid domain).`
    });
    return null;
  }

  const positionRaw = citation.position;
  const position = typeof positionRaw === 'number' && Number.isInteger(positionRaw) && positionRaw > 0 ? positionRaw : index + 1;

  return {
    sourceUrl,
    sourceDomain,
    title: toTextValue(citation.title) || null,
    snippet: toTextValue(citation.snippet) || null,
    position
  };
}

function parseCitations(value: unknown, rowNumber: number, issues: HistoricalImportIssue[]): NormalizedCitation[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  let entries: unknown[] = [];

  if (Array.isArray(value)) {
    entries = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        entries = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        issues.push({
          row: rowNumber,
          field: 'citations',
          message: 'Citations JSON is malformed.'
        });
        return [];
      }
    } else {
      entries = trimmed
        .split(/[\n|;,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } else if (typeof value === 'object') {
    entries = [value];
  } else {
    issues.push({
      row: rowNumber,
      field: 'citations',
      message: 'Unsupported citations format.'
    });
    return [];
  }

  return entries
    .map((entry, index) => normalizeCitationEntry(entry, rowNumber, index, issues))
    .filter((entry): entry is NormalizedCitation => Boolean(entry));
}

function validateAndNormalizeRows(projectId: string, parsedRows: ParsedRow[], mapping: HistoricalImportMapping): { rows: ValidImportRow[]; issues: HistoricalImportIssue[] } {
  const issues: HistoricalImportIssue[] = [];
  const rows: ValidImportRow[] = [];

  for (const row of parsedRows) {
    const promptText = toTextValue(row.values[mapping.promptColumn]);
    const analysisMode = normalizeAnalysisMode(mapping.analysisModeColumn ? toTextValue(row.values[mapping.analysisModeColumn]) : '') ?? 'other';
    const provider = normalizeProvider(mapping.providerColumn ? toTextValue(row.values[mapping.providerColumn]) : '') ?? (analysisMode === 'chatgpt' ? 'openai' : analysisMode === 'gemini' || analysisMode === 'ai_mode' || analysisMode === 'ai_overview' ? 'google' : 'other');
    const surface = normalizeSurface(mapping.surfaceColumn ? toTextValue(row.values[mapping.surfaceColumn]) : '') ?? (analysisMode === 'chatgpt' ? 'chatgpt' : analysisMode === 'gemini' ? 'gemini' : analysisMode === 'ai_mode' || analysisMode === 'ai_overview' ? 'google_search' : 'other');
    const model = normalizeModelLabel(toTextValue(row.values[mapping.modelColumn])) ?? (analysisMode === 'ai_mode' || analysisMode === 'ai_overview' ? 'unknown' : '');
    const captureMethod = normalizeCaptureMethod(mapping.captureMethodColumn ? toTextValue(row.values[mapping.captureMethodColumn]) : '') ?? 'manual_import';
    const country = (mapping.countryColumn ? toTextValue(row.values[mapping.countryColumn]).toUpperCase() : 'US') || null;
    const language = normalizeLanguage(mapping.languageColumn ? toTextValue(row.values[mapping.languageColumn]) : 'en') ?? 'en';
    const responseText = toTextValue(row.values[mapping.responseColumn]);

    if (mapping.projectColumn) {
      const projectValue = toTextValue(row.values[mapping.projectColumn]);
      if (!projectValue) {
        issues.push({ row: row.rowNumber, field: 'project', message: 'Project value is required for mapped project column.' });
      } else if (projectValue !== projectId) {
        issues.push({ row: row.rowNumber, field: 'project', message: `Project value \"${projectValue}\" does not match selected project.` });
      }
    }

    if (!promptText) {
      issues.push({ row: row.rowNumber, field: 'prompt', message: 'Prompt value is required.' });
    }

    if (!model) {
      issues.push({ row: row.rowNumber, field: 'model', message: 'Model value is required.' });
    }

    if (!responseText) {
      issues.push({ row: row.rowNumber, field: 'response', message: 'Response value is required.' });
    }

    const citations = mapping.citationsColumn ? parseCitations(row.values[mapping.citationsColumn], row.rowNumber, issues) : [];

    if (!promptText || !model || !responseText || !analysisMode) {
      continue;
    }

    rows.push({
      rowNumber: row.rowNumber,
      promptText,
      provider,
      surface,
      analysisMode,
      model,
      captureMethod,
      country,
      language,
      responseText,
      citations
    });
  }

  return { rows, issues };
}

export async function previewHistoricalImport(projectId: string, payload: HistoricalImportPayload): Promise<HistoricalImportPreview> {
  const parsedRows = parseRows(payload.fileContent, payload.fileType);
  const { rows, issues } = validateAndNormalizeRows(projectId, parsedRows, payload.mapping);
  const promptSet = new Set(rows.map((row) => row.promptText.toLowerCase()));

  return {
    totalRows: parsedRows.length,
    validRows: issues.length > 0 ? 0 : rows.length,
    promptCount: issues.length > 0 ? 0 : promptSet.size,
    runCount: issues.length > 0 ? 0 : rows.length,
    responseCount: issues.length > 0 ? 0 : rows.length,
    citationCount: issues.length > 0 ? 0 : rows.reduce((total, row) => total + row.citations.length, 0),
    issues
  };
}

export async function commitHistoricalImport(projectId: string, userId: string | null, payload: HistoricalImportPayload): Promise<HistoricalImportPreview> {
  const parsedRows = parseRows(payload.fileContent, payload.fileType);
  const { rows, issues } = validateAndNormalizeRows(projectId, parsedRows, payload.mapping);

  if (issues.length > 0) {
    return {
      totalRows: parsedRows.length,
      validRows: 0,
      promptCount: 0,
      runCount: 0,
      responseCount: 0,
      citationCount: 0,
      issues
    };
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const promptCache = new Map<string, string>();

    const existingPrompts = await tx.prompt.findMany({
      where: {
        projectId,
        deletedAt: null,
        promptText: { in: Array.from(new Set(rows.map((row) => row.promptText))) }
      },
      select: { id: true, promptText: true }
    });

    for (const prompt of existingPrompts) {
      promptCache.set(prompt.promptText, prompt.id);
    }

    for (const row of rows) {
      let promptId = promptCache.get(row.promptText);

      if (!promptId) {
        const createdPrompt = await tx.prompt.create({
          data: {
            projectId,
            createdByUserId: userId,
            title: row.promptText.slice(0, 80),
            promptText: row.promptText,
            country: 'US',
            language: 'en',
            isActive: true,
            priority: 100,
            status: 'ACTIVE'
          },
          select: { id: true }
        });

        promptId = createdPrompt.id;
        promptCache.set(row.promptText, promptId as string);
      }

      if (!promptId) {
        throw new Error(`Unable to resolve prompt for row ${row.rowNumber}.`);
      }

      const run = await tx.run.create({
        data: {
          projectId,
          promptId,
          triggeredByUserId: userId,
          status: 'SUCCEEDED',
          triggerType: 'IMPORT',
          source: 'IMPORT_FILE',
          provider: row.provider,
          surface: row.surface,
          analysisMode: row.analysisMode,
          model: row.model,
          captureMethod: row.captureMethod,
          environment: 'import',
          country: row.country,
          language: row.language,
          parserVersion: 'v1',
          importBatchKey: `import-${Date.now()}`,
          executedAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date()
        },
        select: { id: true }
      });

      const response = await tx.response.create({
        data: {
          runId: run.id,
          ordinal: 1,
          rawText: row.responseText,
          cleanedText: row.responseText,
          status: 'SUCCEEDED',
          mentionDetected: false,
          isError: false
        },
        select: { id: true }
      });

      if (row.citations.length > 0) {
        await tx.citation.createMany({
          data: row.citations.map((citation) => ({
            responseId: response.id,
            sourceUrl: citation.sourceUrl,
            sourceDomain: citation.sourceDomain,
            title: citation.title,
            snippet: citation.snippet,
            position: citation.position
          }))
        });
      }
    }
  });

  const promptCount = new Set(rows.map((row) => row.promptText.toLowerCase())).size;

  return {
    totalRows: parsedRows.length,
    validRows: rows.length,
    promptCount,
    runCount: rows.length,
    responseCount: rows.length,
    citationCount: rows.reduce((total, row) => total + row.citations.length, 0),
    issues: []
  };
}
