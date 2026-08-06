"use client";

import { useCallback, useRef } from "react";

interface Column {
  key: string;
  label: string;
}

interface UseExportOptions {
  filename?: string;
}

interface ExportData {
  [sheetName: string]: Record<string, unknown>[];
}

interface ExportColumns {
  [sheetName: string]: Column[];
}

export function useExport({ filename: baseFilename }: UseExportOptions = {}) {
  const printRef = useRef<HTMLDivElement>(null);

  const getFilename = useCallback(
    (ext: string) => {
      const base = baseFilename || "Informe";
      const date = new Date().toISOString().split("T")[0];
      return `${base}-${date}.${ext}`;
    },
    [baseFilename]
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handlePdf = useCallback(async () => {
    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const html2canvas = html2canvasModule.default;
    const { default: jsPDF } = jsPDFModule;

    const element = printRef.current || document.getElementById("report-content");
    if (!element) return;

    const canvas = await html2canvas(element, {
      backgroundColor: "#0f172a",
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }

    pdf.save(getFilename("pdf"));
  }, [getFilename]);

  const handleExcel = useCallback(
    async (data?: ExportData, columns?: ExportColumns) => {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (data && columns) {
        const sheetNames = Object.keys(data);
        for (const sheetName of sheetNames) {
          const rows = data[sheetName];
          const cols = columns[sheetName] || [];
          const header = cols.map((c) => c.label);
          const body = rows.map((row) =>
            cols.map((c) => row[c.key] ?? "")
          );
          const wsData = [header, ...body];
          const ws = XLSX.utils.aoa_to_sheet(wsData);
          // Auto-width columns
          ws["!cols"] = cols.map((c) => ({ wch: Math.max(c.label.length, 12) }));
          XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
        }
      } else {
        // Fallback: scrape tables from DOM
        const tables = document.querySelectorAll("table");
        tables.forEach((table, i) => {
          const ws = XLSX.utils.table_to_sheet(table as HTMLTableElement);
          XLSX.utils.book_append_sheet(wb, ws, `Tabla ${i + 1}`);
        });
      }

      XLSX.writeFile(wb, getFilename("xlsx"));
    },
    [getFilename]
  );

  return {
    printRef,
    handlePrint,
    handlePdf,
    handleExcel,
  };
}
