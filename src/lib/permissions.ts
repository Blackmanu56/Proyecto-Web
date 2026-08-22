export const PERMISSIONS = {
  dashboard: {
    label: "Dashboard",
    icon: "LayoutDashboard",
    permissions: [
      { key: "dashboard.ver", label: "Ver dashboard" },
    ],
  },
  productos: {
    label: "Productos",
    icon: "Package",
    permissions: [
      { key: "productos.ver", label: "Ver productos" },
      { key: "productos.crear", label: "Crear productos" },
      { key: "productos.editar", label: "Editar productos" },
      { key: "productos.estado", label: "Cambiar estado" },
      { key: "productos.restar_stock", label: "Restar stock" },
      { key: "productos.reponer", label: "Solicitar reposición" },
      { key: "productos.aprobar_reposicion", label: "Aprobar reposición" },
      { key: "productos.categorias", label: "Administrar categorías" },
      { key: "productos.marcas", label: "Administrar marcas" },
      { key: "productos.historial", label: "Ver historial" },
      { key: "productos.solicitar_stock", label: "Solicitar modificación de stock" },
      { key: "productos.aprobar_solicitud_stock", label: "Aprobar solicitud de stock" },
    ],
  },
  ventas: {
    label: "Ventas",
    icon: "ShoppingCart",
    permissions: [
      { key: "ventas.ver", label: "Ver ventas" },
      { key: "ventas.crear", label: "Crear venta" },
      { key: "ventas.descuentos", label: "Aplicar descuentos" },
      { key: "ventas.comprobantes", label: "Emitir comprobantes" },
      { key: "ventas.historial", label: "Ver historial" },
    ],
  },
  caja: {
    label: "Caja",
    icon: "Wallet",
    permissions: [
      { key: "caja.ver", label: "Ver caja" },
      { key: "caja.abrir", label: "Abrir caja" },
      { key: "caja.cerrar", label: "Cerrar caja" },
      { key: "caja.ingresos", label: "Registrar ingresos" },
      { key: "caja.egresos", label: "Registrar egresos" },
      { key: "caja.movimientos", label: "Ver movimientos" },
    ],
  },
  clientes: {
    label: "Clientes",
    icon: "Users",
    permissions: [
      { key: "clientes.ver", label: "Ver clientes" },
      { key: "clientes.crear", label: "Crear clientes" },
      { key: "clientes.editar", label: "Editar clientes" },
      { key: "clientes.estado", label: "Cambiar estado" },
      { key: "clientes.historial", label: "Ver historial de compras" },
    ],
  },
  proveedores: {
    label: "Proveedores",
    icon: "Truck",
    permissions: [
      { key: "proveedores.ver", label: "Ver proveedores" },
      { key: "proveedores.crear", label: "Crear proveedores" },
      { key: "proveedores.editar", label: "Editar proveedores" },
      { key: "proveedores.estado", label: "Cambiar estado" },
    ],
  },
  usuarios: {
    label: "Usuarios",
    icon: "UserCog",
    permissions: [
      { key: "usuarios.ver", label: "Ver usuarios" },
      { key: "usuarios.crear", label: "Crear usuarios" },
      { key: "usuarios.editar", label: "Editar usuarios" },
      { key: "usuarios.estado", label: "Cambiar estado" },
      { key: "usuarios.foto", label: "Cambiar fotografía" },
      { key: "usuarios.roles", label: "Administrar roles" },
    ],
  },
  informes: {
    label: "Informes",
    icon: "BarChart3",
    permissions: [
      { key: "informes.ver", label: "Ver informes" },
      { key: "informes.ventas", label: "Informes de ventas" },
      { key: "informes.caja", label: "Informes de caja" },
      { key: "informes.clientes", label: "Informes de clientes" },
      { key: "informes.productos", label: "Informes de productos" },
      { key: "informes.proveedores", label: "Informes de proveedores" },
    ],
  },
};

export type PermissionKey = string;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMINISTRADOR: Object.values(PERMISSIONS).flatMap(m =>
    m.permissions.map(p => p.key)
  ),
  ENCARGADO_VENTAS: [
    "dashboard.ver",
    "ventas.ver", "ventas.crear", "ventas.descuentos", "ventas.comprobantes", "ventas.historial",
    "caja.ver", "caja.abrir", "caja.cerrar", "caja.ingresos", "caja.egresos", "caja.movimientos",
    "clientes.ver", "clientes.crear", "clientes.editar", "clientes.estado", "clientes.historial",
    "informes.ver", "informes.ventas", "informes.caja", "informes.clientes",
  ],
  ENCARGADO_STOCK: [
    "dashboard.ver",
    "productos.ver", "productos.crear", "productos.editar", "productos.estado", "productos.reponer", "productos.categorias", "productos.marcas", "productos.historial", "productos.solicitar_stock",
    "proveedores.ver", "proveedores.crear", "proveedores.editar", "proveedores.estado",
    "informes.ver", "informes.productos", "informes.proveedores",
  ],
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMINISTRADOR: "Acceso completo a todas las funcionalidades del sistema",
  ENCARGADO_VENTAS: "Gestión de Ventas, Caja y Clientes",
  ENCARGADO_STOCK: "Gestión de Inventario y Proveedores",
};

export function hasPermission(userPermissions: string[] | null, permission: string): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(permission);
}

export function getAllPermissions(): string[] {
  return Object.values(PERMISSIONS).flatMap(m => m.permissions.map(p => p.key));
}

export function parseRoleData(permisosRaw: string | null): {
  activo: boolean;
  descripcion: string;
  permisos: string[];
} {
  if (!permisosRaw) {
    return { activo: true, descripcion: "", permisos: [] };
  }
  try {
    const parsed = JSON.parse(permisosRaw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return {
        activo: parsed.activo ?? true,
        descripcion: parsed.descripcion ?? "",
        permisos: Array.isArray(parsed.permisos) ? parsed.permisos : [],
      };
    }
    if (Array.isArray(parsed)) {
      return { activo: true, descripcion: "", permisos: parsed };
    }
    return { activo: true, descripcion: "", permisos: [] };
  } catch {
    return { activo: true, descripcion: "", permisos: [] };
  }
}

export function serializeRoleData(data: {
  activo: boolean;
  descripcion?: string;
  permisos: string[];
}): string {
  return JSON.stringify({
    activo: data.activo,
    descripcion: data.descripcion ?? "",
    permisos: data.permisos,
  });
}
