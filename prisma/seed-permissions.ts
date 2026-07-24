import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const DEFAULT_PERMISSIONS: Record<string, { descripcion: string; permisos: string[] }> = {
  ADMINISTRADOR: {
    descripcion: "Acceso completo a todas las funcionalidades del sistema",
    permisos: [
      "dashboard.ver",
      "productos.ver", "productos.crear", "productos.editar", "productos.estado", "productos.restar_stock", "productos.categorias", "productos.marcas", "productos.historial",
      "ventas.ver", "ventas.crear", "ventas.descuentos", "ventas.comprobantes", "ventas.historial",
      "caja.ver", "caja.abrir", "caja.cerrar", "caja.ingresos", "caja.egresos", "caja.movimientos",
      "clientes.ver", "clientes.crear", "clientes.editar", "clientes.estado", "clientes.historial",
      "proveedores.ver", "proveedores.crear", "proveedores.editar", "proveedores.estado",
      "usuarios.ver", "usuarios.crear", "usuarios.editar", "usuarios.estado", "usuarios.foto", "usuarios.roles",
      "informes.ver", "informes.ventas", "informes.caja", "informes.clientes", "informes.productos", "informes.proveedores",
    ],
  },
  ENCARGADO_VENTAS: {
    descripcion: "Gestión de Ventas, Caja y Clientes",
    permisos: [
      "dashboard.ver",
      "ventas.ver", "ventas.crear", "ventas.descuentos", "ventas.comprobantes", "ventas.historial",
      "caja.ver", "caja.abrir", "caja.cerrar", "caja.ingresos", "caja.egresos", "caja.movimientos",
      "clientes.ver", "clientes.crear", "clientes.editar", "clientes.estado", "clientes.historial",
      "informes.ver", "informes.ventas", "informes.caja", "informes.clientes",
    ],
  },
  ENCARGADO_STOCK: {
    descripcion: "Gestión de Inventario y Proveedores",
    permisos: [
      "dashboard.ver",
      "productos.ver", "productos.crear", "productos.editar", "productos.estado", "productos.restar_stock", "productos.categorias", "productos.marcas", "productos.historial",
      "proveedores.ver", "proveedores.crear", "proveedores.editar", "proveedores.estado",
      "informes.ver", "informes.productos", "informes.proveedores",
    ],
  },
};

async function main() {
  console.log("Seeding role permissions...");

  for (const [roleName, config] of Object.entries(DEFAULT_PERMISSIONS)) {
    const role = await prisma.rol.findUnique({ where: { nombre: roleName } });
    if (!role) {
      console.log(`Role ${roleName} not found, skipping.`);
      continue;
    }

    const permisosJson = JSON.stringify({
      activo: true,
      descripcion: config.descripcion,
      permisos: config.permisos,
    });

    await prisma.rol.update({
      where: { id: role.id },
      data: { permisos: permisosJson },
    });

    console.log(`Updated ${roleName}: ${config.permisos.length} permissions`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
