import * as XLSX from 'xlsx';

const CHECKLIST_CLUSTER_SHEET_NAME = 'Clusterización (Intenciones)';
const FINAL_STRATEGY_SHEET_NAME = 'Estrategia final';
const SERP_HISTORY_SHEET_NAME = 'Historial SERP';
const BACKEND_STRATEGY_SHEET_NAME = 'Estrategia';
const BACKEND_URLS_SHEET_NAME = 'URLs';

const FINAL_KEYWORD_COLUMN = 'Keyword principal';
const FINAL_VARIATIONS_COLUMN = 'Variaciones';
const FINAL_INTENT_COLUMN = 'Intención';
const FINAL_COVERAGE_COLUMN = 'Cobertura';
const FINAL_SERP_URLS_COLUMN = 'URLs SERP principales';
const FINAL_SERP_TITLES_COLUMN = 'Títulos SERP principales';
const FINAL_KEYWORD_COUNT_COLUMN = 'Nº keywords';
const FINAL_SERP_URL_COUNT_COLUMN = 'Nº URLs SERP';
const HISTORY_KEYWORD_COLUMN = 'Keyword';
const HISTORY_KEYWORD_TYPE_COLUMN = 'Tipo keyword';
const HISTORY_RANK_COLUMN = 'Rank';
const HISTORY_URL_COLUMN = 'URL';
const HISTORY_TITLE_COLUMN = 'Título';
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

const cleanList = (values: unknown[]) => {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(text);
  });
  return cleaned;
};

const numberedTextToList = (value: unknown) => {
  const text = String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return [];
  return cleanList(
    text
      .replace(/(?!^)\s+(?=\d+[.)]\s+)/g, '\n')
      .split('\n')
      .flatMap((rawLine) => {
        const line = rawLine
          .trim()
          .replace(/^[•\-–—]\s*/, '')
          .replace(/^\d+[.)]\s*/, '')
          .trim();
        if (!line) return [];
        if (!/^https?:\/\//i.test(line) && /[,;]/.test(line)) {
          return line
            .split(/[,;]/)
            .map((part) => part.trim())
            .filter(Boolean);
        }
        return [line];
      }),
  );
};

const listToNumberedText = (values: unknown[]) =>
  cleanList(values)
    .map((value, index) => `${index + 1}. ${value}`)
    .join('\n');

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

