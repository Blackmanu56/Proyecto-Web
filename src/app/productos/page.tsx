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
  
  // Si no hay sesión, Next.js Middleware redirige automáticamente a /login
  const userRole = session?.role || "VENDEDOR";

  const params = await searchParams;
  const query = params.q || "";
  const catFilter = params.cat ? Number(params.cat) : undefined;

  // Carga de datos simultánea en el servidor para velocidad óptima
  // Se cargan todos los productos (activos e inactivos); el filtro de estado se aplica del lado cliente
  const [productos, categorias, proveedores] = await Promise.all([
    getProductos(query, catFilter, undefined),
    getCategorias(),
    getProveedores(),
  ]);

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/10">
              <Package size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Control de Inventario
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
                Gestione existencias de repuestos, categorías, proveedores y reposiciones.
              </p>
            </div>
          </div>
        </div>

        {/* Tabla Interactiva y Formularios (Client Component) */}
        <ProductosTable
          initialProducts={productos as any}
          categorias={categorias}
          proveedores={proveedores as any}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
