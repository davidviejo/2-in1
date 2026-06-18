export type SerpResult = { title: string; url: string; snippet?: string };
export type Cluster = { id: string; parent: string; children: string[]; keywords: string[]; intent: string; serp: Record<string, SerpResult[]>; overlapEvidence: Array<{ baseKeyword: string; variationKeyword: string; commonUrls: string[] }>; avgWords?: number; avgImages?: number; topStructure?: string[]; entities?: string[] };
export type AnalyzeRequest = { keywords: string[]; targetDomain?: string; strict?: number; topN?: number; gl?: string; hl?: string; dataforseoLogin?: string; dataforseoPassword?: string; };

const stop = new Set('de la el los las y o para por con en un una como que seo web online mejor mejores precio cerca desde hacia a del'.split(' '));
const normalize = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9áéíóúüñ\s-]/gi, ' ').replace(/\s+/g, ' ').trim();
const tokens = (kw: string) => normalize(kw).split(' ').filter((t) => t.length > 2 && !stop.has(t));
const jaccard = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); const inter = [...A].filter((x) => B.has(x)).length; return inter / Math.max(1, new Set([...A, ...B]).size); };
const classifyIntent = (kw: string) => /compr|precio|presupuesto|contratar|servicio|consultor|agencia|mejor/.test(normalize(kw)) ? 'comercial/transaccional' : /como|que|guia|tutorial|ejemplo/.test(normalize(kw)) ? 'informacional' : 'mixta';
const keywordId = (kw: string) => normalize(kw).replace(/\s+/g, '-').slice(0, 44) || 'cluster';

async function dataforseo(keyword: string, req: AnalyzeRequest): Promise<SerpResult[]> {
  if (!req.dataforseoLogin || !req.dataforseoPassword) return [];
  const auth = Buffer.from(`${req.dataforseoLogin}:${req.dataforseoPassword}`).toString('base64');
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify([{ keyword, location_code: 2724, language_code: req.hl || 'es', depth: req.topN || 10 }]) });
  if (!res.ok) throw new Error(`DataForSEO respondió ${res.status}`);
  const data = await res.json();
  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  return items.filter((i: any) => i.type === 'organic').slice(0, req.topN || 10).map((i: any) => ({ title: i.title || '', url: i.url || '', snippet: i.description || '' }));
}

async function ddg(keyword: string, topN = 10): Promise<SerpResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`;
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SEO Cluster Bot' } }).then((r) => r.text()).catch(() => '');
  const out: SerpResult[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < topN) {
    const cleanTitle = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    let cleanUrl = m[1].replace(/&amp;/g, '&');
    try { const u = new URL(cleanUrl); const uddg = u.searchParams.get('uddg'); if (uddg) cleanUrl = decodeURIComponent(uddg); } catch {}
    out.push({ title: cleanTitle, url: cleanUrl });
  }
  return out;
}

async function enrich(url: string) {
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SEO Benchmark Bot' }, signal: AbortSignal.timeout(8000) }).then((r) => r.text()).catch(() => '');
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const headings = [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gim)].slice(0, 20).map((m) => `H${m[1]} ${m[2].replace(/<[^>]+>/g, '').trim()}`).filter(Boolean);
  return { words: text ? text.split(/\s+/).length : 0, imgs: (html.match(/<img\b/gi) || []).length, headings, terms: tokens(text).slice(0, 350) };
}

export async function analyzeClusterSerp(req: AnalyzeRequest): Promise<{ clusters: Cluster[]; summary: { totalKeywords: number; totalClusters: number; provider: string } }> {
  const clean = [...new Set(req.keywords.map((k) => k.trim()).filter(Boolean))];
  const topN = Math.min(Math.max(req.topN || 10, 3), 20);
  const strict = Math.min(Math.max(req.strict || 3, 1), 5);
  const serp: Record<string, SerpResult[]> = {};
  let provider = req.dataforseoLogin && req.dataforseoPassword ? 'DataForSEO' : 'DuckDuckGo fallback';
  for (const kw of clean) {
    const premium = await dataforseo(kw, req).catch(() => []);
    serp[kw] = premium.length ? premium : await ddg(kw, topN);
  }

  const clusters: Cluster[] = [];
  const threshold = strict >= 4 ? 0.35 : strict === 3 ? 0.24 : 0.14;
  for (const kw of clean) {
    const urls = new Set((serp[kw] || []).map((r) => r.url));
    let best: { c: Cluster; score: number; common: string[] } | null = null;
    for (const c of clusters) {
      const parentUrls = new Set((serp[c.parent] || []).map((r) => r.url));
      const common = [...urls].filter((u) => parentUrls.has(u));
      const score = Math.max(common.length / Math.max(1, Math.min(urls.size, parentUrls.size)), jaccard(tokens(kw), tokens(c.parent)));
      if (!best || score > best.score) best = { c, score, common };
    }
    if (best && best.score >= threshold) { best.c.children.push(kw); best.c.keywords.push(kw); if (best.common.length) best.c.overlapEvidence.push({ baseKeyword: best.c.parent, variationKeyword: kw, commonUrls: best.common.slice(0, 5) }); }
    else clusters.push({ id: keywordId(kw), parent: kw, children: [], keywords: [kw], intent: classifyIntent(kw), serp: {}, overlapEvidence: [] });
  }
  for (const c of clusters) {
    c.serp = Object.fromEntries(c.keywords.map((kw) => [kw, serp[kw] || []]));
    const sampleUrls = [...new Set(c.keywords.flatMap((kw) => (serp[kw] || []).map((r) => r.url)))].slice(0, 3);
    const pages = await Promise.all(sampleUrls.map(enrich));
    const ok = pages.filter((p) => p.words > 0);
    c.avgWords = ok.length ? Math.round(ok.reduce((s, p) => s + p.words, 0) / ok.length) : 0;
    c.avgImages = ok.length ? Math.round(ok.reduce((s, p) => s + p.imgs, 0) / ok.length) : 0;
    c.topStructure = ok.flatMap((p) => p.headings).slice(0, 15);
    const counts = new Map<string, number>(); ok.flatMap((p) => p.terms).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    c.entities = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 12).map(([t])=>t);
  }
  return { clusters, summary: { totalKeywords: clean.length, totalClusters: clusters.length, provider } };
}
