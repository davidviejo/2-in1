# API Documentation — SEO TF‑IDF (`backend/p2`)

Esta documentación cubre el flujo completo solicitado por frontend para:

1. **create project**
2. **add documents**
3. **analyze**
4. **get run**

> Base URL sugerida en local: `http://127.0.0.1:5000`
>
> El backend expone rutas equivalentes con prefijos:
>
> - `/api/seo/tfidf/...`
> - `/api/v1/seo/tfidf/...`

---

## 1) Endpoints

### 1.1 Create project
- **POST** `/api/seo/tfidf/projects`
- **Alias v1:** `POST /api/v1/seo/tfidf/projects`

Crea un proyecto TF‑IDF vacío.

### 1.2 Add documents
- **POST** `/api/seo/tfidf/projects/{project_id}/documents`
- **Alias v1:** `POST /api/v1/seo/tfidf/projects/{project_id}/documents`

Añade documentos al corpus del proyecto.

### 1.3 Analyze project
- **POST** `/api/seo/tfidf/projects/{project_id}/analyze`
- **Alias v1:** `POST /api/v1/seo/tfidf/projects/{project_id}/analyze`

Ejecuta análisis TF‑IDF y crea un `run`.

### 1.4 Get run
- **GET** `/api/seo/tfidf/runs/{run_id}`
- **Alias v1:** `GET /api/v1/seo/tfidf/runs/{run_id}`

Devuelve el resultado del run.

### 1.5 (Útiles para UI) Listados
- **GET** `/api/seo/tfidf/projects`
- **GET** `/api/seo/tfidf/projects/{project_id}/runs`

---

## 2) Esquemas request / response

## 2.1 Create project

### Request
```json
{
  "name": "Competidores Fintech ES"
}
```

Reglas:
- `name` (string, requerido, min 1, max 120)

### Response `201 Created`
```json
{
  "id": "8f5f5d7e-6f6f-4968-b4a4-2f2c2f9f0d5f",
  "name": "Competidores Fintech ES",
  "created_at": "2026-04-01T10:00:00.000000Z",
  "updated_at": "2026-04-01T10:00:00.000000Z",
  "documents": [],
  "runs": []
}
```

---

## 2.2 Add documents

### Request
```json
{
  "documents": [
    {
      "title": "Artículo competidor A",
      "content": "Texto del documento A..."
    },
    {
      "title": "Artículo competidor B",
      "content": "Texto del documento B..."
    }
  ]
}
```

Reglas:
- `documents` (array, requerido, al menos 1)
- `documents[].title` (string, requerido, min 1, max 200)
- `documents[].content` (string, requerido, min 1)

### Response `201 Created`
```json
{
  "project_id": "8f5f5d7e-6f6f-4968-b4a4-2f2c2f9f0d5f",
  "inserted": [
    {
      "id": "2dff8c50-66d1-4f00-a4bd-d6426e5900ce",
      "title": "Artículo competidor A",
      "content": "Texto del documento A...",
      "created_at": "2026-04-01T10:01:00.000000Z"
    },
    {
      "id": "4fa22a85-ec31-4fce-83ce-1e323be8f98c",
      "title": "Artículo competidor B",
      "content": "Texto del documento B...",
      "created_at": "2026-04-01T10:01:00.000000Z"
    }
  ],
  "count": 2
}
```

---

## 2.3 Analyze project

### Request
```json
{
  "target_url": "https://mi-dominio.com/url-objetivo",
  "reference_urls": [
    "https://competidor-a.com/post",
    "https://competidor-b.com/post"
  ],
  "config": {
    "min_df": 1,
    "max_df": 1.0,
    "max_features": 5000,
    "ngram_range": [1, 2]
  }
}
```

Reglas:
- `target_url` (URL válida, requerido)
- `reference_urls` (array URL, requerido, min 1)
- `config` (opcional):
  - `min_df`: int `[1..10000]` o float `(0..1]`
  - `max_df`: int `[1..10000]` o float `(0..1]`
  - `max_features`: int `[1..50000]`
  - `ngram_range`: `[min_n, max_n]` con `1 <= min_n <= max_n <= 4`

