# Proposal: Mejorar Módulo Informes

## Intent

Módulo Informes sin KPIs, gráficos ni exportación. Transformar 4 pestañas existentes + 4 nuevas + exportación PDF/Excel/impresión.

## Scope

**In**: Ventas/Cierres/Productos/Empleados mejorados; Clientes/Proveedores/Finanzas/Auditoría nuevos; StatCard UI; 15+ server actions; PDF/Excel/print; registro en tabs.
**Out**: BD auditoría separada, API REST, login social, Redis, tests E2E.

## Capabilities

### New Capabilities
- `ventas-report-enhanced`: KPIs + filtros usuario/cliente/producto/categoría/metodoPago + tablas detalle/vendedor/top-bottom + gráficos día/mes/vendedor/categoría
- `cierres-report-enhanced`: KPIs cierres/diferencias + filtros estado/diferencia + tabla movimientos/ingresos/egresos + gráficos evolución
- `productos-report-enhanced`: Subpestañas Rentabilidad/Stock/Movimientos/Reposición/SinMov + KPIs stock crítico + gráficos categoría/proveedor
- `empleados-report-enhanced`: KPIs + ranking vendedores + tabla actividad + gráficos ventas/empleado
- `clientes-report`: KPIs nuevos/activos/top + tablas historial/frecuencia/inactivos + gráficos evolución
- `proveedores-report`: KPIs + tablas productos/inventario/stock bajo/última compra
- `finanzas-report`: KPIs ganancia/margen + tablas producto/categoría/vendedor + gráficos evolución
- `auditoria-report`: Log login/CRUD/cambios precio/stock/ventas/cajas con filtros
- `report-export`: Buscar + Imprimir + PDF + Excel en todas las pestañas

### Modified Capabilities: Ninguna

## Approach

1. **StatCard** → `src/components/ui/StatCard.tsx`
2. **Server actions** → 15+ queries en `actions/informes.ts`
3. **Componentes existentes** → agregar KPIs, filtros expandidos, tablas, Recharts
4. **Componentes nuevos** → `*Report.tsx` (filtros + KPIs + tablas + gráficos)
5. **Tabs** → `InformesTabs.tsx` +4 lazy imports
6. **Export** → hook `useExport`: CSS print + html2canvas/jspdf + xlsx
7. **Implementación independiente por pestaña**

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/reports/InformesTabs.tsx` | Modified | +4 pestañas |
| 4 reports existentes | Modified | KPIs, filtros, gráficos, tablas |
| 4 reports nuevos | New | Clientes, Proveedores, Finanzas, Auditoría |
| `src/components/ui/StatCard.tsx` | New | Componente KPI |
| `src/actions/informes.ts` | Modified | +15 funciones |
| `package.json` | Modified | +html2canvas, +jspdf, +xlsx |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Queries lentas joins masivos | Med | Paginación, límite 500 |
| Rotura pestañas existentes | Low | Cambios aditivos |
| Dependencias export rompen build | Low | Import dinámico |

## Rollback Plan

`git revert` del merge. Cada pestaña es commit independiente — hotfix antes del merge si falla.

## Dependencies

- `html2canvas`, `jspdf`, `xlsx` (npm)
- Prisma schema cubre tablas; Recharts ya instalado

## Success Criteria

- [ ] Cada pestaña muestra datos filtrables sin errores
- [ ] Gráficos Recharts (bar, pie, area) renderizan
- [ ] Exportación PDF y Excel descargan contenido correcto
- [ ] Impresión oculta navbar/botones
- [ ] Build `next build` pasa sin errores
- [ ] Dashboard y pestañas originales funcionan
