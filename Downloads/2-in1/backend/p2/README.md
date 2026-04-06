# SEO Suite Ultimate v17

## 📘 Introduction

**SEO Suite Ultimate** is a desktop-based local web application designed to centralize SEO consulting tasks. It eliminates the need for multiple subscriptions (Screaming Frog, SurferSEO, Semrush) by providing a unified interface for strategy, auditing, on-page optimization, and architecture analysis.

It functions as a "Local SaaS", automating tasks using hybrid scraping and third-party APIs.

## 🚀 Features

The suite is divided into functional modules:

### 1. Strategy & Growth
*   **EcoTrends**: Real-time market radar using Google Trends (supports Internal API, SerpApi, and DataForSEO).
*   **SEO Suite / Cluster**: Groups thousands of keywords by search intent.
*   **KW Discovery & Intent**: Autocomplete suggestions and transactional vs. informational classification.
*   **Content Gap**: Competitor keyword analysis.
*   **SERP Analyzer**: Benchmarking against Top 10 results.

### 2. Technical Audit
*   **Auditor Técnico**: Deep scan for H1, Meta Descriptions, and Thin Content.
*   **Fast Status**: Rapid 404/200 OK checks for thousands of URLs.
*   **Index Guard & Checker**: Verifies `noindex` tags and indexing status.
*   **Tech Spy**: Detects competitor CMS and plugins.

### 3. On-Page & Content
*   **NLP Analyzer**: Sentiment analysis and entity extraction.
*   **KW Prominence**: Checks keyword placement in hot zones.
*   **Snippet Target**: Helps draft paragraphs for Position 0.
*   **Content Decay**: Identifies outdated content.

### 4. Architecture
*   **Link Graph**: Visual representation of internal linking.
*   **Click Depth**: Analyzes distance from Home.
*   **LinkRank**: Internal PageRank calculation.
*   **Orphan Hunter**: Finds pages with no internal links.

### 5. WPO (Performance)
*   **WPO Lab**: Measures TTFB and page weight.
*   **Image Auditor**: Finds heavy images or missing ALT tags.

### 6. Operations & Utilities
*   **ROI Projector**: Revenue projection calculator.
*   **GSC Tracker**: Google Search Console integration.
*   **Autopilot v5**: Automated auditing (Core Web Vitals, Broken Links, Content DNA).
*   **AI Auto-Fixer**: Generates fixes for detected issues using AI.

## 🛠 Tech Stack

*   **Backend**: Python (Flask)
*   **Frontend**: Jinja2 Templates, Bootstrap 5, Tailwind CSS (hybrid)
*   **Database**: SQLite (`projects.db` for data, `api_usage.db` for quotas), JSON (`projects_db.json` for seed/migration)
*   **Scraping**: `requests`, `BeautifulSoup4`, `playwright` (headless browser), `duckduckgo-search`
*   **Data Processing**: Pandas, OpenPyXL
*   **NLP/AI**: Spacy, TextBlob, OpenAI API

## 🏗 Architecture

The application follows a modular MVC pattern using Flask Blueprints.

*   `run.py`: Entry point. Registers apps.
*   `apps/`: Contains logic and controllers.
    *   `scraper_core.py`: Hybrid scraping engine (Requests + Playwright).
    *   `monitor_daemon.py`: Background uptime monitor.
    *   `database.py`: SQLite persistence layer.
*   `templates/`: Jinja2 views.
*   `projects_db.json`: JSON-based data persistence/migration source.

## ⚙️ Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone <repository_url>
    cd <repository_folder>
    ```

2.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Install Browser Binaries (for Playwright)**
    ```bash
    playwright install chromium
    ```

4.  **Download NLP Models**
    ```bash
    python -m spacy download es_core_news_sm
    ```

5.  **Run the Application**
    ```bash
    python run.py
    ```
    The application will start at `http://127.0.0.1:5000`.

## ⚠️ Troubleshooting

