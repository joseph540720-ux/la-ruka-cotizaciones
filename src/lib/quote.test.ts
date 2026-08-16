import assert from "node:assert/strict";
import test from "node:test";
import { lineSubtotal, needsWeeklyFollowUp, normalizeQuote, quoteTotals, type Quote, type QuoteItem } from "./quote.ts";

test("calcula el ejemplo financiero acordado", () => {
  const items: QuoteItem[] = [
    { productId: "a", name: "Producto A", unit: "unidad", quantity: 100, unitPrice: 2_000, unitCost: 1_000 },
    { productId: "b", name: "Producto B", unit: "unidad", quantity: 100, unitPrice: 3_000, unitCost: 1_500 },
  ];
  const totals = quoteTotals(items);
  assert.equal(totals.net, 500_000);
  assert.equal(totals.tax, 95_000);
  assert.equal(totals.total, 595_000);
  assert.equal(totals.cost, 250_000);
  assert.equal(totals.profit, 250_000);
  assert.equal(totals.margin, 50);
});

test("redondea IVA y subtotales al peso entero", () => {
  const item: QuoteItem = { productId: "a", name: "Porción", unit: "kilo", quantity: 1.25, unitPrice: 999 };
  assert.equal(lineSubtotal(item), 1_249);
  assert.equal(quoteTotals([item]).tax, 237);
  assert.equal(quoteTotals([item]).total, 1_486);
});

test("no inventa rentabilidad cuando falta un costo", () => {
  const items: QuoteItem[] = [{ productId: "a", name: "Despacho", unit: "servicio", quantity: 1, unitPrice: 10_000 }];
  const totals = quoteTotals(items);
  assert.equal(totals.hasMissingCosts, true);
  assert.equal(totals.profit, null);
  assert.equal(totals.margin, null);
});

test("migra estados anteriores y sincroniza las facturadas como aceptadas", () => {
  const base = { id: "q", number: "COT-1", date: "2026-08-01", customer: { id: "c", name: "Cliente" }, items: [], notes: "" };
  assert.equal(normalizeQuote({ ...base, status: "Enviada" }).status, "Pendiente");
  assert.equal(normalizeQuote({ ...base, status: "Lista", invoicedAmount: 1_000 }).status, "Aceptada");
  assert.equal(normalizeQuote({ ...base, status: "Anulada" }).status, "Rechazada");
});

test("activa el seguimiento semanal solo para pendientes vencidas", () => {
  const quote: Quote = { id: "q", number: "COT-1", date: "2026-08-01", status: "Pendiente", statusUpdatedAt: "2026-08-01", customer: { id: "c", name: "Cliente" }, items: [], notes: "" };
  assert.equal(needsWeeklyFollowUp(quote, new Date("2026-08-08T12:00:00")), true);
  assert.equal(needsWeeklyFollowUp({ ...quote, status: "Aceptada" }, new Date("2026-08-20T12:00:00")), false);
  assert.equal(needsWeeklyFollowUp({ ...quote, lastFollowUpAt: "2026-08-07" }, new Date("2026-08-10T12:00:00")), false);
});
