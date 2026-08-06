# Proveedores Report Specification

## Purpose

Provide a new report tab for supplier analytics: product association, inventory value by supplier, stock alerts, and purchase history.

## Requirements

### Requirement: KPI Display

The system MUST compute and display 6 KPIs: total proveedores, activos, productos asociados (products linked to any supplier), valor total stock (sum precioCompra * stockActual for supplier-linked products), proveedor con más productos (name + count), proveedor con mayor valor inventario (name + value).

#### Scenario: Only supplier-linked products count
- GIVEN 1000 products total, 600 linked to suppliers, $200K total stock value for linked products
- WHEN KPIs load
- THEN productos asociados shows "600", valor total stock shows "$200,000"

#### Scenario: No suppliers exist
- GIVEN zero suppliers in the database
- WHEN KPIs load
- THEN all KPIs show "0" or "—", and a "No hay proveedores registrados" message displays

### Requirement: Filters

The system MUST provide filters: proveedor (select from active suppliers), categoría (select from product categories), estado producto (select: ACTIVO, INACTIVO, TODOS).

#### Scenario: Categoría filter narrows supplier products
- GIVEN a supplier provides products across 3 categories
- WHEN the user selects one category
- THEN only products in that category appear in the tables

### Requirement: Data Tables

The system MUST render 5 tables: productos por proveedor, valor inventario por proveedor, stock bajo por proveedor, proveedores más utilizados (by purchase count), última compra (proveedor + date).

#### Scenario: Stock bajo highlights critical items
- GIVEN a supplier has 5 products with stockActual < stockMinimo
- WHEN stock bajo por proveedor renders
- THEN those 5 products appear highlighted in red with current stock and minimum columns

### Requirement: Recharts Visualizations

The system MUST render 3 charts: valor stock por proveedor (BarChart), cantidad productos por proveedor (BarChart), stock crítico por proveedor (BarChart).

#### Scenario: Charts show top 10 suppliers
- GIVEN 25 suppliers with inventory data
- WHEN valor stock por proveedor renders
- THEN the BarChart shows the top 10 suppliers by inventory value, sorted descending
