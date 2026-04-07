# Contrato técnico API Engine Batch Jobs

Fecha de actualización: **2026-04-07**.

Este documento define el contrato estable para jobs batch de `api_engine`.

## Enum estable de estados

Todos los endpoints de jobs deben exponer exclusivamente este enum:

- `pending`
- `processing`
- `paused`
- `done`
- `error`
- `cancelled`

> Nota: internamente el backend puede seguir usando estados legacy (`queued`, `running`, `completed`, `failed`), pero nunca deben filtrarse sin mapear en respuestas públicas.

## Campos canónicos de respuesta

Para evitar variantes legacy (`jobId`, `createdAt`, `completedAt`, `total/processed/success/errors`), el contrato público usa:

- `id`
- `status`
- `progress`
  - `total`
  - `processed`
  - `succeeded`
  - `failed`
- `created_at`
- `completed_at`
- `error`

## Endpoints y forma esperada

### `POST /api/jobs`

Respuesta 201:

```json
{
  "id": "<uuid>",
  "status": "pending",
  "progress": {
    "total": 10,
    "processed": 0,
    "succeeded": 0,
    "failed": 0
  },
  "created_at": null,
  "completed_at": null,
  "advancedAllowed": true,
  "advancedBlockedReason": null
}
```

### `GET /api/jobs/<job_id>`

```json
{
  "id": "<uuid>",
  "status": "processing",
  "progress": {
    "total": 10,
    "processed": 4,
    "succeeded": 3,
    "failed": 1
  },
  "created_at": "2026-04-07 10:00:00",
  "completed_at": null,
  "error": null,
  "advancedAllowed": true,
  "advancedBlockedReason": null
}
```

### `GET /api/jobs/<job_id>/items`

Cada item se normaliza a:

```json
{
  "itemId": "<uuid>",
  "url": "https://example.com",
  "status": "done",
  "completed_at": "2026-04-07 10:03:00",
  "error": null
}
```

El parámetro `status` (CSV) debe usar también el enum estable, por ejemplo:

- `status=done`
- `status=error`
- `status=pending,processing,paused`

## Compatibilidad frontend

El cliente frontend (`pythonEngineClient.ts`) debe consumir únicamente el contrato canónico y no mantener normalizaciones legacy redundantes.
