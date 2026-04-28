import * as XLSX from 'xlsx';

import type { ExportArtifact, ExportTable } from '@/lib/exports/types';
import { isReportExportPack } from '@/lib/exports/types';

function normalizeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function tableToRows(table: ExportTable): Record<string, string | number | boolean | null>[] {
  return table.rows.map((row) => {
    const result: Record<string, string | number | boolean | null> = {};

    for (const column of table.columns) {
      result[column.label] = row[column.key] ?? null;
    }

    return result;
  });
}

function toSheetName(sectionName: string | undefined, fallback: string): string {
  return (sectionName ?? fallback).slice(0, 31);
}

export function buildCsvBuffer(payload: ExportArtifact): Buffer {
  if (!isReportExportPack(payload)) {
    const header = payload.columns.map((column) => escapeCsvCell(column.label)).join(',');
    const lines = payload.rows.map((row) =>
      payload.columns.map((column) => escapeCsvCell(normalizeCell(row[column.key]))).join(',')
    );

    return Buffer.from([header, ...lines].join('\n'), 'utf-8');
  }

  const parts: string[] = [];
  for (const section of payload.sections) {
    parts.push(`# section=${section.sectionName ?? section.dataset}`);
    const header = section.columns.map((column) => escapeCsvCell(column.label)).join(',');
    const lines = section.rows.map((row) =>
      section.columns.map((column) => escapeCsvCell(normalizeCell(row[column.key]))).join(',')
    );
    parts.push(header, ...lines, '');
  }

  if (payload.narrativeInsights.length > 0) {
    parts.push('# section=narrative_insights_draft');
    parts.push('area,bullet,metrics_json');
    for (const insight of payload.narrativeInsights) {
      parts.push(
        [
          escapeCsvCell(insight.area),
          escapeCsvCell(insight.bullet),
          escapeCsvCell(JSON.stringify(insight.metrics))
        ].join(',')
      );
    }
  }

  return Buffer.from(parts.join('\n'), 'utf-8');
}

export function buildXlsxBuffer(payload: ExportArtifact): Buffer {
  const workbook = XLSX.utils.book_new();

  if (!isReportExportPack(payload)) {
    const sheet = XLSX.utils.json_to_sheet(tableToRows(payload), {
      header: payload.columns.map((column) => column.label)
    });
    XLSX.utils.book_append_sheet(workbook, sheet, toSheetName(payload.sectionName, 'Export'));
  } else {
    for (const section of payload.sections) {
      const sheet = XLSX.utils.json_to_sheet(tableToRows(section), {
        header: section.columns.map((column) => column.label)
      });
      XLSX.utils.book_append_sheet(workbook, sheet, toSheetName(section.sectionName, section.dataset));
    }

    if (payload.narrativeInsights.length > 0) {
      const rows = payload.narrativeInsights.map((item) => ({
        area: item.area,
        bullet: item.bullet,
        metrics_json: JSON.stringify(item.metrics)
      }));
      const sheet = XLSX.utils.json_to_sheet(rows, {
        header: ['area', 'bullet', 'metrics_json']
      });
      XLSX.utils.book_append_sheet(workbook, sheet, 'narrative_draft');
    }
  }

  const output = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  return Buffer.from(output);
}
