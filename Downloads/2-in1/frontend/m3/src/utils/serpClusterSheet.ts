import * as XLSX from 'xlsx';

const CLUSTER_SHEET_NAME = 'Clusterización (Intenciones)';
const CLUSTER_URLS_COLUMN = 'URLs SERP';
const CLUSTER_ROLE_COLUMN = 'Rol';
const CLUSTER_KEYWORD_COLUMN = 'Keyword';
const CLUSTER_PARENT_KEYWORD_COLUMN = 'KW Objetivo (PADRE)';
const CLUSTER_ID_COLUMN = 'Cluster ID';
const CLUSTER_COVERAGE_COLUMN = 'Cobertura';
const CLUSTER_RUN_ID_COLUMN = 'RunId';
const CLUSTER_TOTAL_COLUMN = 'Total Clusters';
const CLUSTER_OWNED_COLUMN = 'Owned Clusters';
const CLUSTER_OPPORTUNITY_COLUMN = 'Opportunity Clusters';

const splitSerpUrls = (value: unknown) =>
  String(value || '')
    .split(/\r?\n|\s\|\s|\|/)
    .map((url) => url.trim())
    .filter(Boolean);

const findHeaderIndex = (headers: string[], label: string) =>
  headers.findIndex((header) => header.trim().toLowerCase() === label.toLowerCase());

export const buildTopSerpClusterWorkbook = (workbook: XLSX.WorkBook, topUrlLimit: number) => {
  const sheetName = workbook.SheetNames.includes(CLUSTER_SHEET_NAME)
    ? CLUSTER_SHEET_NAME
    : workbook.SheetNames.find((name) => name.toLowerCase().includes('cluster')) ||
      workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (rows.length < 2) {
    throw new Error('El sheet no contiene filas de clusterización para reprocesar.');
  }

  const headers = rows[0].map((header) => String(header));
  const requiredColumns = [CLUSTER_KEYWORD_COLUMN, CLUSTER_URLS_COLUMN, CLUSTER_ROLE_COLUMN];
  const missingColumns = requiredColumns.filter(
    (column) => findHeaderIndex(headers, column) === -1,
  );
  if (missingColumns.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missingColumns.join(', ')}.`);
  }

  const roleIndex = findHeaderIndex(headers, CLUSTER_ROLE_COLUMN);
  const keywordIndex = findHeaderIndex(headers, CLUSTER_KEYWORD_COLUMN);
  const parentKeywordIndex = findHeaderIndex(headers, CLUSTER_PARENT_KEYWORD_COLUMN);
  const urlsIndex = findHeaderIndex(headers, CLUSTER_URLS_COLUMN);
  const clusterIdIndex = findHeaderIndex(headers, CLUSTER_ID_COLUMN);
  const coverageIndex = findHeaderIndex(headers, CLUSTER_COVERAGE_COLUMN);
  const runIdIndex = findHeaderIndex(headers, CLUSTER_RUN_ID_COLUMN);
  const totalIndex = findHeaderIndex(headers, CLUSTER_TOTAL_COLUMN);
  const ownedIndex = findHeaderIndex(headers, CLUSTER_OWNED_COLUMN);
  const opportunityIndex = findHeaderIndex(headers, CLUSTER_OPPORTUNITY_COLUMN);

  type KeywordRecord = { row: unknown[]; keyword: string; urls: string[]; originalIndex: number };
  const records: KeywordRecord[] = [];
  let activeParentUrls: string[] = [];

  rows.slice(1).forEach((rawRow, offset) => {
    const row = [...rawRow];
    const role = String(row[roleIndex] || '')
      .trim()
      .toUpperCase();
    const urls = splitSerpUrls(row[urlsIndex]).slice(0, topUrlLimit);
    if (role === 'PADRE') {
      activeParentUrls = urls;
    }
    const inheritedUrls = urls.length > 0 ? urls : activeParentUrls;
    const keyword = String(row[keywordIndex] || row[parentKeywordIndex] || '').trim();
    if (!keyword) return;
    row[urlsIndex] = inheritedUrls.join('\n');
    records.push({ row, keyword, urls: inheritedUrls, originalIndex: offset });
  });

  if (records.length === 0) {
    throw new Error('No se encontraron keywords válidas en el sheet de clusterización.');
  }

  const parent = records.map((_, index) => index);
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (left: number, right: number) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
  };

  const urlOwners = new Map<string, number>();
  records.forEach((record, index) => {
    new Set(record.urls).forEach((url) => {
      const owner = urlOwners.get(url);
      if (owner === undefined) {
        urlOwners.set(url, index);
      } else {
        union(owner, index);
      }
    });
  });

  const grouped = new Map<number, KeywordRecord[]>();
  records.forEach((record, index) => {
    const root = find(index);
    const group = grouped.get(root) || [];
    group.push(record);
    grouped.set(root, group);
  });

  const groups = [...grouped.values()].sort((a, b) => a[0].originalIndex - b[0].originalIndex);
  const ownedCount = groups.filter((group) =>
    group.some((record) => String(record.row[coverageIndex] || '').toUpperCase() === 'OWNED'),
  ).length;
  const totalClusters = groups.length;
  const outputRows: unknown[][] = [];
  const dateTag = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 12);

  groups.forEach((group, groupIndex) => {
    const clusterId = `top${topUrlLimit}-${String(groupIndex + 1).padStart(4, '0')}`;
    const parentRecord =
      group.find((record) => String(record.row[roleIndex]).toUpperCase() === 'PADRE') || group[0];
    const mergedUrls = [...new Set(group.flatMap((record) => record.urls))].slice(0, topUrlLimit);
    const coverage = group.some(
      (record) => String(record.row[coverageIndex] || '').toUpperCase() === 'OWNED',
    )
      ? 'OWNED'
      : 'OPPORTUNITY';

    group.forEach((record) => {
      const nextRow = [...record.row];
      nextRow[roleIndex] = record === parentRecord ? 'PADRE' : 'VARIACIÓN';
      if (parentKeywordIndex >= 0) nextRow[parentKeywordIndex] = parentRecord.keyword;
      if (clusterIdIndex >= 0) nextRow[clusterIdIndex] = clusterId;
      if (coverageIndex >= 0) nextRow[coverageIndex] = coverage;
      if (urlsIndex >= 0) nextRow[urlsIndex] = record === parentRecord ? mergedUrls.join('\n') : '';
      if (runIdIndex >= 0) nextRow[runIdIndex] = `sheet-top-${topUrlLimit}-${dateTag}`;
      if (totalIndex >= 0) nextRow[totalIndex] = totalClusters;
      if (ownedIndex >= 0) nextRow[ownedIndex] = ownedCount;
      if (opportunityIndex >= 0) nextRow[opportunityIndex] = totalClusters - ownedCount;
      outputRows.push(nextRow);
    });
  });

  const nextWorkbook = XLSX.utils.book_new();
  const nextSheet = XLSX.utils.aoa_to_sheet([headers, ...outputRows]);
  XLSX.utils.book_append_sheet(nextWorkbook, nextSheet, `Clusterización Top ${topUrlLimit}`);
  return { workbook: nextWorkbook, totalClusters, totalKeywords: records.length };
};
