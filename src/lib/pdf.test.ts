import assert from "node:assert/strict";
import test from "node:test";
import { createQuotePdf } from "./pdf.ts";
import type { BusinessSettings, Quote } from "./quote.ts";

test("genera un PDF válido con la identidad de La Ruka", async () => {
  const business: BusinessSettings = { name: "La Ruka", legalName: "", rut: "77.123.456-7", address: "Mariquina", phone: "+56 9 1111 1111", email: "contacto@laruka.cl", defaultRecipient: "ventas@laruka.cl" };
  const quote: Quote = { id: "q", number: "COT-2026-0001", date: "2026-08-14", status: "Pendiente", notes: "Vigencia de 10 días", customer: { id: "c", name: "Cliente de prueba", rut: "12.345.678-9" }, items: [{ productId: "p", name: "Coffee break clásico", unit: "persona", quantity: 10, unitPrice: 5_000, unitCost: 2_000 }] };
  const pdf = await createQuotePdf(quote, business);
  const bytes = pdf.output("arraybuffer");
  assert.ok(bytes.byteLength > 2_000);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
});
