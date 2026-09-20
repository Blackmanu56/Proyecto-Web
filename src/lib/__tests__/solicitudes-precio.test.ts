import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    solicitudPrecio: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ajustePrecio: {
      create: vi.fn(),
    },
    ajustePrecioDetalle: {
      create: vi.fn(),
    },
    movimientoProducto: {
      create: vi.fn(),
    },
    notificacion: {
      create: vi.fn(),
    },
    preferenciaNotificacion: {
      findUnique: vi.fn(),
    },
  };

  return {
    tx,
    getSession: vi.fn(),
    requirePermission: vi.fn(),
    registrarMovimiento: vi.fn(),
    revalidatePath: vi.fn(),
    preferenciaNotificacion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    solicitudPrecio: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
    },
    rol: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    usuario: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    notificacion: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
});

vi.mock("@/lib/auth.server", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/movimiento-producto", () => ({
  registrarMovimiento: mocks.registrarMovimiento,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitudPrecio: mocks.solicitudPrecio,
    producto: mocks.producto,
    rol: mocks.rol,
    usuario: mocks.usuario,
    preferenciaNotificacion: mocks.preferenciaNotificacion,
    notificacion: mocks.notificacion,
    $transaction: mocks.$transaction,
  },
}));

import {
  crearSolicitudPrecio,
  aprobarSolicitudPrecio,
  rechazarSolicitudPrecio,
  cancelarSolicitudPrecio,
} from "@/actions/solicitudes-precio";

