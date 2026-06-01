# Clientes Report Specification

## Purpose

Provide a new report tab for client analytics: acquisition tracking, purchase history, frequency analysis, and inactivity detection.

## Requirements

### Requirement: KPI Display

The system MUST compute and display 6 KPIs: total clientes, clientes nuevos (created within period), activos (had ≥1 sale in period), inactivos (no sales in period but existed), cliente top (name + total spent), total facturado a clientes.

#### Scenario: New vs active distinction
- GIVEN 100 total clients: 10 created this month, 50 had sales this month
- WHEN KPIs load
- THEN clientes nuevos shows "10", activos shows "50", inactivos shows "50"

#### Scenario: Zero sales for all clients
- GIVEN no sales in the period
- WHEN KPIs load
- THEN total facturado shows "$0" and cliente top shows "—"

### Requirement: Filters

The system MUST provide filters: fecha desde/hasta, cliente (select from all clients), estado activo/inactivo/todos.

#### Scenario: Inactivo filter shows only dormant clients
- GIVEN the user selects estado "INACTIVO"
- WHEN filters apply
- THEN tables only include clients with zero sales in the period

### Requirement: Data Tables

The system MUST render 5 tables: clientes que más compran (ranking descending by total spent), historial compras por cliente (expandable), clientes inactivos, frecuencia de compra (avg days between purchases), última compra (client + date).

#### Scenario: Click client row expands purchase history
- GIVEN the ranking table shows 20 clients
- WHEN the user clicks a client row
- THEN historial compras section loads showing that client's individual sales chronologically

### Requirement: Recharts Visualizations

The system MUST render 3 charts: top 10 clientes por facturación (BarChart), clientes nuevos por mes (BarChart), frecuencia de compra (PieChart showing daily/weekly/monthly/yearly segments).

#### Scenario: Frecuencia PieChart segments correctly
- GIVEN client purchase frequencies of: 20 weekly, 30 monthly, 10 yearly
- WHEN frecuencia de compra renders
- THEN PieChart shows 33% weekly, 50% monthly, 17% yearly segments with legend
