import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
const mockCookiesDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    delete: (...args: unknown[]) => mockCookiesDelete(...args),
  })),
}));

vi.mock("@/lib/auth.server", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

// Static import so vi.mock hoisting applies
import { POST } from "../../app/api/logout/route";

describe("POST /api/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes cookie on response and returns { ok: true } when session exists", async () => {
    mockGetSession.mockResolvedValue({ userId: 1, username: "admin", role: "ADMINISTRADOR" });

    const res = await POST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    // The fix: cookie is deleted on the NextResponse object, not via cookies() API
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toContain("session");
  });

  it("returns { ok: true } without deleting cookie when no session", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    const setCookieHeader = res.headers.get("set-cookie");
    // No Set-Cookie header when session is null
    expect(setCookieHeader).toBeNull();
  });

  it("deletes cookie even when session throws (invalid/expired token)", async () => {
    mockGetSession.mockRejectedValue(new Error("Invalid token"));

    const res = await POST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toContain("session");
  });
});