describe("Solicitudes de Cambio de Precio - Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.$transaction.mockImplementation(async (callback: any) => callback(mocks.tx));
    mocks.requirePermission.mockImplementation(async (_perm: string, session: any) => {
      if (!session) throw new Error("No autenticado.");
      return session;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("crearSolicitudPrecio", () => {
    it("retorna error si no está autenticado", async () => {
      mocks.getSession.mockResolvedValue(null);

      const res = await crearSolicitudPrecio({
        productoId: 1,
        nuevoPrecioVenta: 1500,
        motivo: "Actualización de costos",
      });

      expect(res).toEqual({ error: "No autenticado." });
    });

    it("retorna error si el producto no existe", async () => {
      mocks.getSession.mockResolvedValue({ userId: 2, username: "empleado", role: "ENCARGADO_STOCK" });
      mocks.producto.findUnique.mockResolvedValue(null);

      const res = await crearSolicitudPrecio({
        productoId: 999,
        nuevoPrecioVenta: 1500,
        motivo: "Actualización de costos",
      });

      expect(res).toEqual({ error: "Producto no encontrado." });
    });

    it("retorna error si no se especifican cambios de precio", async () => {
      mocks.getSession.mockResolvedValue({ userId: 2, username: "empleado", role: "ENCARGADO_STOCK" });
      mocks.producto.findUnique.mockResolvedValue({
        id: 1,
        nombre: "Bujía Bosch",
        precioCompra: 1000,
        precioVenta: 1500,
      });

      const res = await crearSolicitudPrecio({
        productoId: 1,
        nuevoPrecioCompra: 1000,
        nuevoPrecioVenta: 1500,
        motivo: "Mismo precio",
      });

      expect(res).toEqual({ error: "Los nuevos precios deben ser diferentes a los precios actuales." });
    });

    it("crea la solicitud en estado PENDIENTE y genera notificaciones", async () => {
      mocks.getSession.mockResolvedValue({ userId: 2, username: "empleado_stock", role: "ENCARGADO_STOCK" });
      mocks.producto.findUnique.mockResolvedValue({
        id: 1,
        nombre: "Bujía Bosch",
        precioCompra: 1000,
        precioVenta: 1500,
      });
      mocks.solicitudPrecio.create.mockResolvedValue({
        id: 10,
        productoId: 1,
        solicitanteId: 2,
        precioCompraActual: 1000,
        precioCompraNuevo: 1200,
        precioVentaActual: 1500,
        precioVentaNuevo: 1800,
        motivo: "Aumento de proveedor",
        estado: "PENDIENTE",
      });
      mocks.rol.findMany.mockResolvedValue([{ id: 1, nombre: "ADMINISTRADOR" }]);
      mocks.usuario.findMany.mockResolvedValue([{ id: 1 }]);
      mocks.preferenciaNotificacion.findMany.mockResolvedValue([]);
      mocks.preferenciaNotificacion.findUnique.mockResolvedValue({ habilitada: true });

      const res = await crearSolicitudPrecio({
        productoId: 1,
        nuevoPrecioCompra: 1200,
        nuevoPrecioVenta: 1800,
        motivo: "Aumento de proveedor",
      });

      expect(res.success).toBe(true);
      expect(res.solicitudId).toBe(10);
      expect(mocks.solicitudPrecio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productoId: 1,
            solicitanteId: 2,
            precioCompraActual: 1000,
            precioCompraNuevo: 1200,
            precioVentaActual: 1500,
            precioVentaNuevo: 1800,
            motivo: "Aumento de proveedor",
            estado: "PENDIENTE",
          }),
        })
      );
      expect(mocks.notificacion.createMany).toHaveBeenCalled();
      expect(mocks.notificacion.create).toHaveBeenCalled();
    });
  });

  describe("aprobarSolicitudPrecio", () => {
    it("retorna error si el usuario no es administrador", async () => {
      mocks.getSession.mockResolvedValue({ userId: 2, role: "ENCARGADO_STOCK" });

      const res = await aprobarSolicitudPrecio(10);

      expect(res).toEqual({ error: "Solo los administradores pueden aprobar solicitudes de cambio de precio." });
    });

    it("retorna error si la solicitud no está pendiente", async () => {
      mocks.getSession.mockResolvedValue({ userId: 1, role: "ADMINISTRADOR" });
      mocks.tx.solicitudPrecio.findUnique.mockResolvedValue({
        id: 10,
        estado: "APROBADA",
        producto: { id: 1, nombre: "Bujía Bosch" },
        solicitante: { id: 2, username: "empleado" },
      });

      const res = await aprobarSolicitudPrecio(10);

      expect(res).toEqual({ error: "La solicitud ya se encuentra aprobada." });
    });

    it("actualiza precios en Producto, crea AjustePrecio y marca APROBADA", async () => {
      mocks.getSession.mockResolvedValue({ userId: 1, username: "admin", role: "ADMINISTRADOR" });
      mocks.tx.solicitudPrecio.findUnique.mockResolvedValue({
        id: 10,
        productoId: 1,
        solicitanteId: 2,
        precioCompraActual: 1000,
        precioCompraNuevo: 1200,
        precioVentaActual: 1500,
        precioVentaNuevo: 1800,
        motivo: "Lista nueva",
        estado: "PENDIENTE",
        producto: {
          id: 1,
          nombre: "Bujía Bosch",
          codigo: "BOSCH-123",
          precioCompra: 1000,
          precioVenta: 1500,
          cantidad: 10,
        },
        solicitante: { id: 2, nombreCompleto: "Empleado", username: "empleado" },
      });
      mocks.tx.producto.update.mockResolvedValue({
        id: 1,
        nombre: "Bujía Bosch",
        precioCompra: 1200,
        precioVenta: 1800,
        cantidad: 10,
      });
      mocks.tx.ajustePrecio.create.mockResolvedValue({ id: 5 });
      mocks.tx.solicitudPrecio.update.mockResolvedValue({ id: 10, estado: "APROBADA" });
      mocks.tx.preferenciaNotificacion.findUnique.mockResolvedValue({ habilitada: true });

      const res = await aprobarSolicitudPrecio(10);

      expect(res.success).toBe(true);
      expect(mocks.tx.producto.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          precioCompra: 1200,
          precioVenta: 1800,
        },
      });
      expect(mocks.tx.ajustePrecio.create).toHaveBeenCalled();
      expect(mocks.tx.solicitudPrecio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({
            estado: "APROBADA",
            aprobadorId: 1,
            ajustePrecioId: 5,
          }),
        })
      );
      expect(mocks.tx.notificacion.create).toHaveBeenCalled();
    });
  });

  describe("rechazarSolicitudPrecio", () => {
    it("requiere motivo de rechazo", async () => {
      mocks.getSession.mockResolvedValue({ userId: 1, role: "ADMINISTRADOR" });

      const res = await rechazarSolicitudPrecio(10, "   ");

      expect(res).toEqual({ error: "El motivo de rechazo es obligatorio." });
    });

    it("marca solicitud como RECHAZADA sin modificar precios", async () => {
      mocks.getSession.mockResolvedValue({ userId: 1, username: "admin", role: "ADMINISTRADOR" });
      mocks.solicitudPrecio.findUnique.mockResolvedValue({
        id: 10,
        solicitanteId: 2,
        estado: "PENDIENTE",
        producto: { id: 1, nombre: "Bujía Bosch" },
      });
      mocks.preferenciaNotificacion.findUnique.mockResolvedValue({ habilitada: true });

      const res = await rechazarSolicitudPrecio(10, "Precio de venta excesivo");

      expect(res.success).toBe(true);
      expect(mocks.solicitudPrecio.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          estado: "RECHAZADA",
          aprobadorId: 1,
          observacionResolucion: "Precio de venta excesivo",
          fechaResolucion: expect.any(Date),
        },
      });
      expect(mocks.notificacion.create).toHaveBeenCalled();
    });
  });

  describe("cancelarSolicitudPrecio", () => {
    it("retorna error si el usuario no es el creador", async () => {
      mocks.getSession.mockResolvedValue({ userId: 3, role: "ENCARGADO_STOCK" });
      mocks.solicitudPrecio.findUnique.mockResolvedValue({
        id: 10,
        solicitanteId: 2,
        estado: "PENDIENTE",
      });

      const res = await cancelarSolicitudPrecio(10);

      expect(res).toEqual({ error: "No tienes permiso para cancelar esta solicitud." });
    });

    it("marca solicitud como CANCELADA si es el creador", async () => {
      mocks.getSession.mockResolvedValue({ userId: 2, role: "ENCARGADO_STOCK" });
      mocks.solicitudPrecio.findUnique.mockResolvedValue({
        id: 10,
        solicitanteId: 2,
        estado: "PENDIENTE",
      });

      const res = await cancelarSolicitudPrecio(10);

      expect(res.success).toBe(true);
      expect(mocks.solicitudPrecio.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          estado: "CANCELADA",
          fechaResolucion: expect.any(Date),
        },
      });
    });
  });
});
