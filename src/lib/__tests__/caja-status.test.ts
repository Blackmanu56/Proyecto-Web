import { describe, expect, it } from "vitest";
import {
  MAX_HORAS_CAJA_ABIERTA,
  validarCajaHabilitadaParaVenta,
} from "../caja-status";

describe("validarCajaHabilitadaParaVenta", () => {
  const baseNow = new Date("2026-09-24T16:00:00.000Z");

  it("rechaza si no existe ninguna caja (null o undefined)", () => {
    const resNull = validarCajaHabilitadaParaVenta(null, baseNow);
    expect(resNull.habilitada).toBe(false);
    expect(resNull.motivo).toBe("SIN_CAJA");
    expect(resNull.mensaje).toBe(
      "No hay una caja abierta en el sistema para realizar ventas."
    );

    const resUndef = validarCajaHabilitadaParaVenta(undefined, baseNow);
    expect(resUndef.habilitada).toBe(false);
    expect(resUndef.motivo).toBe("SIN_CAJA");
  });

  it("rechaza si la caja tiene estado CERRADA", () => {
    const res = validarCajaHabilitadaParaVenta(
      {
        id: 1,
        estado: "CERRADA",
        fechaApertura: new Date("2026-09-24T10:00:00.000Z"),
      },
      baseNow
    );

    expect(res.habilitada).toBe(false);
    expect(res.motivo).toBe("CAJA_CERRADA");
    expect(res.mensaje).toBe(
      "La caja se encuentra cerrada. Debe abrir una caja para comenzar a vender."
    );
  });

  it("rechaza si la caja tiene estado PENDIENTE", () => {
    const res = validarCajaHabilitadaParaVenta(
      {
        id: 2,
        estado: "PENDIENTE",
        fechaApertura: new Date("2026-09-24T14:00:00.000Z"),
      },
      baseNow
    );

    expect(res.habilitada).toBe(false);
    expect(res.motivo).toBe("CAJA_CERRADA");
  });

  it("permite la venta si la caja está ABIERTA y fue abierta recientemente (ej. 2 horas)", () => {
    const fechaApertura = new Date(baseNow.getTime() - 2 * 60 * 60 * 1000);
    const res = validarCajaHabilitadaParaVenta(
      {
        id: 3,
        estado: "ABIERTA",
        fechaApertura,
      },
      baseNow
    );

    expect(res.habilitada).toBe(true);
    expect(res.horasAbierta).toBe(2);
  });

  it("permite la venta si la caja está ABIERTA y lleva exactamente 24 horas", () => {
    const fechaApertura = new Date(
      baseNow.getTime() - MAX_HORAS_CAJA_ABIERTA * 60 * 60 * 1000
    );
    const res = validarCajaHabilitadaParaVenta(
      {
        id: 4,
        estado: "ABIERTA",
        fechaApertura,
      },
      baseNow
    );

    expect(res.habilitada).toBe(true);
    expect(res.horasAbierta).toBe(24);
  });

  it("rechaza si la caja está ABIERTA pero superó las 24 horas (ej. 24h y 1 segundo)", () => {
    const fechaApertura = new Date(
      baseNow.getTime() - (MAX_HORAS_CAJA_ABIERTA * 60 * 60 * 1000 + 1000)
    );
    const res = validarCajaHabilitadaParaVenta(
      {
        id: 5,
        estado: "ABIERTA",
        fechaApertura,
      },
      baseNow
    );

    expect(res.habilitada).toBe(false);
    expect(res.motivo).toBe("CAJA_VENCIDA");
    expect(res.mensaje).toBe(
      "La caja actual lleva abierta más de 24 horas. Debe realizar el cierre de caja antes de registrar nuevas ventas."
    );
  });

  it("rechaza si la caja lleva abierta varios días (ej. 3 días)", () => {
    const fechaApertura = new Date(
      baseNow.getTime() - 3 * 24 * 60 * 60 * 1000
    );
    const res = validarCajaHabilitadaParaVenta(
      {
        id: 6,
        estado: "ABIERTA",
        fechaApertura,
      },
      baseNow
    );

    expect(res.habilitada).toBe(false);
    expect(res.motivo).toBe("CAJA_VENCIDA");
    expect(res.horasAbierta).toBe(72);
  });
});
