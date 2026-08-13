import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const cajaTerminalPath = resolve(currentDir, "../../components/forms/CajaTerminal.tsx");
const cierreModalPath = resolve(currentDir, "../../components/ui/ConfirmarCierreModal.tsx");

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("Caja modal lifecycle contract", () => {
  it("closes the cash closing modal only after a successful close", () => {
    const source = readSource(cajaTerminalPath);
    const confirmarCierre = source.match(/const confirmarCierre = \([^)]*\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";

    expect(confirmarCierre).toMatch(/if \(res\.success\) \{[\s\S]*setShowCerrarModal\(false\);[\s\S]*router\.refresh\(\);[\s\S]*\}/);
    expect(confirmarCierre).toMatch(/else \{[\s\S]*setCierreErrorMsg\(res\.error \|\| "Error al cerrar la caja\."\);[\s\S]*\}/);

    const errorBranch = confirmarCierre.match(/else \{[\s\S]*setCierreErrorMsg\(res\.error \|\| "Error al cerrar la caja\."\);[\s\S]*?\}/)?.[0] ?? "";
    expect(errorBranch).not.toContain("setShowCerrarModal(false)");
  });

  it("keeps close errors visible inside the closing modal", () => {
    const terminalSource = readSource(cajaTerminalPath);
    const modalSource = readSource(cierreModalPath);

    expect(terminalSource).toContain("const [cierreErrorMsg, setCierreErrorMsg] = useState(\"\");");
    expect(terminalSource).toContain("errorMessage={cierreErrorMsg}");
    expect(modalSource).toContain("errorMessage?: string;");
    expect(modalSource).toContain("{errorMessage && (");
  });

  it("hides the closed-cash opening form after a successful open while the route refreshes", () => {
    const source = readSource(cajaTerminalPath);

    expect(source).toContain("const [aperturaCompletada, setAperturaCompletada] = useState(false);");
    expect(source).toMatch(/if \(res\.success\) \{[\s\S]*setMontoApertura\(""\);[\s\S]*setAperturaCompletada\(true\);[\s\S]*router\.refresh\(\);[\s\S]*\}/);
    expect(source).toContain("disabled={isPending || aperturaCompletada}");
    expect(source).toContain("{aperturaCompletada ? (");
  });
});
