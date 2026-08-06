# Report Export Specification

## Purpose

Provide consistent export functionality (Print, PDF, Excel) across all report tabs, plus a shared `useExport` hook and standardized file naming.

## Requirements

### Requirement: Export Buttons on All Tabs

The system MUST provide 3 action buttons in every report tab: Imprimir, Exportar PDF, Exportar Excel. The existing Buscar button is preserved.

#### Scenario: Buttons appear on every report
- GIVEN the user navigates to any report tab (Ventas, Cierres, Productos, Empleados, Clientes, Proveedores, Finanzas, Auditoría)
- WHEN the tab renders
- THEN Buscar, Imprimir, Exportar PDF, and Exportar Excel buttons display in the toolbar

### Requirement: Print with CSS @media print

The system MUST include CSS `@media print` rules that hide: navbar, sidebar, action buttons, filters, and export UI. The print output MUST show: report title, applied filter values, generation timestamp, user name, KPI values, and data table(s).

#### Scenario: Print hides UI chrome
- GIVEN the user clicks Imprimir
- WHEN the print dialog opens
- THEN the preview shows only title, filters summary, date/user stamp, KPIs, and table(s) — no navigation or buttons

#### Scenario: Long table prints across multiple pages
- GIVEN a table with 200 rows
- WHEN the user prints
- THEN table header row repeats on each printed page via `thead { display: table-header-group; }`

### Requirement: PDF Export

The system MUST provide a PDF export that captures the same content as print mode. It SHOULD use `window.print()` with `Save as PDF` destination as the primary approach. It MAY use `html2canvas` + `jspdf` for enhanced visual control over page breaks and layout.

#### Scenario: PDF downloads with correct filename
- GIVEN the user clicks Exportar PDF on the Ventas tab
- WHEN the export completes
- THEN a file named `Informe-Ventas-{YYYY-MM-DD}.pdf` downloads

### Requirement: Excel Export

The system MUST use SheetJS (`xlsx`) to serialize the currently visible table data to `.xlsx` format. The export MUST include a header row with column names and all visible data rows.

#### Scenario: Excel contains filtered data only
- GIVEN the Ventas report has filters active and shows 25 rows
- WHEN the user clicks Exportar Excel
- THEN the downloaded `Informe-Ventas-{YYYY-MM-DD}.xlsx` file contains 25 data rows plus header, matching the filtered view

#### Scenario: Multiple tables on one tab
- GIVEN a report tab displays multiple tables (e.g., KPIs + detail + summary)
- WHEN exporting to Excel
- THEN each table exports as a separate sheet named by its section (e.g., "Detalle Ventas", "Ventas por Producto")

### Requirement: Shared useExport Hook

The system MUST provide a `useExport` React hook encapsulating export logic. The hook MUST accept: `{ type: 'pdf' | 'excel' | 'print', data: Row[], columns: Column[], filename: string, printContent?: Ref<HTMLDivElement> }`.

#### Scenario: Hook is reusable across tabs
- GIVEN a new report tab is added in the future
- WHEN the developer imports `useExport` and passes the required parameters
- THEN pdf, excel, and print exports work without additional implementation