*   **Google 429 Block**: If blocked, increase the delay or switch the search engine to DuckDuckGo in settings.
*   **Playwright Errors**: Ensure `playwright install` was run.
*   **Database**: The app initializes `projects.db` automatically. If empty, it attempts to migrate from `projects_db.json`.

## 🧭 Guía operativa: modo sin API (Google scraping directo)

Cuando se trabaja sin SerpApi/DataForSEO/Google CSE, el módulo SEO usa scraping directo de SERP. Recomendaciones prácticas:

* **Delay recomendado**: empieza con `2.5s–4s` entre keywords; si hay bloqueos, sube a `5s–8s`.
* **Cookie de sesión**: usar una cookie válida de Google suele reducir bloqueos y mejorar estabilidad de parseo.
* **Límites prácticos por sesión**:
  * Lotes pequeños/medios (ej. `20–80` keywords) son más estables.
  * En lotes largos, divide en bloques y añade pausas entre bloques.
* **Señales de bloqueo**: HTTP 429/403, páginas con captcha o “unusual traffic”, y caída brusca de resultados orgánicos.
* **Estrategia recomendada**:
  1. Ejecutar primero con menor volumen para calibrar delay.
  2. Activar fallback (retry o DDG) si está disponible.
  3. Revisar `/seo/status?diagnostics=1` para inspeccionar ratio de bloqueos y causa técnica por keyword.

## 🔌 Providers Configuration

### Real-Time Trends Provider
The Trends module supports multiple providers. It auto-detects based on configuration:

1.  **SerpApi**: Used if an API key is provided in the UI or `SERPAPI_KEY` env var is set (and `TRENDS_PROVIDER` is 'serpapi').
2.  **DataForSEO**: Used if `TRENDS_PROVIDER` env var is set to `dataforseo` and credentials (`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`) are available (env or settings).
3.  **Google Internal**: Default fallback if no other provider is configured.

## 🔗 Trends Media integrado con el frontend principal

El módulo editorial de Tendencias/Brief ya no se sirve como una app independiente dentro de `backend/p2/static/trends_media`.

Ahora la ruta backend `/trends/media` redirige al frontend React integrado en:

```text
/#/app/trends-media
```

Si frontend y backend corren en diferentes hosts o puertos durante desarrollo, configura:

```bash
export MEDIAFLOW_FRONTEND_URL=http://localhost:5173
```

De este modo, la navegación desde Flask apuntará a la SPA principal sin depender del build estático legado.

---
*Based on Manual de Operaciones v17 and Tech Report v18.*

## 🔄 Batch Jobs API (v17.1)

New async processing for large batches of URLs.

**1. Create Job**
```bash
curl -X POST http://127.0.0.1:5000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {"url": "https://example.com", "kwPrincipal": "seo"},
      {"url": "https://example.org", "kwPrincipal": "marketing"}
    ],
    "analysisConfig": {
      "mode": "advanced",
      "serp": {
        "confirmed": true,
        "provider": "serpapi",
        "maxKeywordsPerUrl": 10
      }
    }
  }'
```

**2. Check Status**
```bash
curl http://127.0.0.1:5000/api/jobs/<job_id>
```

**3. Get Items**
```bash
curl "http://127.0.0.1:5000/api/jobs/<job_id>/items?status=done&page=1"
```

**4. Get Result**
```bash
curl http://127.0.0.1:5000/api/jobs/<job_id>/items/<item_id>/result
```

**5. Control**
```bash
curl -X POST http://127.0.0.1:5000/api/jobs/<job_id>/pause
curl -X POST http://127.0.0.1:5000/api/jobs/<job_id>/resume
curl -X POST http://127.0.0.1:5000/api/jobs/<job_id>/cancel
```

### GSC queries precedence in batch jobs

For each batch item, GSC queries are resolved in this order:

1. `item.gscQueries` (inside each `items[]` entry) — **highest priority**.
2. `gscQueriesByUrl[item.url]` from the job payload / `analysisConfig` — legacy fallback.

This keeps backward compatibility with legacy payloads while allowing per-item overrides.
