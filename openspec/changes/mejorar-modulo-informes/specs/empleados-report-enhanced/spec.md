# Empleados Report Enhanced Specification

## Purpose

Extend the existing Empleados report tab with sales performance KPIs, vendor ranking, activity tables, and Recharts employee visualizations.

## Requirements

### Requirement: KPI Display

The system MUST compute and display 7 KPIs: total empleados (active users with role EMPLEADO or VENDEDOR), ventas realizadas (total sales in period), total vendido (sum total), promedio por empleado (total / count of employees with sales), mejor vendedor (name + amount), usuario con más actividad (most transactions).

#### Scenario: Only employees with sales affect average
- GIVEN 10 active employees but only 6 have sales in the period
- WHEN promedio por empleado calculates
- THEN it divides total vendido by 6, not 10

#### Scenario: Empty period shows no data state
- GIVEN no sales in the period
- WHEN KPIs render
- THEN ventas realizadas shows "0", mejor vendedor shows "—", average shows "$0.00"

### Requirement: Enhanced Filters

The system MUST provide filters: fecha desde/hasta, rol (select from USER/VENDEDOR/ADMIN roles), usuario (select from all active users).

#### Scenario: Rol filter narrows to role
- GIVEN the user selects rol "VENDEDOR"
- WHEN filters apply
- THEN only users with role VENDEDOR appear in tables and KPIs

### Requirement: Data Tables

The system MUST render 4 tables: ranking vendedores (sorted by total vendido descending, with position number), ventas por empleado (grouped by user), productos vendidos por empleado, actividad por usuario (transaction count by type).

#### Scenario: Ranking shows position column
- GIVEN 15 employees with sales
- WHEN ranking vendedores renders
- THEN position 1 shows the highest seller with gold highlight, rows paginate at 20

### Requirement: Recharts Visualizations

The system MUST render 3 charts: ventas por empleado (BarChart), total vendido (BarChart by period), ranking rendimiento (horizontal BarChart).

#### Scenario: Horizontal ranking bar chart orders descending
- GIVEN 10 employees with sales
- WHEN ranking rendimiento renders
- THEN bars display horizontally sorted descending with employee names on Y-axis
