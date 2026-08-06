# Productos Report Enhanced Specification

## Purpose

Restructure the existing Productos report tab with sub-tabs for Rentabilidad, Movimientos Stock, Reposición Sugerida, and Productos Sin Movimiento, plus KPIs, enhanced tables, and Recharts charts.

## Requirements

### Requirement: KPI Display

The system MUST compute and display 6 KPIs: valor total compra (sum precioCompra * stockActual), valor total venta (sum precioVenta * stockActual), ganancia potencial (valor venta - valor compra), stock crítico (productos where stockActual < stockMinimo), productos sin ventas, mayor margen (producto name + margin %).

#### Scenario: KPIs reflect all active products
- GIVEN 200 active products with $100K total purchase value and $180K total sale value
- WHEN the report loads
- THEN ganancia potencial shows "$80,000" and stock crítico shows the count of understocked products

### Requirement: Four Sub-tabs

The system MUST render 4 sub-pestañas: Rentabilidad, Movimientos, Reposición Sugerida, Sin Movimiento. Each sub-tab loads its data independently using `useTransition`.

#### Scenario: Switching sub-tab shows different content
- GIVEN the user is viewing Rentabilidad
- WHEN the user clicks "Reposición Sugerida"
- THEN the Reposición table loads showing products where stockActual < stockMinimo with suggested order quantities

#### Scenario: Lazy load on tab switch
- GIVEN the user switches to "Sin Movimiento" for the first time
- WHEN the tab activates
- THEN a server action fetches products with zero sales in the period, showing a brief loading state

### Requirement: Per-Subtab Tables

Each sub-tab MUST render its specific table: Rentabilidad (productos mayor/menor rentabilidad), Movimientos (historial compras/ventas que afectaron stock), Reposición (stockActual < stockMinimo + suggested qty based on sales velocity), Sin Movimiento (products with 0 sales in period).

#### Scenario: Rentabilidad sorts by margin descending
- GIVEN 50 products with varying cost/price ratios
- WHEN the Rentabilidad table renders
- THEN rows sort by margin % descending, showing 10 products with highest margin first

### Requirement: Recharts Visualizations

The system MUST render 4 charts: stock por categoría (PieChart), valor stock por proveedor (BarChart), top 10 por ganancia (BarChart), stock bajo (BarChart).

#### Scenario: PieChart shows category stock distribution
- GIVEN products span 5 categories
- WHEN stock por categoría renders
- THEN each category appears as a pie slice proportional to its total stock quantity, with a legend
