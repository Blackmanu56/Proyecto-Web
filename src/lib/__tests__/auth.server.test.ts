import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFindUnique = vi.fn();

vi.mock("../prisma", () => ({
  prisma: {
    usuario: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { getUserActivo, clearUserStatusCache } from "../auth.server";

describe("getUserActivo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(mockFindUnique).mockReset();
    clearUserStatusCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when user exists and is active", async () => {
    mockFindUnique.mockResolvedValue({ activo: true });

    const result = await getUserActivo(1);

    expect(result).toBe(true);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { activo: true },
    });
  });

  it("returns false when user is deactivated", async () => {
    mockFindUnique.mockResolvedValue({ activo: false });

    const result = await getUserActivo(2);

    expect(result).toBe(false);
  });

  it("returns false when user not found in DB", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getUserActivo(999);

    expect(result).toBe(false);
  });

  it("caches result and does not hit DB again within 60s TTL", async () => {
    mockFindUnique.mockResolvedValue({ activo: true });

    await getUserActivo(1);
    await getUserActivo(1);
    await getUserActivo(1);

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });

  it("expires cache after 60s TTL and hits DB again", async () => {
    mockFindUnique.mockResolvedValue({ activo: true });

    await getUserActivo(1);

    vi.advanceTimersByTime(61_000);

    await getUserActivo(1);

    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });
});
