# Finanzas Report Specification

## Purpose

Provide a new report tab for financial analytics: gross profit estimation, margin analysis by product/category/vendor, and cost vs revenue visualization.

## Requirements

### Requirement: KPI Display

The system MUST compute and display 6 KPIs: total vendido (sum precioVenta * cantidad), costo total estimado (sum precioCompra * cantidad sold), ganancia bruta (total vendido - costo total), margen % (ganancia / total * 100), ganancia por producto top (name + profit), ganancia por categoría top (name + profit).

#### Scenario: Margin percentage caps at 100%
- GIVEN a product with costo $0 and precioVenta $100
- WHEN margen % calculates
- THEN it shows 100% (not Infinity or error)

#### Scenario: All costs zero shows no margin
- GIVEN all products have precioCompra = 0
- WHEN margen % calculates
- THEN it shows "0%" since costo total is zero

### Requirement: Filters

The system MUST provide filters: fecha desde/hasta, categoría (select from categories with sales), producto (select from products with sales), usuario (select from users with sales).

#### Scenario: Filter overrides cascade
- GIVEN user selects categoria "Frenos"
- WHEN the producto filter loads
- THEN producto select only shows products in the "Frenos" category that have sales

### Requirement: Data Tables

The system MUST render 5 tables: ganancia por producto, ganancia por categoría, ganancia por vendedor, mayor margen (top 10 by margin %), menor margen (bottom 10 by margin %).

#### Scenario: Menor margen includes negative margins
- GIVEN a product sold below its cost (precioVenta < precioCompra)
- WHEN menor margen renders
- THEN it appears with a negative margin value, highlighted in red

### Requirement: Recharts Visualizations

The system MUST render 4 charts: evolución ganancias (AreaChart with gradient fill), ganancia por categoría (PieChart), top productos por margen (BarChart), ventas vs costos (grouped BarChart).

#### Scenario: Grouped bar compares revenue and cost
- GIVEN sales data for 5 product categories
- WHEN ventas vs costos renders
- THEN each category shows two adjacent bars (venta vs costo) with a legend distinguishing them
