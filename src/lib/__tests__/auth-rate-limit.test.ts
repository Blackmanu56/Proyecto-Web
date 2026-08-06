import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the action
const mockFindUnique = vi.fn();
const mockCompare = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
  },
}));

vi.mock("@/lib/jwt", () => ({
  createJWT: vi.fn(() => "mock-jwt-token"),
}));

vi.mock("@/lib/permissions", () => ({
  parseRoleData: vi.fn(() => ({ permisos: [], activo: true })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
  })),
}));

import { loginAction } from "../../actions/auth";

function makeFormData(username: string, password: string) {
  const fd = new FormData();
  fd.set("username", username);
  fd.set("password", password);
  return fd;
}

function mockSuccessfulUser(username: string) {
  mockFindUnique.mockResolvedValue({
    id: 1,
    username,
    passwordHash: "$2a$10$abcdefghijklmnopqrstuuXXXXXXXXXXXXXXXXXXXXXXXXXX",
    activo: true,
    rol: { nombre: "ADMINISTRADOR", permisos: "[]" },
    empleado: { activo: true },
    fotoUrl: null,
  });
}

describe("rate limiter — login attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccessfulUser("testuser");
    mockCompare.mockResolvedValue(false); // always wrong password
  });

  it("allows first attempt (no rate limit)", async () => {
    const result = await loginAction({}, makeFormData("testuser", "wrongpassword1"));
    expect(result.error).toBe("Usuario o contraseña incorrectos");
  });

  it("blocks after 11 failed attempts within 1 minute", async () => {
    for (let i = 0; i < 10; i++) {
      await loginAction({}, makeFormData("testuser", "wrongpassword1"));
    }
    // 11th attempt should be blocked
    const result = await loginAction({}, makeFormData("testuser", "wrongpassword1"));
    expect(result.error).toBe("Demasiados intentos fallidos. Espere un minuto.");
  });

  it("different usernames have independent counters", async () => {
    // Saturate user A
    for (let i = 0; i < 10; i++) {
      await loginAction({}, makeFormData("testuser", "wrongpassword1"));
    }
    // User B should NOT be rate-limited
    mockSuccessfulUser("other");
    const result = await loginAction({}, makeFormData("other", "wrongpassword1"));
    expect(result.error).toBe("Usuario o contraseña incorrectos");
    expect(result.error).not.toBe("Demasiados intentos fallidos. Espere un minuto.");
  });

  it("rate limit message is distinct from wrong-password message", async () => {
    for (let i = 0; i < 11; i++) {
      await loginAction({}, makeFormData("testuser", "wrongpassword1"));
    }
    const result = await loginAction({}, makeFormData("testuser", "wrongpassword1"));
    expect(result.error).toContain("Demasiados intentos");
  });
});
