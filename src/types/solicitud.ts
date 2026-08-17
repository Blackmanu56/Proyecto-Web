/**
 * Shared type for solicitud de reposicion across PedidosTable,
 * AprobarPedidoModal, and CrearPedidoModal.
 *
 * Derived from Prisma `solicitudReposicion` include shape.
 */

export interface SolicitudProducto {
  id: number;
  nombre: string;
  imagen?: string | null;
  precioCompra: number;
}

export interface SolicitudItem {
  id: number;
  cantidad: number;
  costoUnitario: number;
  total: number;
  origenPago: string;
  pagos?: unknown;
  motivo?: string | null;
  respuesta?: string | null;
  estado: string;
  createdAt: string | Date;
  resueltoEn?: string | Date | null;
  producto: SolicitudProducto;
  proveedor: { id: number; nombre: string };
  solicitante: { username: string };
  aprobador?: { username: string } | null;
  compra?: { id: number; total: number } | null;
}
