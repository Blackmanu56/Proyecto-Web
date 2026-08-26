import React from "react";
import { getSession } from "@/lib/auth.server";
import { getProductos } from "@/actions/productos";
import { getCategorias, getProveedores } from "@/actions/auxiliares";
import ProductosTable from "@/components/tables/ProductosTable";
import { Package } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    status?: string;
  }>;
}

export default async function ProductosPage({ searchParams }: PageProps) {
  const session = await getSession();
  
  const userRole = session?.role || "ENCARGADO_STOCK";

  const allowedRoles = ["ADMINISTRADOR", "ENCARGADO_STOCK"];
  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold">Acceso Denegado</p>
          <p className="text-slate-500 text-sm mt-2">
            No tiene permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const query = params.q || "";
  const catFilter = params.cat ? Number(params.cat) : undefined;

  const [productos, categorias, proveedores] = await Promise.all([
    getProductos(query, catFilter, undefined),
    getCategorias(),
    getProveedores(),
  ]);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex flex-col items-center justify-center shrink-0 mb-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <Package size={24} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
              Control de Inventario
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Gestión y seguimiento del inventario
          </p>
        </div>

        {/* Tabla Interactiva */}
        <div className="flex-1 min-h-0">
          <React.Suspense fallback={null}>
            <ProductosTable
              initialProducts={productos as React.ComponentProps<typeof ProductosTable>["initialProducts"]}
              categorias={categorias}
              proveedores={proveedores as React.ComponentProps<typeof ProductosTable>["proveedores"]}
              userRole={userRole}
            />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}
