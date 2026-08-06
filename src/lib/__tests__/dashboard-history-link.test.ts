import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "../permissions";

const currentDir = dirname(fileURLToPath(import.meta.url));
const dashboardPagePath = resolve(currentDir, "../../app/dashboard/page.tsx");
const dashboardClientPath = resolve(currentDir, "../../components/layout/DashboardClient.tsx");

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("Dashboard recent activity history link permissions", () => {
  it("uses caja.ver as the permission that controls the cash history link", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.ENCARGADO_STOCK).not.toContain("caja.ver");
    expect(DEFAULT_ROLE_PERMISSIONS.ENCARGADO_VENTAS).toContain("caja.ver");
    expect(DEFAULT_ROLE_PERMISSIONS.ADMINISTRADOR).toContain("caja.ver");
  });

  it("derives the Dashboard client visibility flag from the server-side session permission", () => {
    const source = readSource(dashboardPagePath);

    expect(source).toContain('import { hasPermission } from "@/lib/auth-permissions";');
    expect(source).toContain('const canAccessCaja = await hasPermission("caja.ver", session);');
    expect(source).toContain("canAccessCaja={canAccessCaja}");
  });

  it("renders the Ver historial link only when the user can access Caja", () => {
    const source = readSource(dashboardClientPath);
    const recentActivityHeader = source.match(/<h3 className="text-sm font-bold text-\[var\(--text\)\]">Actividad Reciente<\/h3>[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";

    expect(source).toContain("canAccessCaja: boolean;");
    expect(recentActivityHeader).toContain("{canAccessCaja && (");
    expect(recentActivityHeader).toContain('<Link href="/caja"');
    expect(recentActivityHeader).toContain("Ver historial");
  });
});
