import * as XLSX from 'xlsx';

const CHECKLIST_CLUSTER_SHEET_NAME = 'Clusterización (Intenciones)';
const BACKEND_STRATEGY_SHEET_NAME = 'Estrategia';
const BACKEND_URLS_SHEET_NAME = 'URLs';

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
const BACKEND_PARENT_COLUMN = 'Padre';
const BACKEND_RANK_COLUMN = 'Rank';
const BACKEND_URL_COLUMN = 'URL';

const splitSerpUrls = (value: unknown) =>
  String(value || '')
    .split(/\r?\n|\s\|\s|\||,\s*/)
    .map((url) => url.trim())
    .filter(Boolean);

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const findHeaderIndex = (headers: string[], label: string) =>
  headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(label));

const getCell = (row: unknown[], index: number) => (index >= 0 ? row[index] : '');

const setCell = (row: unknown[], index: number, value: unknown) => {
  if (index >= 0) row[index] = value;
};

const toRows = (sheet?: XLSX.WorkSheet) =>
  sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) : [];

const hasHeaders = (rows: unknown[][], requiredHeaders: string[]) => {
  const headers = (rows[0] || []).map((header) => String(header));
  return requiredHeaders.every((header) => findHeaderIndex(headers, header) >= 0);
};

type KeywordRecord = { row: unknown[]; keyword: string; urls: string[]; originalIndex: number };

const groupRecordsByTopUrls = (records: KeywordRecord[]) => {
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
      if (owner === undefined) urlOwners.set(url, index);
      else union(owner, index);
    });
  });

  const grouped = new Map<number, KeywordRecord[]>();
  records.forEach((record, index) => {
    const root = find(index);
    const group = grouped.get(root) || [];
    group.push(record);
    grouped.set(root, group);
  });

  return [...grouped.values()].sort((a, b) => a[0].originalIndex - b[0].originalIndex);
};

const buildChecklistWorkbook = (workbook: XLSX.WorkBook, topUrlLimit: number) => {
  const sheetName = workbook.SheetNames.includes(CHECKLIST_CLUSTER_SHEET_NAME)
    ? CHECKLIST_CLUSTER_SHEET_NAME
    : workbook.SheetNames.find((name) => name.toLowerCase().includes('cluster')) ||
      workbook.SheetNames[0];
  const rows = toRows(workbook.Sheets[sheetName]);
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

  const records: KeywordRecord[] = [];
  let activeParentUrls: string[] = [];

  rows.slice(1).forEach((rawRow, offset) => {
    const row = [...rawRow];
    const role = String(getCell(row, roleIndex)).trim().toUpperCase();
    const urls = splitSerpUrls(getCell(row, urlsIndex)).slice(0, topUrlLimit);
    if (role === 'PADRE') activeParentUrls = urls;
    const inheritedUrls = urls.length > 0 ? urls : activeParentUrls;
    const keyword = String(getCell(row, keywordIndex) || getCell(row, parentKeywordIndex)).trim();
    if (!keyword) return;
    setCell(row, urlsIndex, inheritedUrls.join('\n'));
    records.push({ row, keyword, urls: inheritedUrls, originalIndex: offset });
  });

  if (records.length === 0) {
    throw new Error('No se encontraron keywords válidas en el sheet de clusterización.');
  }

  const groups = groupRecordsByTopUrls(records);
  const ownedCount = groups.filter((group) =>
    group.some((record) => String(getCell(record.row, coverageIndex)).toUpperCase() === 'OWNED'),
  ).length;
  const totalClusters = groups.length;
  const outputRows: unknown[][] = [];
  const dateTag = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);

  groups.forEach((group, groupIndex) => {
    const clusterId = `top${topUrlLimit}-${String(groupIndex + 1).padStart(4, '0')}`;
    const parentRecord =
      group.find((record) => String(getCell(record.row, roleIndex)).toUpperCase() === 'PADRE') ||
      group[0];
    const mergedUrls = [...new Set(group.flatMap((record) => record.urls))].slice(0, topUrlLimit);
    const coverage = group.some(
      (record) => String(getCell(record.row, coverageIndex)).toUpperCase() === 'OWNED',
    )
      ? 'OWNED'
      : 'OPPORTUNITY';

    group.forEach((record) => {
      const nextRow = [...record.row];
      setCell(nextRow, roleIndex, record === parentRecord ? 'PADRE' : 'VARIACIÓN');
      setCell(nextRow, parentKeywordIndex, parentRecord.keyword);
      setCell(nextRow, clusterIdIndex, clusterId);
      setCell(nextRow, coverageIndex, coverage);
      setCell(nextRow, urlsIndex, record === parentRecord ? mergedUrls.join('\n') : '');
      setCell(nextRow, runIdIndex, `sheet-top-${topUrlLimit}-${dateTag}`);
      setCell(nextRow, totalIndex, totalClusters);
      setCell(nextRow, ownedIndex, ownedCount);
      setCell(nextRow, opportunityIndex, totalClusters - ownedCount);
      outputRows.push(nextRow);
    });
  });

  const nextWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    nextWorkbook,
    XLSX.utils.aoa_to_sheet([headers, ...outputRows]),
    `Clusterización Top ${topUrlLimit}`,
  );
  return { workbook: nextWorkbook, totalClusters, totalKeywords: records.length };
};