### Response `202 Accepted`
```json
{
  "run_id": "728cbcc6-c9bb-41dd-92c9-92db06bbf6fd",
  "project_id": "8f5f5d7e-6f6f-4968-b4a4-2f2c2f9f0d5f",
  "status": "completed",
  "created_at": "2026-04-01T10:02:00.000000Z",
  "documents_analyzed": 2,
  "summary": "Análisis TF-IDF completado para 2 documentos.",
  "recommendations": [
    "Prioriza los términos con mayor score en títulos y encabezados.",
    "Compara la cobertura semántica de target_url frente a reference_urls.",
    "Repite el análisis tras actualizar contenido para medir mejora semántica."
  ],
  "terms": [
    {
      "term": "fintech",
      "tf": 0.04,
      "idf": 1.0,
      "score": 0.04,
      "frequency": 3
    }
  ],
  "analysis": [
    {
      "document_id": "2dff8c50-66d1-4f00-a4bd-d6426e5900ce",
      "token_count": 120,
      "top_terms": [
        {
          "term": "fintech",
          "tf": 0.04,
          "idf": 1.0,
          "score": 0.04,
          "frequency": 3
        }
      ]
    }
  ]
}
```

> Nota: actualmente el análisis se calcula de forma síncrona y retorna con `status = "completed"`.

---

## 2.4 Get run

### Request
`GET /api/seo/tfidf/runs/{run_id}`

### Response `200 OK`
```json
{
  "run_id": "728cbcc6-c9bb-41dd-92c9-92db06bbf6fd",
  "project_id": "8f5f5d7e-6f6f-4968-b4a4-2f2c2f9f0d5f",
  "status": "completed",
  "created_at": "2026-04-01T10:02:00.000000Z",
  "documents_analyzed": 2,
  "summary": "Análisis TF-IDF completado para 2 documentos.",
  "recommendations": [
    "Prioriza los términos con mayor score en títulos y encabezados.",
    "Compara la cobertura semántica de target_url frente a reference_urls.",
    "Repite el análisis tras actualizar contenido para medir mejora semántica."
  ],
  "terms": [
    {
      "term": "fintech",
      "tf": 0.04,
      "idf": 1.0,
      "score": 0.04,
      "frequency": 3
    }
  ],
  "analysis": [
    {
      "document_id": "2dff8c50-66d1-4f00-a4bd-d6426e5900ce",
      "token_count": 120,
      "top_terms": [
        {
          "term": "fintech",
          "tf": 0.04,
          "idf": 1.0,
          "score": 0.04,
          "frequency": 3
        }
      ]
    }
  ],
  "target_url": "https://mi-dominio.com/url-objetivo",
  "reference_urls": [
    "https://competidor-a.com/post",
    "https://competidor-b.com/post"
  ],
  "config": {
    "min_df": 1,
    "max_df": 1.0,
    "max_features": 5000,
    "ngram_range": [1, 2]
  }
}
```

---

## 3) Códigos de error

Formato de error estándar:

```json
{
  "error": "Mensaje de error",
  "details": []
}
```

### Errores típicos por endpoint

- **400 Bad Request**
  - Payload inválido (campos faltantes, tipos no válidos, validaciones pydantic)
  - Corpus insuficiente al analizar (`< 2` documentos)
- **404 Not Found**
  - Proyecto no encontrado
  - Run no encontrado

### Ejemplos de error

#### 400 — payload inválido
```json
{
  "error": "Payload inválido.",
  "details": [
    {
      "type": "missing",
      "loc": ["target_url"],
      "msg": "Field required"
    }
  ]
}
```

#### 400 — corpus insuficiente
```json
{
  "error": "Corpus insuficiente: necesitas al menos 2 documentos para analizar."
}
```

#### 404 — proyecto no encontrado
```json
{
  "error": "Proyecto no encontrado."
}
```

#### 404 — run no encontrado
```json
{
  "error": "Run no encontrado."
}
```

---

## 4) Ejemplos completos (end-to-end)

## 4.1 Create project
```bash
curl -X POST http://127.0.0.1:5000/api/seo/tfidf/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comparativa landing SaaS"
  }'
```

## 4.2 Add documents
```bash
curl -X POST http://127.0.0.1:5000/api/seo/tfidf/projects/<PROJECT_ID>/documents \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {"title": "Competidor A", "content": "Contenido largo del competidor A..."},
      {"title": "Competidor B", "content": "Contenido largo del competidor B..."}
    ]
  }'
```