const buildFinalStrategyWorkbook = (workbook: XLSX.WorkBook, topUrlLimit: number) => {
  const strategyRows = toRows(workbook.Sheets[FINAL_STRATEGY_SHEET_NAME]);
  const historyRows = toRows(workbook.Sheets[SERP_HISTORY_SHEET_NAME]);
  if (strategyRows.length < 2 || historyRows.length < 2) {
    throw new Error('El workbook debe incluir las pestañas Estrategia final e Historial SERP con datos.');
  }

  const strategyHeaders = strategyRows[0].map((header) => String(header));
  const historyHeaders = historyRows[0].map((header) => String(header));
  const strategyClusterIndex = findHeaderIndex(strategyHeaders, CLUSTER_ID_COLUMN);
  const strategyKeywordIndex = findHeaderIndex(strategyHeaders, FINAL_KEYWORD_COLUMN);
  const strategyVariationsIndex = findHeaderIndex(strategyHeaders, FINAL_VARIATIONS_COLUMN);
  const strategyIntentIndex = findHeaderIndex(strategyHeaders, FINAL_INTENT_COLUMN);
  const strategyCoverageIndex = findHeaderIndex(strategyHeaders, FINAL_COVERAGE_COLUMN);
  const historyClusterIndex = findHeaderIndex(historyHeaders, CLUSTER_ID_COLUMN);
  const historyKeywordIndex = findHeaderIndex(historyHeaders, HISTORY_KEYWORD_COLUMN);
  const historyRankIndex = findHeaderIndex(historyHeaders, HISTORY_RANK_COLUMN);
  const historyUrlIndex = findHeaderIndex(historyHeaders, HISTORY_URL_COLUMN);
  const historyTitleIndex = findHeaderIndex(historyHeaders, HISTORY_TITLE_COLUMN);

  const missingColumns = [
    [strategyClusterIndex, `${FINAL_STRATEGY_SHEET_NAME}.${CLUSTER_ID_COLUMN}`],
    [strategyKeywordIndex, `${FINAL_STRATEGY_SHEET_NAME}.${FINAL_KEYWORD_COLUMN}`],
    [strategyVariationsIndex, `${FINAL_STRATEGY_SHEET_NAME}.${FINAL_VARIATIONS_COLUMN}`],
    [historyClusterIndex, `${SERP_HISTORY_SHEET_NAME}.${CLUSTER_ID_COLUMN}`],
    [historyKeywordIndex, `${SERP_HISTORY_SHEET_NAME}.${HISTORY_KEYWORD_COLUMN}`],
    [historyRankIndex, `${SERP_HISTORY_SHEET_NAME}.${HISTORY_RANK_COLUMN}`],
    [historyUrlIndex, `${SERP_HISTORY_SHEET_NAME}.${HISTORY_URL_COLUMN}`],
  ]
    .filter(([index]) => Number(index) < 0)
    .map(([, label]) => label);
  if (missingColumns.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missingColumns.join(', ')}.`);
  }

  const strategyByCluster = new Map<
    string,
    { parent: string; variations: string[]; intent: string; coverage: string; order: number }
  >();
  strategyRows.slice(1).forEach((row, order) => {
    const clusterId = String(getCell(row, strategyClusterIndex)).trim();
    const parent = String(getCell(row, strategyKeywordIndex)).trim();
    if (!clusterId || !parent) return;
    strategyByCluster.set(clusterId, {
      parent,
      variations: numberedTextToList(getCell(row, strategyVariationsIndex)),
      intent: String(getCell(row, strategyIntentIndex)).trim(),
      coverage: String(getCell(row, strategyCoverageIndex)).trim(),
      order,
    });
  });

  const serpByClusterKeyword = new Map<string, Array<{ rank: number; url: string; title: string }>>();
  historyRows.slice(1).forEach((row) => {
    const clusterId = String(getCell(row, historyClusterIndex)).trim();
    const keyword = String(getCell(row, historyKeywordIndex)).trim();
    const rank = Number(getCell(row, historyRankIndex)) || Number.MAX_SAFE_INTEGER;
    const url = String(getCell(row, historyUrlIndex)).trim();
    const title = String(getCell(row, historyTitleIndex)).trim();
    if (!clusterId || !keyword || !url || rank > topUrlLimit) return;
    const key = `${clusterId}\u0000${keyword}`;
    const urls = serpByClusterKeyword.get(key) || [];
    urls.push({ rank, url, title });
    serpByClusterKeyword.set(key, urls);
  });

  const records: KeywordRecord[] = [];
  strategyByCluster.forEach((strategy, clusterId) => {
    [strategy.parent, ...strategy.variations].forEach((keyword, index) => {
      const serpRows = (serpByClusterKeyword.get(`${clusterId}\u0000${keyword}`) || [])
        .sort((left, right) => left.rank - right.rank)
        .slice(0, topUrlLimit);
      if (serpRows.length === 0) return;
      records.push({
        row: [clusterId, keyword, index === 0 ? 'Principal' : 'Variación', strategy.intent, strategy.coverage],
        keyword,
        urls: serpRows.map((serpRow) => serpRow.url),
        originalIndex: strategy.order * 1000 + index,
      });
    });
  });

  if (records.length === 0) {
    throw new Error('No se encontraron keywords con URLs Top N en Estrategia final/Historial SERP.');
  }

  const groups = groupRecordsByTopUrls(records);
  const finalHeaders = [
    CLUSTER_ID_COLUMN,
    FINAL_KEYWORD_COLUMN,
    FINAL_VARIATIONS_COLUMN,
    FINAL_KEYWORD_COUNT_COLUMN,
    FINAL_INTENT_COLUMN,
    FINAL_COVERAGE_COLUMN,
    FINAL_SERP_URLS_COLUMN,
    FINAL_SERP_URL_COUNT_COLUMN,
    FINAL_SERP_TITLES_COLUMN,
  ];
  const historyOutputHeaders = [
    CLUSTER_ID_COLUMN,
    HISTORY_KEYWORD_COLUMN,
    HISTORY_KEYWORD_TYPE_COLUMN,
    HISTORY_RANK_COLUMN,
    HISTORY_URL_COLUMN,
    HISTORY_TITLE_COLUMN,
  ];
  const finalRows: unknown[][] = [];
  const historyOutputRows: unknown[][] = [];

  groups.forEach((group, groupIndex) => {
    const clusterId = `top${topUrlLimit}-${String(groupIndex + 1).padStart(4, '0')}`;
    const parentRecord = group.find((record) => getCell(record.row, 2) === 'Principal') || group[0];
    const variations = group.filter((record) => record !== parentRecord).map((record) => record.keyword);
    const mergedUrls = cleanList(group.flatMap((record) => record.urls)).slice(0, topUrlLimit);
    const serpTitles = mergedUrls.map((url) => {
      for (const record of group) {
        const sourceClusterId = String(getCell(record.row, 0));
        const rows = serpByClusterKeyword.get(`${sourceClusterId}\u0000${record.keyword}`) || [];
        const match = rows.find((serpRow) => serpRow.url === url);
        if (match?.title) return match.title;
      }
      return '';
    });

    finalRows.push([
      clusterId,
      parentRecord.keyword,
      listToNumberedText(variations),
      1 + variations.length,
      getCell(parentRecord.row, 3),
      getCell(parentRecord.row, 4),
      listToNumberedText(mergedUrls),
      mergedUrls.length,
      listToNumberedText(serpTitles),
    ]);

    group.forEach((record) => {
      const sourceClusterId = String(getCell(record.row, 0));
      const rows = serpByClusterKeyword.get(`${sourceClusterId}\u0000${record.keyword}`) || [];
      rows.forEach((serpRow) => {
        historyOutputRows.push([
          clusterId,
          record.keyword,
          record === parentRecord ? 'Principal' : 'Variación',
          serpRow.rank,
          serpRow.url,
          serpRow.title,
        ]);
      });
    });
  });

  const nextWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    nextWorkbook,
    XLSX.utils.aoa_to_sheet([finalHeaders, ...finalRows]),
    FINAL_STRATEGY_SHEET_NAME,
  );
  XLSX.utils.book_append_sheet(
    nextWorkbook,
    XLSX.utils.aoa_to_sheet([historyOutputHeaders, ...historyOutputRows]),
    SERP_HISTORY_SHEET_NAME,
  );
  return { workbook: nextWorkbook, totalClusters: groups.length, totalKeywords: records.length };
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
  const finalRows = toRows(workbook.Sheets[FINAL_STRATEGY_SHEET_NAME]);
  const historyRows = toRows(workbook.Sheets[SERP_HISTORY_SHEET_NAME]);
  const hasFinalStrategyFormat =
    hasHeaders(finalRows, [CLUSTER_ID_COLUMN, FINAL_KEYWORD_COLUMN, FINAL_VARIATIONS_COLUMN]) &&
    hasHeaders(historyRows, [
      CLUSTER_ID_COLUMN,
      HISTORY_KEYWORD_COLUMN,
      HISTORY_RANK_COLUMN,
      HISTORY_URL_COLUMN,
    ]);
  if (hasFinalStrategyFormat) return buildFinalStrategyWorkbook(workbook, topUrlLimit);

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