const buildBackendStrategyWorkbook = (workbook: XLSX.WorkBook, topUrlLimit: number) => {
  const strategyRows = toRows(workbook.Sheets[BACKEND_STRATEGY_SHEET_NAME]);
  const urlsRows = toRows(workbook.Sheets[BACKEND_URLS_SHEET_NAME]);
  if (strategyRows.length < 2 || urlsRows.length < 2) {
    throw new Error('El workbook debe incluir las pestañas Estrategia y URLs con datos.');
  }

  const strategyHeaders = strategyRows[0].map((header) => String(header));
  const urlsHeaders = urlsRows[0].map((header) => String(header));
  const strategyClusterIndex = findHeaderIndex(strategyHeaders, CLUSTER_ID_COLUMN);
  const strategyRoleIndex = findHeaderIndex(strategyHeaders, CLUSTER_ROLE_COLUMN);
  const strategyKeywordIndex = findHeaderIndex(strategyHeaders, CLUSTER_KEYWORD_COLUMN);
  const urlsClusterIndex = findHeaderIndex(urlsHeaders, CLUSTER_ID_COLUMN);
  const urlsParentIndex = findHeaderIndex(urlsHeaders, BACKEND_PARENT_COLUMN);
  const urlsRankIndex = findHeaderIndex(urlsHeaders, BACKEND_RANK_COLUMN);
  const urlsUrlIndex = findHeaderIndex(urlsHeaders, BACKEND_URL_COLUMN);

  const missingColumns = [
    [strategyClusterIndex, `${BACKEND_STRATEGY_SHEET_NAME}.${CLUSTER_ID_COLUMN}`],
    [strategyRoleIndex, `${BACKEND_STRATEGY_SHEET_NAME}.${CLUSTER_ROLE_COLUMN}`],
    [strategyKeywordIndex, `${BACKEND_STRATEGY_SHEET_NAME}.${CLUSTER_KEYWORD_COLUMN}`],
    [urlsClusterIndex, `${BACKEND_URLS_SHEET_NAME}.${CLUSTER_ID_COLUMN}`],
    [urlsParentIndex, `${BACKEND_URLS_SHEET_NAME}.${BACKEND_PARENT_COLUMN}`],
    [urlsRankIndex, `${BACKEND_URLS_SHEET_NAME}.${BACKEND_RANK_COLUMN}`],
    [urlsUrlIndex, `${BACKEND_URLS_SHEET_NAME}.${BACKEND_URL_COLUMN}`],
  ]
    .filter(([index]) => Number(index) < 0)
    .map(([, label]) => label);
  if (missingColumns.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missingColumns.join(', ')}.`);
  }

  const topUrlsByCluster = new Map<string, string[]>();
  urlsRows.slice(1).forEach((row) => {
    const clusterId = String(getCell(row, urlsClusterIndex)).trim();
    const url = String(getCell(row, urlsUrlIndex)).trim();
    const rank = Number(getCell(row, urlsRankIndex)) || Number.MAX_SAFE_INTEGER;
    if (!clusterId || !url || rank > topUrlLimit) return;
    const urls = topUrlsByCluster.get(clusterId) || [];
    urls.push(url);
    topUrlsByCluster.set(clusterId, urls);
  });

  const records: KeywordRecord[] = [];
  strategyRows.slice(1).forEach((rawRow, offset) => {
    const row = [...rawRow];
    const keyword = String(getCell(row, strategyKeywordIndex)).trim();
    const clusterId = String(getCell(row, strategyClusterIndex)).trim();
    const urls = [...new Set(topUrlsByCluster.get(clusterId) || [])].slice(0, topUrlLimit);
    if (!keyword || urls.length === 0) return;
    records.push({ row, keyword, urls, originalIndex: offset });
  });

  if (records.length === 0) {
    throw new Error('No se encontraron keywords con URLs Top N en las pestañas Estrategia/URLs.');
  }

  const groups = groupRecordsByTopUrls(records);
  const sourceClusterToNext = new Map<string, { clusterId: string; parent: string }>();
  const outputStrategyRows: unknown[][] = [];

  groups.forEach((group, groupIndex) => {
    const clusterId = `top${topUrlLimit}-${String(groupIndex + 1).padStart(4, '0')}`;
    const parentRecord =
      group.find((record) => String(getCell(record.row, strategyRoleIndex)).toUpperCase() === 'PADRE') ||
      group[0];
    const parentKeyword = parentRecord.keyword;

    group.forEach((record) => {
      const nextRow = [...record.row];
      setCell(nextRow, strategyClusterIndex, clusterId);
      setCell(nextRow, strategyRoleIndex, record === parentRecord ? 'PADRE' : 'Variación');
      outputStrategyRows.push(nextRow);
      const sourceClusterId = String(getCell(record.row, strategyClusterIndex)).trim();
      if (sourceClusterId && !sourceClusterToNext.has(sourceClusterId)) {
        sourceClusterToNext.set(sourceClusterId, { clusterId, parent: parentKeyword });
      }
    });
  });

  const outputUrlRows = urlsRows.slice(1).flatMap((rawRow) => {
    const row = [...rawRow];
    const sourceClusterId = String(getCell(row, urlsClusterIndex)).trim();
    const mapping = sourceClusterToNext.get(sourceClusterId);
    const rank = Number(getCell(row, urlsRankIndex)) || Number.MAX_SAFE_INTEGER;
    if (!mapping || rank > topUrlLimit) return [];
    setCell(row, urlsClusterIndex, mapping.clusterId);
    setCell(row, urlsParentIndex, mapping.parent);
    return [row];
  });

  const nextWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    nextWorkbook,
    XLSX.utils.aoa_to_sheet([strategyHeaders, ...outputStrategyRows]),
    BACKEND_STRATEGY_SHEET_NAME,
  );
  XLSX.utils.book_append_sheet(
    nextWorkbook,
    XLSX.utils.aoa_to_sheet([urlsHeaders, ...outputUrlRows]),
    BACKEND_URLS_SHEET_NAME,
  );
  return { workbook: nextWorkbook, totalClusters: groups.length, totalKeywords: records.length };
};

export const buildTopSerpClusterWorkbook = (workbook: XLSX.WorkBook, topUrlLimit: number) => {
  const strategyRows = toRows(workbook.Sheets[BACKEND_STRATEGY_SHEET_NAME]);
  const urlsRows = toRows(workbook.Sheets[BACKEND_URLS_SHEET_NAME]);
  const hasBackendStrategyFormat =
    hasHeaders(strategyRows, [CLUSTER_ID_COLUMN, CLUSTER_ROLE_COLUMN, CLUSTER_KEYWORD_COLUMN]) &&
    hasHeaders(urlsRows, [
      CLUSTER_ID_COLUMN,
      BACKEND_PARENT_COLUMN,
      BACKEND_RANK_COLUMN,
      BACKEND_URL_COLUMN,
    ]);

  if (hasBackendStrategyFormat) return buildBackendStrategyWorkbook(workbook, topUrlLimit);

  return buildChecklistWorkbook(workbook, topUrlLimit);
};
