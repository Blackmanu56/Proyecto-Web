export interface ProductSpec {
  caracteristica: string;
  valor: string;
}

export interface ProductCommercialMetadata {
  tituloComercial?: string | null;
  texto: string;
  universal?: boolean;
  especificaciones: ProductSpec[];
  motosCompatibles: string[];
}

/**
 * Genera la descripción descriptiva por defecto para productos que aún no tengan una personalizada guardada.
 */
export function getDefaultProductDescription(nombre: string, marca?: string | null): string {
  const m = marca && marca.trim() && marca.trim() !== "Genérico" ? marca.trim() : "Chopper";
  return `El ${nombre} de marca ${m} es un componente para motocicleta fabricado bajo normas de precisión. Diseñado para responder a las exigencias del tránsito urbano y traslados continuos en la región de Posadas y Misiones, asegura durabilidad, óptimo rendimiento mecánico y confiabilidad en tu andar diario.`;
}

/**
 * Parsea el campo descripcion almacenado en ProductoEcommerce o ComboEcommerce.
 * Es compatible tanto con JSON estructurado como con texto plano heredado.
 */
export function parseProductMetadata(rawDescripcion?: string | null): ProductCommercialMetadata {
  if (!rawDescripcion || !rawDescripcion.trim()) {
    return {
      tituloComercial: null,
      texto: "",
      especificaciones: [],
      motosCompatibles: [],
    };
  }

  const trimmed = rawDescripcion.trim();

  // Intentar parsear como JSON si tiene formato de objeto
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        ("texto" in parsed ||
          "descripcion" in parsed ||
          "especificaciones" in parsed ||
          "motosCompatibles" in parsed ||
          "tituloComercial" in parsed ||
          "titulo" in parsed)
      ) {
        const tituloComercial =
          typeof parsed.tituloComercial === "string" && parsed.tituloComercial.trim().length > 0
            ? parsed.tituloComercial.trim()
            : typeof parsed.titulo === "string" && parsed.titulo.trim().length > 0
            ? parsed.titulo.trim()
            : null;

        const texto =
          typeof parsed.texto === "string"
            ? parsed.texto
            : typeof parsed.descripcion === "string"
            ? parsed.descripcion
            : "";

        const universal = Boolean(
          parsed.universal ||
          parsed.esUniversal ||
          (Array.isArray(parsed.motosCompatibles) &&
            parsed.motosCompatibles.some((m: any) => typeof m === "string" && m.trim().toUpperCase() === "UNIVERSAL"))
        );

        const especificaciones: ProductSpec[] = Array.isArray(parsed.especificaciones)
          ? parsed.especificaciones
              .filter(
                (s: any) =>
                  s &&
                  typeof s.caracteristica === "string" &&
                  typeof s.valor === "string" &&
                  s.caracteristica.trim().length > 0 &&
                  s.valor.trim().length > 0
              )
              .map((s: any) => ({
                caracteristica: s.caracteristica.trim(),
                valor: s.valor.trim(),
              }))
          : [];

        const motosCompatibles: string[] = Array.isArray(parsed.motosCompatibles)
          ? parsed.motosCompatibles
              .filter((m: any) => typeof m === "string" && m.trim().length > 0 && m.trim().toUpperCase() !== "UNIVERSAL")
              .map((m: string) => m.trim())
          : [];

        // Deduplicar motos conservando orden
        const uniqueMotos = Array.from(new Set(motosCompatibles));

        return {
          tituloComercial,
          texto,
          universal,
          especificaciones,
          motosCompatibles: uniqueMotos,
        };
      }
    } catch {
      // Si falla el parsing JSON, se procesa como texto plano
    }
  }

  // Texto plano heredado
  return {
    tituloComercial: null,
    texto: trimmed,
    universal: false,
    especificaciones: [],
    motosCompatibles: [],
  };
}

/**
 * Obtiene una descripción legible para interfaces de usuario, evitando mostrar JSON crudo.
 * Si el texto está vacío pero hay motos compatibles, genera una línea de compatibilidad concisa.
 */
export function getDisplayDescription(rawDescripcion?: string | null): string {
  const meta = parseProductMetadata(rawDescripcion);
  if (meta.texto && meta.texto.trim()) {
    return meta.texto.trim();
  }
  if (meta.motosCompatibles && meta.motosCompatibles.length > 0) {
    const list = meta.motosCompatibles.slice(0, 3).join(", ");
    const more = meta.motosCompatibles.length > 3 ? "..." : "";
    return `Compatibilidad: ${list}${more}`;
  }
  if (meta.universal) {
    return "Compatible con múltiples modelos (Universal)";
  }
  return "";
}

/**
 * Serializa los metadatos comerciales del producto para almacenarlos en ProductoEcommerce o ComboEcommerce.
 */
export function serializeProductMetadata(metadata: {
  tituloComercial?: string | null;
  texto?: string;
  universal?: boolean;
  especificaciones?: ProductSpec[];
  motosCompatibles?: string[];
}): string | null {
  const tituloComercial = (metadata.tituloComercial || "").trim() || null;
  const texto = (metadata.texto || "").trim();
  const universal = Boolean(metadata.universal);
  const especificaciones = (metadata.especificaciones || [])
    .filter((s) => s && s.caracteristica?.trim() && s.valor?.trim())
    .map((s) => ({ caracteristica: s.caracteristica.trim(), valor: s.valor.trim() }));

  const rawMotos = (metadata.motosCompatibles || [])
    .filter((m) => typeof m === "string" && m.trim().length > 0 && m.trim().toUpperCase() !== "UNIVERSAL")
    .map((m) => m.trim());
  const motosCompatibles = Array.from(new Set(rawMotos));

  if (!tituloComercial && !texto && !universal && especificaciones.length === 0 && motosCompatibles.length === 0) {
    return null;
  }

  if (!tituloComercial && !universal && especificaciones.length === 0 && motosCompatibles.length === 0) {
    return texto;
  }

  return JSON.stringify({
    ...(tituloComercial ? { tituloComercial } : {}),
    texto,
    ...(universal ? { universal: true } : {}),
    especificaciones,
    motosCompatibles,
  });
}
