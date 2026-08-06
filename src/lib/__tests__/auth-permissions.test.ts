import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TokenPayload } from "../jwt";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    usuario: {
      findUnique: mocks.findUnique,
    },
  },
}));

const findUniqueMock = mocks.findUnique;

import { requirePermission, hasPermission } from "../auth-permissions";

function rolePermisos(permisos: string[], activo = true): string {
  return JSON.stringify({ activo, descripcion: "", permisos });
}

type MockDbUser = {
  id: number;
  username: string;
  activo: boolean;
  fotoUrl: string | null;
  rol: { nombre: string; permisos: string };
};

function dbUserFromSession(session: TokenPayload, overrides: Partial<MockDbUser> = {}): MockDbUser {
  return {
    id: session.userId,
    username: session.username,
    activo: true,
    fotoUrl: session.fotoUrl ?? null,
    rol: {
      nombre: session.role,
      permisos: rolePermisos(session.permissions ?? []),
    },
    ...overrides,
  };
}

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

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("requirePermission", () => {
  it("throws when session is null", async () => {
    await expect(requirePermission("usuarios.ver", null)).rejects.toThrow("No autenticado.");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("throws when session is undefined", async () => {
    await expect(requirePermission("usuarios.ver", undefined)).rejects.toThrow("No autenticado.");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("ADMINISTRADOR bypass uses fresh database role", async () => {
    const session = adminSession({ permissions: [] });
    findUniqueMock.mockResolvedValueOnce(dbUserFromSession(session));

    const result = await requirePermission("productos.crear", session);

    expect(result.role).toBe("ADMINISTRADOR");
    expect(findUniqueMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
  });

  it("returns fresh session when permission is present in the database role", async () => {
    const staleSession = ventasSession({ permissions: [] });
    findUniqueMock.mockResolvedValueOnce(dbUserFromSession(ventasSession()));

    const result = await requirePermission("ventas.crear", staleSession);

    expect(result.permissions).toEqual(["ventas.ver", "ventas.crear"]);
  });

  it("rejects when database role no longer has the permission", async () => {
    const staleSession = ventasSession({ permissions: ["usuarios.ver"] });
    findUniqueMock.mockResolvedValueOnce(dbUserFromSession(staleSession, {
      rol: { nombre: "ENCARGADO_VENTAS", permisos: rolePermisos(["ventas.ver"]) },
    }));

    await expect(requirePermission("ventas.crear", staleSession)).rejects.toThrow(
      "No tiene permisos para realizar esta acci?n."
    );
  });

  it("rejects inactive users even with a valid JWT", async () => {
    const session = ventasSession();
    findUniqueMock.mockResolvedValueOnce(dbUserFromSession(session, { activo: false }));

    await expect(requirePermission("ventas.crear", session)).rejects.toThrow(
      "Usuario inactivo o no encontrado."
    );
  });

  it("rejects missing users even with a valid JWT", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(requirePermission("ventas.crear", ventasSession())).rejects.toThrow(
      "Usuario inactivo o no encontrado."
    );
  });

  it("rejects inactive roles", async () => {
    const session = ventasSession();
    findUniqueMock.mockResolvedValueOnce(dbUserFromSession(session, {
      rol: { nombre: "ENCARGADO_VENTAS", permisos: rolePermisos(["ventas.crear"], false) },
    }));

    await expect(requirePermission("ventas.crear", session)).rejects.toThrow(
      "Rol inactivo o sin permisos vigentes."
    );
  });
});

describe("hasPermission", () => {
  it("returns false for null or undefined session", async () => {
    expect(await hasPermission("usuarios.ver", null)).toBe(false);
    expect(await hasPermission("usuarios.ver", undefined)).toBe(false);
  });

  it("keeps render checks lightweight and uses the provided session", async () => {
    expect(await hasPermission("ventas.crear", ventasSession())).toBe(true);
    expect(await hasPermission("usuarios.ver", ventasSession())).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("ADMINISTRADOR returns true for UI checks", async () => {
    expect(await hasPermission("anything", adminSession())).toBe(true);
  });
});

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
          const s = session();
          findUniqueMock.mockResolvedValueOnce(dbUserFromSession(s));
          await expect(requirePermission(perm, s)).resolves.toBeDefined();
        });
      }
      for (const perm of cannot) {
        it(`CANNOT access ${perm}`, async () => {
          const s = session();
          findUniqueMock.mockResolvedValueOnce(dbUserFromSession(s));
          await expect(requirePermission(perm, s)).rejects.toThrow("No tiene permisos");
        });
      }
    });
  }
});
