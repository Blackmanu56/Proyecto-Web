import { readFileSync } from "fs";
import { SignJWT } from "jose";
import { resolve } from "path";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";

// ─── getJWTSecret ─────────────────────────────────────────────

describe("getJWTSecret", () => {
  const originalEnv = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalEnv;
    }
  });

  it("returns the env var when JWT_SECRET is set", async () => {
    process.env.JWT_SECRET = "test-secret-key-123456789012345678";
    const { getJWTSecret } = await import("../jwt");
    expect(getJWTSecret()).toBe("test-secret-key-123456789012345678");
  });

  it("throws when JWT_SECRET is undefined", async () => {
    delete process.env.JWT_SECRET;
    vi.resetModules();
    const { getJWTSecret } = await import("../jwt");
    expect(() => getJWTSecret()).toThrow("JWT_SECRET environment variable is required");
  });

  it("throws when JWT_SECRET is empty string", async () => {
    process.env.JWT_SECRET = "";
    vi.resetModules();
    const { getJWTSecret } = await import("../jwt");
    expect(() => getJWTSecret()).toThrow("JWT_SECRET environment variable is required");
  });
});

// ─── createJWT + verifyJWT ────────────────────────────────────

describe("createJWT and verifyJWT", () => {
  const TEST_SECRET = "test-secret-key-for-jwt-tests-2026-xx";

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("creates and verifies a valid token", async () => {
    vi.resetModules();
    const { createJWT, verifyJWT } = await import("../jwt");
    const payload = {
      userId: 1,
      username: "admin",
      role: "ADMINISTRADOR",
      permissions: ["usuarios.ver"],
      fotoUrl: null,
    };
    const token = await createJWT(payload);
    const decoded = await verifyJWT(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(1);
    expect(decoded!.username).toBe("admin");
    expect(decoded!.role).toBe("ADMINISTRADOR");
  });

  it("verifyJWT returns null for an expired token", async () => {
    vi.resetModules();
    const key = new TextEncoder().encode(TEST_SECRET);
    const token = await new SignJWT({ userId: 1, username: "u", role: "r", permissions: [] })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime("1s")
      .sign(key);

    // Wait for expiry
    await new Promise((r) => setTimeout(r, 1100));

    const { verifyJWT } = await import("../jwt");
    const decoded = await verifyJWT(token);
    expect(decoded).toBeNull();
  });

  it("verifyJWT returns null for a tampered token", async () => {
    vi.resetModules();
    const { createJWT, verifyJWT } = await import("../jwt");
    const token = await createJWT({
      userId: 1,
      username: "admin",
      role: "ADMINISTRADOR",
      permissions: [],
      fotoUrl: null,
    });
    const tampered = token.slice(0, -5) + "XXXXX";
    const decoded = await verifyJWT(tampered);
    expect(decoded).toBeNull();
  });

  it("verifyJWT returns null when signed with a different secret", async () => {
    vi.resetModules();
    // Create token with a different secret
    const otherKey = new TextEncoder().encode("completely-different-secret-key-1234");
    const token = await new SignJWT({ userId: 1, username: "admin", role: "ADMINISTRADOR", permissions: [] })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(otherKey);

    const { verifyJWT } = await import("../jwt");
    const decoded = await verifyJWT(token);
    expect(decoded).toBeNull();
  });

  it("token includes iat and exp claims", async () => {
    vi.resetModules();
    const { createJWT } = await import("../jwt");
    const token = await createJWT({
      userId: 1,
      username: "admin",
      role: "ADMINISTRADOR",
      permissions: [],
      fotoUrl: null,
    });
    // Decode payload manually (base64url)
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});

// ─── Token payload NOW contains permissions ────────────────────

describe("JWT token payload", () => {
  const TEST_SECRET = "test-secret-key-for-jwt-tests-2026-xx";

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("createJWT includes userId, username, role, permissions, fotoUrl in payload", async () => {
    vi.resetModules();
    const { createJWT } = await import("../jwt");
    const token = await createJWT({
      userId: 1,
      username: "admin",
      role: "ADMINISTRADOR",
      permissions: ["usuarios.ver", "ventas.crear"],
      fotoUrl: "https://example.com/photo.jpg",
    });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    expect(payload.userId).toBe(1);
    expect(payload.username).toBe("admin");
    expect(payload.role).toBe("ADMINISTRADOR");
    expect(payload.fotoUrl).toBe("https://example.com/photo.jpg");
    expect(payload.permissions).toEqual(["usuarios.ver", "ventas.crear"]);
  });
});

// ─── Middleware uses shared secret ─────────────────────────────

describe("Middleware secret management", () => {
  it("middleware.ts imports getJWTSecret from @/lib/jwt", () => {
    const middlewarePath = resolve(__dirname, "../../middleware.ts");
    const content = readFileSync(middlewarePath, "utf-8");
    expect(content).toMatch(/import\s*{[^}]*getJWTSecret[^}]*}\s*from\s*["']@\/lib\/jwt["']/);
  });

  it("middleware.ts has no local JWT_SECRET constant", () => {
    const middlewarePath = resolve(__dirname, "../../middleware.ts");
    const content = readFileSync(middlewarePath, "utf-8");
    const lines = content.split("\n");
    const localConstLines = lines.filter(
      (line) =>
        /const\s+JWT_SECRET\s*=/.test(line) ||
        /let\s+JWT_SECRET\s*=/.test(line)
    );
    expect(localConstLines).toHaveLength(0);
  });

  it("middleware.ts has no hardcoded secret fallback", () => {
    const middlewarePath = resolve(__dirname, "../../middleware.ts");
    const content = readFileSync(middlewarePath, "utf-8");
    expect(content).not.toMatch(/mi_secreto/);
  });
});
