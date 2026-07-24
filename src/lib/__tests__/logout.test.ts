import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    delete: (...args: unknown[]) => mockDelete(...args),
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

  it("deletes cookie and returns { ok: true } when session exists", async () => {
    mockGetSession.mockResolvedValue({ userId: 1, username: "admin", role: "ADMINISTRADOR" });

    const res = await POST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith("session");
  });

  it("returns { ok: true } without deleting when no session", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes cookie even when session throws (invalid/expired token)", async () => {
    mockGetSession.mockRejectedValue(new Error("Invalid token"));

    const res = await POST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith("session");
  });
});
