"use client";

import React, { useCallback } from "react";
import { Printer, FileText, FileSpreadsheet } from "lucide-react";

interface ExportButtonsProps {
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
}

export default function ExportButtons({
  onPrint,
  onPdf,
  onExcel,
}: ExportButtonsProps) {
  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  }, [onPrint]);

  const handlePdf = useCallback(async () => {
    if (onPdf) {
      onPdf();
      return;
    }
    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const html2canvas = html2canvasModule.default;
    const { default: jsPDF } = jsPDFModule;

    const element = document.getElementById("report-content");
    if (!element) return;

    const canvas = await html2canvas(element, {
      backgroundColor: "#0f172a",
      scale: 2,
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

    pdf.save(`Informe-${new Date().toISOString().split("T")[0]}.pdf`);
  }, [onPdf]);

  const handleExcel = useCallback(async () => {
    if (onExcel) {
      onExcel();
      return;
    }
    const XLSX = await import("xlsx");
    const tables = document.querySelectorAll("[data-export-table]");
    const wb = XLSX.utils.book_new();

    if (tables.length === 0) {
      // Fallback: scrape all visible tables
      const allTables = document.querySelectorAll("table");
      allTables.forEach((table, i) => {
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, `Tabla ${i + 1}`);
      });
    } else {
      tables.forEach((table) => {
        const sheetName = table.getAttribute("data-export-sheet") || "Sheet";
        const ws = XLSX.utils.table_to_sheet(table as HTMLTableElement);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      });
    }

    XLSX.writeFile(wb, `Informe-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [onExcel]);

  const btnClass =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-border/50 text-text-muted hover:bg-border-hover/50 hover:text-text transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button onClick={handlePrint} className={btnClass} title="Imprimir">
        <Printer className="w-3.5 h-3.5" />
        <span>Imprimir</span>
      </button>
      <button onClick={handlePdf} className={btnClass} title="Exportar PDF">
        <FileText className="w-3.5 h-3.5" />
        <span>PDF</span>
      </button>
      <button onClick={handleExcel} className={btnClass} title="Exportar Excel">
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span>Excel</span>
      </button>
    </div>
  );
}
