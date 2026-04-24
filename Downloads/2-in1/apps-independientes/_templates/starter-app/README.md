# __APP_NAME__

Starter para crear una app independiente bajo `apps-independientes/` con integración base para Tools Hub.

## Estructura mínima

```text
__APP_SLUG__/
├─ app/
├─ src/
├─ .env.example
├─ app.manifest.json
├─ package.json
└─ README.md
```

## Scripts estándar

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test` (placeholder, reemplazar por tests reales cuando aplique)

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar valores según el entorno.

## Checklist de integración (Tools Hub)

- [ ] `app.manifest.json` con `id` único y estable.
- [ ] `path`, `healthcheck.target` y `runtime.start.port` alineados con el puerto real.
- [ ] `workdir` apunta a `apps-independientes/__APP_SLUG__`.
- [ ] `install_cmd` y `start_cmd` ejecutan correctamente en local.
- [ ] App visible y operable desde Tools Hub (instalar/iniciar/parar).

## Checklist de seguridad

- [ ] No commitear secretos (`.env`, tokens, keys privadas).
- [ ] Mantener solo `.env.example` con valores de ejemplo.
- [ ] Declarar explícitamente puertos y healthcheck en `app.manifest.json`.
- [ ] No abrir CORS ni endpoints sensibles sin justificación.

## Arranque local

```bash
npm install
npm run dev
```
