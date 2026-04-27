import * as XLSX from 'xlsx';

import type { ExportTable } from '@/lib/exports/types';

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

export function buildCsvBuffer(table: ExportTable): Buffer {
  const header = table.columns.map((column) => escapeCsvCell(column.label)).join(',');
  const lines = table.rows.map((row) =>
    table.columns.map((column) => escapeCsvCell(normalizeCell(row[column.key]))).join(',')
  );

  return Buffer.from([header, ...lines].join('\n'), 'utf-8');
}

export function buildXlsxBuffer(table: ExportTable): Buffer {
  const rows = table.rows.map((row) => {
    const result: Record<string, string | number | boolean | null> = {};

    for (const column of table.columns) {
      result[column.label] = row[column.key] ?? null;
    }

    return result;
  });

  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: table.columns.map((column) => column.label)
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Export');

  const output = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  return Buffer.from(output);
}
