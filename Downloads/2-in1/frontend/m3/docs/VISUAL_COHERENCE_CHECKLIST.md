# Checklist de coherencia visual

## 1) Navegación y layout
- [ ] Todas las vistas usan una shell común (`AppShell`) y variante por contexto (`PortalShell`, `InternalShell`, `OperatorShell`).
- [ ] El header mantiene altura consistente (`h-20`) y jerarquía clara de acciones primarias/secundarias.
- [ ] Las rutas públicas (`/`, `/clientes`, `/p/:slug`) comparten patrón visual de navegación y espaciado.
- [ ] Las rutas internas (`/app/*`) mantienen sidebar + header fijo + área de contenido scrollable.
- [ ] La ruta operador (`/operator`) respeta la misma estructura base con su tema oscuro.

## 2) Botones y CTAs
- [ ] Las acciones de submit/acceso usan `Button` variant `primary`.
- [ ] Acciones secundarias (volver, refrescar, cancelar) usan `secondary` o `ghost`.
- [ ] Acciones de riesgo usan `danger`.
- [ ] Todos los botones muestran feedback consistente en `hover`, `focus-visible` y `disabled`.

## 3) Cards y contenedores
- [ ] Bloques informativos usan `Card` (tokens `rounded-brand-lg`, `border-border`, `shadow-card`).
- [ ] No se mezclan estilos ad-hoc cuando ya existe un componente base equivalente.
- [ ] Las tarjetas interactivas mantienen patrón de elevación/animación homogéneo.

## 4) Headers, tipografía y copy
- [ ] Se mantiene tipografía base (`font-sans`) en shell y vistas.
- [ ] La jerarquía H1/H2/subtítulos/metadata es consistente entre portal e interno.
- [ ] Los copy de estado y CTA usan tono y estructura alineados (acción + contexto).

## 5) Espaciado y ritmo visual
- [ ] Gutters comunes en contenido: `px-4 sm:px-6 lg:px-8`.
- [ ] Secciones principales conservan escala vertical consistente (`py-8`, `py-12`, `gap-4/6`).
- [ ] Separadores y agrupaciones visuales se repiten con los mismos tokens.

## 6) Estados vacíos / error / carga
- [ ] Estados vacíos usan `EmptyState` (icono + título + descripción opcional).
- [ ] Estados de carga no rompen layout y usan `Spinner` o esqueletos consistentes.
- [ ] Errores mantienen patrón visual unificado y mensaje accionable.
- [ ] Las páginas críticas (landing, login, overview) cubren explícitamente los 3 estados: loading/error/empty.
