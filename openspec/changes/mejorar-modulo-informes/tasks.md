# Tasks: Mejorar Módulo Informes

## Review Workload Forecast

~3,000 líneas estimadas (19 archivos: 11 nuevos + 8 modificados).

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation — UI, hooks, schema, deps | PR 1 | Sin dependencias externas |
| 2 | Server actions — ~20 queries en informes.ts | PR 2 | Depende del schema (PR 1) |
| 3 | Pestañas existentes mejoradas | PR 3 | Depende de PR 1 + PR 2 |
| 4 | Pestañas nuevas | PR 4 | Depende de PR 1 + PR 2 |
| 5 | Integración + export + CSS print | PR 5 | Depende de PR 3 + PR 4 |

## Phase 1: Foundation

- [x] 1.1 Crear `src/components/ui/StatCard.tsx` con props KpiCardData
- [x] 1.2 Crear `src/components/ui/ChartWrapper.tsx` con tema oscuro Recharts
- [x] 1.3 Crear `src/components/ui/DataTable.tsx` con paginación server-side (limit 50)
- [x] 1.4 Crear `src/components/ui/ExportButtons.tsx` con botones Imprimir/PDF/Excel
- [x] 1.5 Crear `src/hooks/useReport.ts` con estado filters + search + loading
- [x] 1.6 Crear `src/hooks/useExport.ts` con export print/pdf/xlsx dinámico
- [x] 1.7 Agregar modelo `AuditoriaEvent` + enum `TipoEvento` en `prisma/schema.prisma`
- [x] 1.8 Agregar `html2canvas`, `jspdf`, `xlsx` en `package.json`

## Phase 2: Server Actions

- [x] 2.1 Agregar ~20 funciones de consulta en `src/actions/informes.ts` (Clientes, Proveedores, Finanzas, Auditoría, ventas por producto/categoría/cliente/vendedor, top/bottom, cierres movimientos/diferencias, rentabilidad/reposición/sin-mov, ranking vendedores/actividad, ganancias, frecuencias, stock bajo) con tipos PaginatedResult y ReportFilters

## Phase 3: Pestañas Existentes Mejoradas

- [x] 3.1 Modificar `src/components/reports/VentasReport.tsx`: +7 StatCards, +4 filtros, +7 tablas paginadas, +5 charts
- [x] 3.2 Modificar `src/components/reports/CierresReport.tsx`: +8 StatCards, +filtros estado/diferencia, +6 tablas, +4 charts
- [x] 3.3 Crear `src/components/reports/SubPestanasProductos.tsx` con tabs anidadas + useTransition
- [x] 3.4 Modificar `src/components/reports/ProductosReport.tsx`: +4 subpestañas, +6 StatCards, +4 charts
- [x] 3.5 Modificar `src/components/reports/EmpleadosReport.tsx`: +7 StatCards, +filtros rol/usuario, +4 tablas, +3 charts

## Phase 4: Pestañas Nuevas

- [x] 4.1 Crear `src/components/reports/ClientesReport.tsx`: +6 StatCards, filtros, +5 tablas, +3 charts
- [x] 4.2 Crear `src/components/reports/ProveedoresReport.tsx`: +6 StatCards, filtros, +5 tablas, +3 charts
- [x] 4.3 Crear `src/components/reports/FinanzasReport.tsx`: +6 StatCards, filtros, +5 tablas, +4 charts
- [x] 4.4 Crear `src/components/reports/AuditoriaReport.tsx`: +4 StatCards, filtros, +1 tabla eventos con detalle JSON expandible

## Phase 5: Integración

- [x] 5.1 Modificar `src/app/informes/page.tsx`: +initialData nuevos reports, +getClientesDistinct(), +getMetodosPago()
- [x] 5.2 Modificar `src/components/reports/InformesTabs.tsx`: +4 tabs lazy, +tipos TabId, +TAB_META, permisos
- [x] 5.3 Crear `src/components/reports/report.css`: @media print que oculta chrome, repite thead, muestra título/filtros/KPIs/tablas

## Phase 6: Verificación

- [x] 6.1 Ejecutar `next build` y corregir errores TS/dependencias
- [ ] 6.2 Verificar visual: 8 tabs con KPIs, filtros, tablas, charts sin errores
- [ ] 6.3 Verificar export: print oculta chrome, PDF descarga, Excel multi-sheet descarga
- [ ] 6.4 Verificar regresión: Dashboard y pestañas originales intactos
