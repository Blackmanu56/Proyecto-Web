import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/jwt", () => ({
  getJWTSecret: vi.fn(() => "test-secret-key-123456789012345678"),
}));

function makeRequest(path: string, cookieValue?: string) {
  const headers = new Headers();
  if (cookieValue) {
    headers.set("Cookie", `session=${cookieValue}`);
  }
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

async function signTestToken(payload: Record<string, unknown>) {
  const { SignJWT } = await import("jose");
  const key = new TextEncoder().encode("test-secret-key-123456789012345678");
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key);
}

let middleware: (req: NextRequest) => Promise<NextResponse>;

beforeAll(async () => {
  const mod = await import("../../middleware");
  middleware = mod.middleware;
});

describe("middleware — token validation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirects unauthenticated user to /login for protected route", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("allows authenticated user with valid role", async () => {
    vi.useFakeTimers();
    const token = await signTestToken({ userId: 1, username: "admin", role: "ADMINISTRADOR" });
    const res = await middleware(makeRequest("/dashboard", token));
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("rejects user without matching role", async () => {
    vi.useFakeTimers();
    const token = await signTestToken({ userId: 1, username: "ventas", role: "ENCARGADO_VENTAS" });
    const res = await middleware(makeRequest("/productos", token));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("redirects authenticated user from /login to /dashboard", async () => {
    vi.useFakeTimers();
    const token = await signTestToken({ userId: 1, username: "admin", role: "ADMINISTRADOR" });
    const res = await middleware(makeRequest("/login", token));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("redirects / to /login when not authenticated", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects / to /dashboard when authenticated", async () => {
    vi.useFakeTimers();
    const token = await signTestToken({ userId: 1, username: "admin", role: "ADMINISTRADOR" });
    const res = await middleware(makeRequest("/", token));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("invalid token gets redirected to /login with cookie deleted", async () => {
    const res = await middleware(makeRequest("/dashboard", "invalid-token"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("middleware — token refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes token within 30min of expiry", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode("test-secret-key-123456789012345678");
    const token = await new SignJWT({
      userId: 1,
      username: "admin",
      role: "ADMINISTRADOR",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(nowSec - 23 * 60 * 60)
      .setExpirationTime(nowSec + 20 * 60)
      .sign(key);

    const res = await middleware(makeRequest("/dashboard", token));

    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("session=");

    const newTokenMatch = setCookie.match(/session=([^;]+)/);
    expect(newTokenMatch).not.toBeNull();
    const newToken = newTokenMatch![1];
    const payload = JSON.parse(
      Buffer.from(newToken.split(".")[1], "base64url").toString()
    );
    const newExp = payload.exp;
    expect(newExp).toBeGreaterThan(nowSec + 23 * 60 * 60);
  });

  it("does not refresh token far from expiry", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode("test-secret-key-123456789012345678");
    const token = await new SignJWT({
      userId: 1,
      username: "admin",
      role: "ADMINISTRADOR",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(nowSec - 12 * 60 * 60)
      .setExpirationTime(nowSec + 12 * 60 * 60)
      .sign(key);

    const res = await middleware(makeRequest("/dashboard", token));

    const setCookie = res.headers.get("set-cookie") || "";
    const hasSessionCookie = setCookie.includes("session=");
    expect(hasSessionCookie).toBe(false);
  });
});

describe("middleware — matcher config", () => {
  it("matcher does NOT exclude api routes", async () => {
    const mod = await import("../../middleware");
    const matcher = mod.config.matcher as string[];
    const pattern = matcher[0];
    expect(pattern).not.toMatch(/\(\?!.*api/);
  });

  it("matcher still excludes _next/static, _next/image, favicon.ico", async () => {
    const mod = await import("../../middleware");
    const matcher = mod.config.matcher as string[];
    const pattern = matcher[0];
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
    expect(pattern).toContain("favicon.ico");
  });
});

describe("middleware — exact path matching", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("/ventasreportes does NOT match /ventas route", async () => {
    vi.useFakeTimers();
    const token = await signTestToken({ userId: 1, username: "admin", role: "ADMINISTRADOR" });
    const res = await middleware(makeRequest("/ventasreportes", token));
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("/ventas/123 matches /ventas route", async () => {
    vi.useFakeTimers();
    const token = await signTestToken({ userId: 1, username: "admin", role: "ADMINISTRADOR" });
    const res = await middleware(makeRequest("/ventas/123", token));
    expect(res.status).not.toBe(307);
  });

  it("/cajareportes does NOT match /caja route", async () => {
    vi.useFakeTimers();
    const token = await signTestToken({ userId: 1, username: "encargado_ventas", role: "ENCARGADO_VENTAS" });
    const res = await middleware(makeRequest("/cajareportes", token));
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});
