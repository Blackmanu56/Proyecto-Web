import { describe, expect, it } from "vitest";
import {
  getDisplayDescription,
  parseProductMetadata,
  serializeProductMetadata,
} from "../productMetadata";

describe("productMetadata en SGI", () => {
  it("retorna objeto vacío para descripciones vacías o nulas", () => {
    expect(parseProductMetadata(null)).toEqual({
      tituloComercial: null,
      texto: "",
      especificaciones: [],
      motosCompatibles: [],
    });

    expect(getDisplayDescription(null)).toBe("");
    expect(getDisplayDescription("")).toBe("");
  });

  it("parsea correctamente texto plano heredado", () => {
    const raw = "Kit de transmisión reforzado para uso urbano.";
    const meta = parseProductMetadata(raw);
    expect(meta.texto).toBe(raw);
    expect(meta.universal).toBe(false);
    expect(meta.motosCompatibles).toEqual([]);
    expect(getDisplayDescription(raw)).toBe(raw);
  });

  it("parsea JSON estructurado del e-commerce y nunca muestra llaves crudas", () => {
    const jsonStr = JSON.stringify({
      texto: "Kit completo de mantenimiento para motor 150cc.",
      universal: false,
      especificaciones: [
        { caracteristica: "Origen", valor: "Brasil" },
        { caracteristica: "Paso", valor: "428H" },
      ],
      motosCompatibles: ["Honda CG Titan 150", "Yamaha YBR 125"],
    });

    const meta = parseProductMetadata(jsonStr);
    expect(meta.texto).toBe("Kit completo de mantenimiento para motor 150cc.");
    expect(meta.especificaciones).toHaveLength(2);
    expect(meta.motosCompatibles).toEqual(["Honda CG Titan 150", "Yamaha YBR 125"]);

    const display = getDisplayDescription(jsonStr);
    expect(display).toBe("Kit completo de mantenimiento para motor 150cc.");
    expect(display).not.toContain("{");
    expect(display).not.toContain("especificaciones");
  });

  it("genera línea de compatibilidad si el texto descriptivo está vacío pero hay motos", () => {
    const jsonStr = JSON.stringify({
      texto: "",
      universal: false,
      especificaciones: [],
      motosCompatibles: ["Honda Titan 150", "Honda XR 150L", "Motomel S2"],
    });

    const meta = parseProductMetadata(jsonStr);
    expect(meta.texto).toBe("");
    expect(meta.motosCompatibles).toHaveLength(3);

    const display = getDisplayDescription(jsonStr);
    expect(display).toBe("Compatibilidad: Honda Titan 150, Honda XR 150L, Motomel S2");
    expect(display).not.toContain("{");
  });

  it("indica universal si está marcado como universal sin texto", () => {
    const jsonStr = JSON.stringify({
      texto: "",
      universal: true,
      especificaciones: [],
      motosCompatibles: [],
    });

    const display = getDisplayDescription(jsonStr);
    expect(display).toBe("Compatible con múltiples modelos (Universal)");
  });

  it("serializa y deserializa de manera bidireccional consistente", () => {
    const input = {
      tituloComercial: "Combo Service Básico",
      texto: "Aceite y filtro original",
      universal: false,
      especificaciones: [{ caracteristica: "Viscosidad", valor: "20W50" }],
      motosCompatibles: ["Honda CG 150"],
    };

    const serialized = serializeProductMetadata(input);
    expect(serialized).not.toBeNull();
    const parsed = parseProductMetadata(serialized);
    expect(parsed.tituloComercial).toBe(input.tituloComercial);
    expect(parsed.texto).toBe(input.texto);
    expect(parsed.especificaciones).toEqual(input.especificaciones);
    expect(parsed.motosCompatibles).toEqual(input.motosCompatibles);
  });
});
