# Auditoría Report Specification

## Purpose

Provide a new report tab displaying available audit data from existing tables (Venta, Caja, Usuario) and prepare the Prisma schema for comprehensive audit logging via a new `AuditoriaEvent` table.

## Requirements

### Requirement: Available Data Display

The system MUST display audit events derived from existing tables: ventas registradas (from Venta with usuarioId, fecha, total, detalle), cierres de caja (from Caja with fechaApertura, fechaCierre, usuarioId, monto), productos existentes (from Producto with fechaCreacion as approximation).

#### Scenario: Ventas appear as audit events
- GIVEN 50 ventas exist in the database
- WHEN the Auditoría report loads
- THEN each venta appears as an event with type "VENTA_REGISTRADA", usuario name, fecha, and monto

#### Scenario: Products without created_at use createdAt
- GIVEN a Producto table that includes createdAt field
- WHEN productos existentes load
- THEN createdAt is displayed as the event date

### Requirement: Auditar schema preparation

The system MUST add an `AuditoriaEvent` model to the Prisma schema with fields: id (UUID), usuarioId (FK to Usuario), tipo (enum: LOGIN, LOGOUT, CREATE_PRODUCT, UPDATE_PRODUCT, DELETE_PRODUCT, PRICE_CHANGE, STOCK_CHANGE, VENTA_ANULADA, CREATE_USER, UPDATE_USER, CREATE_CLIENTE, UPDATE_CLIENTE, CREATE_PROVEEDOR, UPDATE_PROVEEDOR, APERTURA_CAJA, CIERRE_CAJA), detalle (Json), fecha (DateTime @default(now())), modulo (String).

#### Scenario: Migration generates AuditoriaEvent table
- GIVEN the Prisma schema is updated with the AuditoriaEvent model
- WHEN `npx prisma migrate dev` runs
- THEN a new `AuditoriaEvent` table is created with all specified fields and FK to Usuario

### Requirement: KPI Display

The system MUST compute and display 4 KPIs: total eventos (from available + AuditoriaEvent when populated), eventos hoy, usuarios activos hoy (users with events today), total módulos (distinct modulo values).

#### Scenario: KPIs calculate from available data only
- GIVEN no AuditoriaEvent rows exist yet
- WHEN KPIs load
- THEN total eventos counts ventas + cierres, and eventos hoy filters by today's date

### Requirement: Filters and Data Table

The system MUST provide filters: fecha desde/hasta, usuario (select), módulo (select from existing event sources), tipo acción (select from event types). The data table MUST show columns: fecha, usuario, rol, módulo, acción, detalle (expandable JSON).

#### Scenario: Filter shows only caja events
- GIVEN the user selects módulo "CAJA"
- WHEN filters apply
- THEN only cierres de caja appear in the table with action "APERTURA_CAJA" or "CIERRE_CAJA"
