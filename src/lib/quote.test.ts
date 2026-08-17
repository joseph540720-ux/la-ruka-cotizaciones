import assert from "node:assert/strict";
import test from "node:test";
import { hoyLocal, lineSubtotal, needsWeeklyFollowUp, nextQuoteNumber, normalizeInvoiceInput, normalizeQuote, quoteTotals, type Quote, type QuoteItem } from "./quote.ts";

test("guarda la fecha de Chile aunque UTC ya esté en el día siguiente", () => {
  assert.equal(hoyLocal(new Date("2026-08-16T03:30:00.000Z")), "2026-08-15");
});

test("valida una factura y permite dejar su número pendiente", () => {
  assert.deepEqual(normalizeInvoiceInput("", "2026-08-16", "125000"), {
    invoiceNumber: undefined,
    invoicedAt: "2026-08-16",
    invoicedAmount: 125_000,
  });
  assert.deepEqual(normalizeInvoiceInput("  F-42  ", "2026-08-16", 125_000), {
    invoiceNumber: "F-42",
    invoicedAt: "2026-08-16",
    invoicedAmount: 125_000,
  });
});

test("rechaza facturas sin fecha o con un monto inválido", () => {
  assert.equal(normalizeInvoiceInput("F-42", "", 125_000), null);
  assert.equal(normalizeInvoiceInput("F-42", "2026-08-16", 0), null);
  assert.equal(normalizeInvoiceInput("F-42", "2026-08-16", 12.5), null);
});

test("genera un correlativo anual que no existe", () => {
  const now = new Date("2026-08-16T03:30:00.000Z");
  assert.equal(nextQuoteNumber([], now), "COT-2026-0001");
  assert.equal(nextQuoteNumber([
    { number: "COT-2025-0042" },
    { number: "COT-2026-0001" },
    { number: "COT-2026-0002" },
  ], now), "COT-2026-0003");
});

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
  const sentLegacy = normalizeQuote({ ...base, status: "Enviada", sentAt: "2026-08-02T10:00:00.000Z" });
  assert.equal(sentLegacy.status, "Pendiente");
  assert.equal(sentLegacy.deliveryStatus, "enviada_cliente");
  assert.equal(sentLegacy.deliveryUpdatedAt, "2026-08-02T10:00:00.000Z");
  assert.equal(normalizeQuote({ ...base, status: "Lista", invoicedAmount: 1_000 }).status, "Aceptada");
  assert.equal(normalizeQuote({ ...base, status: "Anulada" }).status, "Rechazada");
});

test("mantiene separados el envío y la respuesta de la cotización", () => {
  const normalized = normalizeQuote({
    id: "q",
    number: "COT-2",
    date: "2026-08-01",
    customer: { id: "c", name: "Municipalidad", compraPorMercadoPublico: true },
    items: [],
    notes: "",
    status: "Pendiente",
    deliveryStatus: "subida_mercado_publico",
    deliveryUpdatedAt: "2026-08-03T12:00:00.000Z",
    idAdquisicion: "1234-5-LP26",
  });
  assert.equal(normalized.status, "Pendiente");
  assert.equal(normalized.deliveryStatus, "subida_mercado_publico");
  assert.equal(normalized.idAdquisicion, "1234-5-LP26");
});

test("conserva el canal usado para terminar una cotización", () => {
  const base = { id: "q", number: "COT-3", date: "2026-08-16", customer: { id: "c", name: "Cliente" }, items: [], notes: "", status: "Pendiente" };
  for (const deliveryStatus of ["descargada", "compartida", "enviada_encargado"] as const) {
    assert.equal(normalizeQuote({ ...base, deliveryStatus }).deliveryStatus, deliveryStatus);
  }
});

test("activa el seguimiento semanal solo para pendientes vencidas", () => {
  const quote: Quote = { id: "q", number: "COT-1", date: "2026-08-01", status: "Pendiente", statusUpdatedAt: "2026-08-01", deliveryStatus: "enviada_cliente", deliveryUpdatedAt: "2026-08-01", customer: { id: "c", name: "Cliente", compraPorMercadoPublico: false }, items: [], notes: "" };
  assert.equal(needsWeeklyFollowUp(quote, new Date("2026-08-08T12:00:00")), true);
  assert.equal(needsWeeklyFollowUp({ ...quote, deliveryStatus: "borrador" }, new Date("2026-08-20T12:00:00")), false);
  assert.equal(needsWeeklyFollowUp({ ...quote, status: "Aceptada" }, new Date("2026-08-20T12:00:00")), false);
  assert.equal(needsWeeklyFollowUp({ ...quote, lastFollowUpAt: "2026-08-07" }, new Date("2026-08-10T12:00:00")), false);
});
