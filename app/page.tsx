'use client';
import { useMemo, useState } from 'react';

type SerpResult = { title: string; url: string; snippet?: string };
type Cluster = { id: string; parent: string; children: string[]; keywords: string[]; intent: string; serp: Record<string, SerpResult[]>; overlapEvidence: Array<{ baseKeyword: string; variationKeyword: string; commonUrls: string[] }>; avgWords?: number; avgImages?: number; topStructure?: string[]; entities?: string[] };

const sample = `consultor seo zaragoza\nconsultoría seo zaragoza\nauditoría seo técnica\nservicio seo local\nkeyword research seo\nclusterización de keywords\nanálisis serp seo\nconsultor seo ecommerce`;

export default function Home() {
  const [keywords, setKeywords] = useState(sample);
  const [strict, setStrict] = useState(3);
  const [topN, setTopN] = useState(10);
  const [targetDomain, setTargetDomain] = useState('');
  const [dataforseoLogin, setDataforseoLogin] = useState('');
  const [dataforseoPassword, setDataforseoPassword] = useState('');
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [summary, setSummary] = useState<{ totalKeywords: number; totalClusters: number; provider: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const keywordCount = useMemo(() => keywords.split(/\n|,/).map((k) => k.trim()).filter(Boolean).length, [keywords]);

  async function run() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/cluster-serp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords, strict, topN, targetDomain, dataforseoLogin, dataforseoPassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo ejecutar el análisis');
      setClusters(data.clusters); setSummary(data.summary);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setLoading(false); }
  }

  return <main className="shell">
    <section className="hero">
      <nav className="nav"><div className="brand"><span className="mark">DV</span><span>David Viejo · SEO Strategic Lead</span></div><span className="pill">Herramienta Vercel-ready · Cluster + SERP</span></nav>
      <div className="hero-grid"><div><p className="eyebrow">Con enfoque en negocio</p><h1>Clusterización KWS y análisis SERP en una sola página.</h1><p className="lead">Extrae la lógica clave del backend SEO Suite y la experiencia de “agrupación y clusterización” para convertir un listado de keywords en clústeres por intención, solapamiento SERP y benchmark de contenido competitivo.</p></div><aside className="hero-card"><div className="metric"><span>Keywords listas</span><strong>{keywordCount}</strong></div><div className="metric"><span>Clústeres detectados</span><strong>{summary?.totalClusters ?? '—'}</strong></div><div className="metric"><span>Proveedor SERP</span><strong style={{fontSize:18}}>{summary?.provider ?? 'Auto'}</strong></div></aside></div>
    </section>
    <section className="main">
      <aside className="panel"><h2>Entrada de análisis</h2><p className="hint">Pega keywords, configura la sensibilidad de solapamiento y ejecuta. Si añades credenciales DataForSEO se usará como proveedor; si no, se activa fallback SERP público.</p><label>Keywords</label><textarea value={keywords} onChange={(e)=>setKeywords(e.target.value)} /><div className="row"><div><label>Strict SERP</label><select value={strict} onChange={(e)=>setStrict(Number(e.target.value))}><option value={2}>Flexible</option><option value={3}>Equilibrado</option><option value={4}>Estricto</option></select></div><div><label>Top resultados</label><input type="number" min={3} max={20} value={topN} onChange={(e)=>setTopN(Number(e.target.value))}/></div></div><label>Dominio objetivo opcional</label><input placeholder="davidviejo.com" value={targetDomain} onChange={(e)=>setTargetDomain(e.target.value)} /><div className="row"><div><label>DataForSEO login</label><input value={dataforseoLogin} onChange={(e)=>setDataforseoLogin(e.target.value)} /></div><div><label>DataForSEO password</label><input type="password" value={dataforseoPassword} onChange={(e)=>setDataforseoPassword(e.target.value)} /></div></div><button className="button" disabled={loading} onClick={run}>{loading ? 'Analizando SERPs…' : 'Ejecutar clusterización'}</button>{error && <div className="error">{error}</div>}<p className="hint">Nota: en producción conviene mover las credenciales a variables server-side para no exponer secretos en cliente.</p></aside>
      <section className="results">{clusters.length===0 ? <div className="empty"><h2>Resultados unificados</h2><p>Ejecuta la herramienta para ver clústeres, keywords hijas, evidencias de URLs compartidas, medias de palabras/imágenes y términos semánticos de la SERP.</p></div> : clusters.map((c, i)=><article className="result" key={c.id}><div className="result-head"><div><span className="badge">Cluster {i+1} · {c.intent}</span><h2>{c.parent}</h2></div><span className="pill">{c.keywords.length} KWs</span></div>{c.children.length>0 && <div className="children">{c.children.map((k)=><span className="chip" key={k}>{k}</span>)}</div>}<div className="grid3"><div className="stat"><b>{c.avgWords || 0}</b><span>palabras media</span></div><div className="stat"><b>{c.avgImages || 0}</b><span>imágenes media</span></div><div className="stat"><b>{c.overlapEvidence.length}</b><span>solapes SERP</span></div></div><div className="children">{(c.entities||[]).map((e)=><span className="chip" key={e}>{e}</span>)}</div><details><summary>Estructura SERP y evidencias</summary>{c.topStructure?.map((h, ix)=><p className="hint" key={ix}>{h}</p>)}{c.overlapEvidence.map((ev)=><p className="hint" key={ev.variationKeyword}><b>{ev.variationKeyword}</b> comparte {ev.commonUrls.length} URLs con <b>{ev.baseKeyword}</b></p>)}</details><details><summary>Resultados orgánicos por keyword</summary>{Object.entries(c.serp).map(([kw, list])=><div key={kw}><h3>{kw}</h3>{list.map((r)=><div className="serp-item" key={r.url}><a href={r.url} target="_blank">{r.title || r.url}</a><p className="hint">{r.url}</p></div>)}</div>)}</details></article>)}</section>
    </section>
  </main>;
}
