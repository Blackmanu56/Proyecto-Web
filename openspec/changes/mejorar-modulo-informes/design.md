# Design: Mejorar Módulo Informes

## Technical Approach

Extender 4 tabs existentes + crear 4 nuevos tabs siguiendo el patrón actual: Server Component → `InformesTabs` (client) → `*Report` (client con `useState` + `useTransition`). Extraer lógica compartida en hooks y componentes UI. Nuevas server actions en `informes.ts`. Export via hook `useExport`: `window.print()` primario + `html2canvas`/`jspdf`/`xlsx` dinámicos.

## Architecture Decisions

| # | Decisión | Choice | Alternativa | Rationale |
|---|----------|--------|-------------|-----------|
| 1 | ChartWrapper | `ChartWrapper.tsx` con tema oscuro consistente | Recharts inline por tab | 30+ charts, reducir boilerplate |
| 2 | Export PDF | `window.print()` + dynamic `html2canvas`+`jspdf` | Solo print CSS | Spec requiere PDF descargable |
| 3 | Export Excel | dynamic `xlsx` (SheetJS) | CSV manual | Spec requiere .xlsx multi-sheet |
| 4 | StatCard | `src/components/ui/StatCard.tsx` | Inline por tab | 8 tabs × 6-8 KPIs = 50+ cards |
| 5 | AuditoríaEvent | Agregar modelo Prisma `AuditoriaEvent` | Solo datos existentes | Spec requiere schema preparation |
| 6 | Método pago filtro | `SELECT DISTINCT metodoPago FROM ventas` | Hardcodeado | Data-driven, futuro-proof |
| 7 | Clientes/Proveedores | Misma estructura que tabs existentes | Componente genérico | Sigue patrón probado |
| 8 | Lazy loading | Dynamic import para 4 tabs nuevos | Static imports | 4 nuevos = ~40% bundle bump |
| 9 | Ganancia | `(precioVenta - precioCompra) * cantidadVendida` | Purchase records | Datos disponibles, simpler |
| 10 | Paginación | Server-side (limit 50) para tablas grandes, client-side para top/bottom | Todo client-side | 1000s de ventas, payload grande |
| 11 | useReport hook | `src/hooks/useReport.ts` + `useExport.ts` | Todo en cada tab | Patrón idéntico en 8 tabs |
| 12 | Permisos tabs nuevos | `clientes/proveedores/finanzas` → ADMIN+ENCARGADO_VENTAS; `auditoria` → ADMIN | Mismos roles existentes | Coherencia con tabs actuales |

## Data Flow

```
informes/page.tsx (Server)
  ├── getSession(), getReporteVentas*(fecha), getCategorias(), getUsuariosActivos()
  └── <InformesTabs initialVentas={} initialCierres={} ... usuarios={} categorias={} />
       │
       └── InformesTabs (Client)
            ├── dynamic(() => import("./VentasReport"))  ← tabs existentes (static)
            ├── dynamic(() => import("./ClientesReport")) ← tabs nuevos (lazy)
            ├── useState<TabId>
            └── render: <Reporte key={activeTab} initialData={} />
                 │
                 └── *Report (Client)
                      ├── useState(initialData)
                      ├── <ReportFilters /> → startTransition → server action → setData
                      ├── <StatCard /> × N
                      ├── <ChartWrapper /> × N (ResponsiveContainer + Recharts)
                      ├── <DataTable /> paginada (server-side offset 50)
                      └── <ExportButtons /> (useExport hook)
```

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/components/ui/StatCard.tsx` | KPI card: label, value, icon, color, variant |
| `src/components/ui/ChartWrapper.tsx` | Recharts wrapper with dark theme defaults |
| `src/components/ui/DataTable.tsx` | Tabla paginada reutilizable (server-side) |
| `src/components/ui/ExportButtons.tsx` | Botones Imprimir/PDF/Excel |
| `src/components/reports/ClientesReport.tsx` | Tab Clientes: KPIs, 5 tablas, 3 charts |
| `src/components/reports/ProveedoresReport.tsx` | Tab Proveedores: KPIs, 5 tablas, 3 charts |
| `src/components/reports/FinanzasReport.tsx` | Tab Finanzas: KPIs, 5 tablas, 4 charts |
| `src/components/reports/AuditoriaReport.tsx` | Tab Auditoría: KPIs, tabla eventos, filtros |
| `src/hooks/useReport.ts` | Hook genérico: filters state + search + loading |
| `src/hooks/useExport.ts` | Hook export: print/pdf/excel with dynamic imports |

### Modified Files

| File | Change |
|------|--------|
| `src/app/informes/page.tsx` | +initialData para Clientes, Proveedores, Finanzas, Auditoría; +getClientesDistinct(), getMetodosPago() |
| `src/components/reports/InformesTabs.tsx` | +4 tabs con dynamic import; +TabId tipos; +TAB_META entries; permiso rules |
| `src/components/reports/VentasReport.tsx` | +7 KPIs (StatCard), +4 filtros (producto, categoría, método pago), +7 tablas (paginadas), +5 charts |
| `src/components/reports/CierresReport.tsx` | +8 KPIs, +filtros estado/diferencia, +6 tablas (detalle expandible), +4 charts |
| `src/components/reports/ProductosReport.tsx` | +4 subpestañas (Rentabilidad/Movimientos/Reposición/SinMov), +6 KPIs, +4 charts |
| `src/components/reports/EmpleadosReport.tsx` | +7 KPIs, +2 filtros, +4 tablas, +3 charts |
| `src/actions/informes.ts` | +15 nuevas funciones (getReporteClientes, getReporteProveedores, getReporteFinanzas, getEventosAuditoria, etc.) |
| `prisma/schema.prisma` | +model AuditoriaEvent con enum TipoEvento |
| `package.json` | +html2canvas, +jspdf, +xlsx |

## Interfaces

```typescript
// Shared KPI card
interface KpiCardData {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'purple';
  trend?: { direction: 'up' | 'down'; value: string };
}

// Report filter state (consumed by useReport)
interface ReportFilters {
  fechaDesde: string;
  fechaHasta: string;
  usuarioId?: number;
  clienteId?: number;
  productoId?: number;
  categoriaId?: number;
  proveedorId?: number;
  metodoPago?: string;
  estado?: string;
  rol?: string;
  conDiferencia?: boolean;
}

// Paginated response
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Export hook
type ExportType = 'pdf' | 'excel' | 'print';
interface UseExportOptions {
  type: ExportType;
  data: Record<string, any[]>;
  columns: Record<string, { key: string; label: string }[]>;
  filename: string;
  printRef?: RefObject<HTMLDivElement>;
}
```

## Testing Strategy

Sin test runner configurado. Verificación visual:

| Paso | Qué verificar |
|------|---------------|
| `next build` | Sin errores TypeScript ni de dependencias |
| 8 tabs | KPIs, filtros, tablas, charts renderizan |
| Export | PDF descarga, Excel descarga, print oculta navbar |
| Dashboard | Ventas/Cierres/Productos/Empleados originales intactos |
| Tabs existentes | Sin regresión en funcionalidad actual |

## Open Questions

- [ ] ¿html2canvas + jspdf como dependencias fijas o dynamic import? Dynamic import es más seguro pero agrega latencia en primera exportación.
- [ ] AuditoríaEvent: ¿migración ahora o mark as future work y mostrar solo datos existentes? Spec dice "prepare schema" (crear modelo), pero seed data no.
