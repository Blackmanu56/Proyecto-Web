import { describe, it, expect } from "vitest";
import { requirePermission, hasPermission } from "../auth-permissions";
import type { TokenPayload } from "../jwt";

// ─── Helpers ──────────────────────────────────────────────────

function adminSession(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 1,
    username: "admin",
    role: "ADMINISTRADOR",
    permissions: ["usuarios.ver", "usuarios.crear", "usuarios.editar"],
    ...overrides,
  };
}

function ventasSession(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 2,
    username: "ventas",
    role: "ENCARGADO_VENTAS",
    permissions: ["ventas.ver", "ventas.crear"],
    ...overrides,
  };
}

function stockSession(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 3,
    username: "stock",
    role: "ENCARGADO_STOCK",
    permissions: ["productos.ver", "productos.crear"],
    ...overrides,
  };
}

// ─── requirePermission ────────────────────────────────────────

describe("requirePermission", () => {
  // ── Null session ──

  it("throws when session is null", async () => {
    await expect(requirePermission("usuarios.ver", null)).rejects.toThrow(
      "No autenticado."
    );
  });

  it("throws when session is undefined", async () => {
    await expect(requirePermission("usuarios.ver", undefined)).rejects.toThrow(
      "No autenticado."
    );
  });

  // ── ADMINISTRADOR bypass ──

  it("ADMINISTRADOR bypass: all permissions pass", async () => {
    const session = adminSession();
    await expect(requirePermission("usuarios.ver", session)).resolves.toEqual(session);
    await expect(requirePermission("usuarios.crear", session)).resolves.toEqual(session);
    await expect(requirePermission("usuarios.editar", session)).resolves.toEqual(session);
    await expect(requirePermission("ventas.ver", session)).resolves.toEqual(session);
    await expect(requirePermission("productos.crear", session)).resolves.toEqual(session);
  });

  // ── Permission present ──

  it("returns session when permission is present", async () => {
    const session = ventasSession();
    const result = await requirePermission("ventas.ver", session);
    expect(result).toEqual(session);
  });

  it("returns session when permission is present (stock)", async () => {
    const session = stockSession();
    const result = await requirePermission("productos.ver", session);
    expect(result).toEqual(session);
  });

  // ── Permission denied ──

  it("throws when session has no permissions field", async () => {
    const session = { userId: 1, username: "test", role: "ENCARGADO_VENTAS" } as any;
    await expect(requirePermission("usuarios.ver", session)).rejects.toThrow(
      "No tiene permisos para realizar esta acción."
    );
  });

  it("throws when permissions array is empty", async () => {
    const session = ventasSession({ permissions: [] });
    await expect(requirePermission("usuarios.ver", session)).rejects.toThrow(
      "No tiene permisos para realizar esta acción."
    );
  });

  it("throws when permission is not in the list", async () => {
    const session = ventasSession();
    await expect(requirePermission("usuarios.ver", session)).rejects.toThrow(
      "No tiene permisos para realizar esta acción."
    );
  });

  it("ENCARGADO_VENTAS cannot access stock permissions", async () => {
    const session = ventasSession();
    await expect(requirePermission("productos.crear", session)).rejects.toThrow(
      "No tiene permisos para realizar esta acción."
    );
  });

  it("ENCARGADO_STOCK cannot access ventas permissions", async () => {
    const session = stockSession();
    await expect(requirePermission("ventas.crear", session)).rejects.toThrow(
      "No tiene permisos para realizar esta acción."
    );
  });

  it("ENCARGADO_STOCK cannot access usuario permissions", async () => {
    const session = stockSession();
    await expect(requirePermission("usuarios.ver", session)).rejects.toThrow(
      "No tiene permisos para realizar esta acción."
    );
  });
});

// ─── hasPermission ────────────────────────────────────────────

describe("hasPermission", () => {
  it("returns false for null session", async () => {
    expect(await hasPermission("usuarios.ver", null)).toBe(false);
  });

  it("returns false for undefined session", async () => {
    expect(await hasPermission("usuarios.ver", undefined)).toBe(false);
  });

  it("ADMINISTRADOR always returns true", async () => {
    const session = adminSession();
    expect(await hasPermission("anything", session)).toBe(true);
    expect(await hasPermission("usuarios.crear", session)).toBe(true);
    expect(await hasPermission("productos.editar", session)).toBe(true);
  });

  it("returns true when permission exists", async () => {
    const session = ventasSession();
    expect(await hasPermission("ventas.ver", session)).toBe(true);
    expect(await hasPermission("ventas.crear", session)).toBe(true);
  });

  it("returns false when permission missing", async () => {
    const session = ventasSession();
    expect(await hasPermission("usuarios.ver", session)).toBe(false);
    expect(await hasPermission("productos.crear", session)).toBe(false);
  });

  it("returns false when permissions is null", async () => {
    const session = ventasSession({ permissions: null as any });
    expect(await hasPermission("ventas.ver", session)).toBe(false);
  });
});

// ─── Role-based access matrix ─────────────────────────────────

describe("Role-based access matrix", () => {
  const accessMatrix: Array<{
    role: string;
    session: () => TokenPayload;
    can: string[];
    cannot: string[];
  }> = [
    {
      role: "ADMINISTRADOR",
      session: () => adminSession(),
      can: ["usuarios.ver", "usuarios.crear", "ventas.ver", "productos.crear", "caja.abrir"],
      cannot: [],
    },
    {
      role: "ENCARGADO_VENTAS",
      session: () => ventasSession(),
      can: ["ventas.ver", "ventas.crear"],
      cannot: ["usuarios.ver", "usuarios.crear", "productos.crear", "caja.abrir"],
    },
    {
      role: "ENCARGADO_STOCK",
      session: () => stockSession(),
      can: ["productos.ver", "productos.crear"],
      cannot: ["usuarios.ver", "ventas.crear", "caja.abrir"],
    },
  ];

  for (const { role, session, can, cannot } of accessMatrix) {
    describe(role, () => {
      for (const perm of can) {
        it(`CAN access ${perm}`, async () => {
          await expect(requirePermission(perm, session())).resolves.toBeDefined();
        });
      }
      for (const perm of cannot) {
        it(`CANNOT access ${perm}`, async () => {
          await expect(requirePermission(perm, session())).rejects.toThrow(
            "No tiene permisos"
          );
        });
      }
    });
  }
});
