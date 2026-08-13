import { describe, expect, it, vi } from "vitest";
import { crearPayloadCierre, enviarCierreCaja } from "../caja-closing";

describe("Caja close payload flow", () => {
  it("builds the modal payload with counted cash and observation", () => {
    expect(crearPayloadCierre(118_000, "Faltante verificado")).toEqual({
      totalContado: 118_000,
      observacion: "Faltante verificado",
    });
  });

  it("forwards the same payload from the parent adapter to the server action", async () => {
    const action = vi.fn().mockResolvedValue({ success: true });
    const payload = crearPayloadCierre(118_000, "Faltante verificado");

    await enviarCierreCaja(action, 4, payload);

    expect(action).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledWith(4, 118_000, "Faltante verificado");
  });
});
