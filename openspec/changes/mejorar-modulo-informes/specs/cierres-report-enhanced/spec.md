# Cierres Report Enhanced Specification

## Purpose

Extend the existing Cierres report tab with KPIs, expanded filters, detailed cash-closing tables, and Recharts visualizations for cash movement analysis.

## Requirements

### Requirement: KPI Display

The system MUST compute and display 8 KPIs: total cierres, abiertos, cerrados, monto inicial, total vendido, total esperado, diferencia total, cierres con diferencia.

#### Scenario: KPIs compute correctly from filtered data
- GIVEN 5 cierres in the period: 3 cerrados, 2 abiertos, with one having a $100 difference
- WHEN the report loads
- THEN abiertos shows "2", cerrados shows "3", cierres con diferencia shows "1", diferencia total shows "$100"

#### Scenario: All cierres balanced shows zero difference
- GIVEN all cierres in the period have zero difference
- WHEN the report loads
- THEN diferencia total shows "$0" and cierres con diferencia shows "0"

### Requirement: Enhanced Filters

The system MUST provide filters: fecha desde/hasta, usuario (select from cashiers), estado caja (select: TODAS, ABIERTA, CERRADA), con diferencia / sin diferencia (toggle or select: TODOS, CON DIFERENCIA, SIN DIFERENCIA).

#### Scenario: Estado filter only shows matching cierres
- GIVEN the user selects estado "ABIERTA"
- WHEN the report filters
- THEN only cierres where fechaCierre IS NULL are shown

### Requirement: Data Tables

The system MUST render 6 tables: historial cierres, movimientos por cierre, ingresos, egresos, diferencias, cierres con inconsistencia.

#### Scenario: Click on cierre row expands movements
- GIVEN the historial table shows 10 cierres
- WHEN the user clicks a cierre row
- THEN movimientos por cierre table loads showing ingresos, egresos, and difference items for that cierre

#### Scenario: Cierres con inconsistencia highlights mismatches
- GIVEN a cierre where totalEsperado !== totalVendido
- WHEN the cierres con inconsistencia table renders
- THEN that cierre appears highlighted with the discrepancy amount

### Requirement: Recharts Visualizations

The system MUST render 4 charts: evolución diaria (AreaChart), ingresos vs egresos (BarChart), diferencias (BarChart), cierres por usuario (PieChart).

#### Scenario: Evolution chart spans date range
- GIVEN selected range covers 30 days with daily cierres
- WHEN evolución diaria renders
- THEN the AreaChart shows a continuous line with daily totals and date axis labels
