import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildTopSerpClusterWorkbook } from './serpClusterSheet';

const sheetRows = (workbook: XLSX.WorkBook, sheetName: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });

describe('buildTopSerpClusterWorkbook', () => {
  it('reclusters backend Estrategia final + Historial SERP workbooks without falling back to legacy URLs sheets', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [
          'Cluster ID',
          'Keyword principal',
          'Variaciones',
          'Nº keywords',
          'Intención',
          'Cobertura',
          'URLs SERP principales',
          'Nº URLs SERP',
          'Títulos SERP principales',
        ],
        [
          'G-001',
          'keyword padre',
          '1. keyword hija\n2. keyword aislada',
          3,
          'Informacional',
          'OPPORTUNITY',
          '1. https://serp.test/a\n2. https://serp.test/b',
          2,
          '1. A\n2. B',
        ],
      ]),
      'Estrategia final',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Cluster ID', 'Keyword', 'Tipo keyword', 'Rank', 'URL', 'Título'],
        ['G-001', 'keyword padre', 'Principal', 1, 'https://serp.test/a', 'A'],
        ['G-001', 'keyword padre', 'Principal', 2, 'https://serp.test/b', 'B'],
        ['G-001', 'keyword hija', 'Variación', 1, 'https://serp.test/a', 'A'],
        ['G-001', 'keyword hija', 'Variación', 2, 'https://serp.test/c', 'C'],
        ['G-001', 'keyword aislada', 'Variación', 1, 'https://other.test/x', 'X'],
      ]),
      'Historial SERP',
    );

    const result = buildTopSerpClusterWorkbook(workbook, 2);

    expect(result.totalKeywords).toBe(3);
    expect(result.totalClusters).toBe(2);
    expect(result.workbook.SheetNames).toEqual(['Estrategia final', 'Historial SERP']);

    const finalRows = sheetRows(result.workbook, 'Estrategia final');
    expect(finalRows[0]).toEqual([
      'Cluster ID',
      'Keyword principal',
      'Variaciones',
      'Nº keywords',
      'Intención',
      'Cobertura',
      'URLs SERP principales',
      'Nº URLs SERP',
      'Títulos SERP principales',
    ]);
    expect(finalRows[1][1]).toBe('keyword padre');
    expect(finalRows[1][2]).toBe('1. keyword hija');
    expect(finalRows[1][6]).toContain('https://serp.test/a');
    expect(finalRows[2][1]).toBe('keyword aislada');

    const historyRows = sheetRows(result.workbook, 'Historial SERP');
    expect(historyRows[0]).toEqual(['Cluster ID', 'Keyword', 'Tipo keyword', 'Rank', 'URL', 'Título']);
    expect(historyRows.some((row) => row[1] === 'keyword hija' && row[2] === 'Variación')).toBe(true);
  });
});
