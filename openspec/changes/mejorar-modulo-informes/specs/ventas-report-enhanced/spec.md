# Ventas Report Enhanced Specification

## Purpose

Extend the existing Ventas report tab with comprehensive KPIs, expanded filters, detailed data tables, and Recharts visualizations for sales analysis.

## Requirements

### Requirement: KPI Display

The system MUST compute and display 7 KPIs for the selected period: cantidad ventas, total vendido, ganancia estimada, promedio por venta, productos vendidos, cliente top (nombre + monto), vendedor top (nombre + monto).

#### Scenario: KPIs reflect filtered data
- GIVEN the user selects a date range with 10 sales totaling $50,000
- WHEN the Ventas report loads
- THEN cantidad ventas shows "10", total vendido shows "$50,000", and cliente top shows the highest-spending client name and amount

#### Scenario: Empty period shows zeros
- GIVEN no sales exist in the selected date range
- WHEN the report loads
- THEN all numeric KPIs display "$0" or "0", and top labels show "—"

### Requirement: Expanded Filters

The system MUST provide filters: fecha desde/hasta, usuario/vendedor (select from active users), cliente (select from clients with sales), producto (select from sold products), categoría (select from categories), método de pago (select from payment methods used).

#### Scenario: All filters default to "Todos"
- GIVEN the Ventas report page loads
- WHEN a user views the filters section
- THEN all filter selects default to "Todos" except fecha which defaults to current month

#### Scenario: Filter combination narrows results
- GIVEN the user selects a specific vendedor "Juan" and categoria "Frenos"
- WHEN the user clicks Buscar
- THEN KPIs and tables only reflect sales by Juan in the Frenos category

### Requirement: Data Tables

The system MUST render 7 tables for the filtered period: detalle de ventas, ventas por producto, ventas por categoría, ventas por cliente, ventas por vendedor, productos más vendidos (top 10), productos menos vendidos (bottom 10).

#### Scenario: Tables paginate beyond 50 rows
- GIVEN the filtered result has 200 sales
- WHEN the detalle de ventas table renders
- THEN it paginates at 50 rows per page with Previous/Next controls

#### Scenario: Top and bottom tables show correct extremes
- GIVEN 30 products with sales in the period
- WHEN productos más vendidos and productos menos vendidos render
- THEN the first shows the 10 highest-quantity rows, the second shows the 10 lowest with positive sales

### Requirement: Recharts Visualizations

The system MUST render 5 Recharts charts: ventas por día (BarChart), ventas por mes (BarChart), top 10 productos (BarChart horizontal), ventas por vendedor (BarChart), ventas por categoría (PieChart).

#### Scenario: Charts render with data
- GIVEN sales data exists for the last 30 days
- WHEN the report loads
- THEN all 5 charts render with correct axis labels and tooltips on hover

#### Scenario: Single-day data renders single bar
- GIVEN all sales occurred on a single day
- WHEN ventas por día chart renders
- THEN it shows a single bar for that day with the correct total