## 4.3 Analyze
```bash
curl -X POST http://127.0.0.1:5000/api/seo/tfidf/projects/<PROJECT_ID>/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://mi-sitio.com/landing",
    "reference_urls": [
      "https://competidor-a.com/landing",
      "https://competidor-b.com/landing"
    ],
    "config": {
      "min_df": 1,
      "max_df": 1.0,
      "max_features": 3000,
      "ngram_range": [1,2]
    }
  }'
```

## 4.4 Get run
```bash
curl -X GET http://127.0.0.1:5000/api/seo/tfidf/runs/<RUN_ID>
```

---

## 5) Frontend integration notes

## 5.1 Payload mínimo para lanzar `analyze`

El payload mínimo aceptado por backend es:

```json
{
  "target_url": "https://mi-sitio.com/landing",
  "reference_urls": ["https://competidor-a.com/landing"]
}
```

`config` es opcional (se aplican defaults del backend).

## 5.2 Formato de términos y recomendaciones esperado por UI

Para render robusto en UI:

- `recommendations`: `string[]`
- `terms`: array de objetos con:
  - `term: string`
  - `score: number`
  - `tf: number`
  - `idf: number`
  - `frequency: number`
- `analysis`: array por documento con:
  - `document_id: string`
  - `token_count: number`
  - `top_terms: TermScore[]`

Ejemplo defensivo en frontend:

```ts
type TermScore = {
  term: string;
  tf: number;
  idf: number;
  score: number;
  frequency: number;
};

type RunResult = {
  run_id: string;
  project_id: string;
  status: string;
  recommendations: string[];
  terms: TermScore[];
  analysis: Array<{
    document_id: string;
    token_count: number;
    top_terms: TermScore[];
  }>;
};
```

## 5.3 Estados de run para polling

Contrato actual:
- valor observado en backend para este módulo: **`completed`**.

Recomendación de polling UI (forward-compatible):
- tratar `completed` como terminal OK;
- tratar `failed`/`error`/`cancelled` como terminal KO (si el backend lo incorporase);
- mantener polling mientras status sea no terminal (ej. `queued`, `running`) en futuras versiones.

Como la implementación actual devuelve el resultado ya resuelto en `POST /analyze` con `202`, puede omitirse polling y hacer fetch puntual de `GET /runs/{run_id}` sólo para refresco o navegación posterior.

---

## 6) OpenAPI (bloque manual embebido)

> Este proyecto **no** usa Swagger manual integrado (p.ej. flasgger) en runtime; por ello se incluye un bloque OpenAPI de referencia en la documentación.

```yaml
openapi: 3.0.3
info:
  title: SEO TF-IDF API
  version: 1.0.0
servers:
  - url: http://127.0.0.1:5000
paths:
  /api/seo/tfidf/projects:
    post:
      summary: Create TF-IDF project
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name:
                  type: string
                  minLength: 1
                  maxLength: 120
      responses:
        '201':
          description: Project created
        '400':
          description: Invalid payload
  /api/seo/tfidf/projects/{project_id}/documents:
    post:
      summary: Add documents
      parameters:
        - in: path
          name: project_id
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [documents]
              properties:
                documents:
                  type: array
                  minItems: 1
                  items:
                    type: object
                    required: [title, content]
                    properties:
                      title: { type: string, minLength: 1, maxLength: 200 }
                      content: { type: string, minLength: 1 }
      responses:
        '201': { description: Documents inserted }
        '400': { description: Invalid payload }
        '404': { description: Project not found }
  /api/seo/tfidf/projects/{project_id}/analyze:
    post:
      summary: Analyze project corpus
      parameters:
        - in: path
          name: project_id
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [target_url, reference_urls]
              properties:
                target_url: { type: string, format: uri }
                reference_urls:
                  type: array
                  minItems: 1
                  items: { type: string, format: uri }
      responses:
        '202': { description: Analysis run created/completed }
        '400': { description: Invalid payload or insufficient corpus }
        '404': { description: Project not found }
  /api/seo/tfidf/runs/{run_id}:
    get:
      summary: Get run detail
      parameters:
        - in: path
          name: run_id
          required: true
          schema: { type: string }
      responses:
        '200': { description: Run detail }
        '404': { description: Run not found }
```
