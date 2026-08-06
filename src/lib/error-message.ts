export function getErrorMessage(error: unknown, fallback = "Error inesperado"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
