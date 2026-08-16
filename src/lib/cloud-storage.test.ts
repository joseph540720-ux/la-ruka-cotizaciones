import assert from "node:assert/strict";
import test from "node:test";
import { cloudRowsToSnapshot, diffSnapshots } from "./cloud-storage.ts";
import { seedBusiness } from "./seed.ts";
import type { AppSnapshot } from "./storage.ts";

const original: AppSnapshot = {
  business: { ...seedBusiness },
  products: [{ id: "p1", name: "Café", category: "Bebestibles", unit: "vaso", price: 1000, cost: 400, active: true }],
  customers: [{ id: "c1", name: "Cliente", compraPorMercadoPublico: false }],
  quotes: [],
};

test("solo persiste las filas que realmente cambiaron", () => {
  const next: AppSnapshot = {
    ...original,
    customers: [...original.customers, { id: "c2", name: "Cliente nuevo", phone: "+56912345678", compraPorMercadoPublico: false }],
  };
  const diff = diffSnapshots(original, next);
  assert.deepEqual(diff.productsToUpsert, []);
  assert.deepEqual(diff.customersToUpsert.map((customer) => customer.id), ["c2"]);
  assert.deepEqual(diff.quoteIdsToDelete, []);
  assert.equal(diff.businessChanged, false);
});

test("una base relacional vacía se inicializa por filas", () => {
  const diff = diffSnapshots(null, original);
  assert.equal(diff.businessChanged, true);
  assert.deepEqual(diff.productsToUpsert.map((product) => product.id), ["p1"]);
  assert.deepEqual(diff.customersToUpsert.map((customer) => customer.id), ["c1"]);
});

test("reconstruye cotizaciones con ítems y factura desde tablas", () => {
  const snapshot = cloudRowsToSnapshot({
    business: [{ user_id: "u1", name: "La Ruka", legal_name: "", rut: "", address: "Mariquina", phone: "", email: "", default_recipient: "", logo_data_url: null }],
    products: [],
    customers: [],
    quotes: [{ user_id: "u1", id: "q1", number: "COT-2026-0001", quote_date: "2026-08-16", customer_id: "c1", customer_name: "Municipalidad", customer_rut: null, customer_contact: null, customer_email: null, customer_phone: null, customer_address: null, customer_compra_por_mercado_publico: true, notes: "", status: "Aceptada", status_updated_at: "2026-08-16", last_follow_up_at: null, delivery_status: "enviada_cliente", delivery_updated_at: null, id_adquisicion: null, owner_copy_sent_at: null }],
    items: [{ user_id: "u1", quote_id: "q1", position: 0, product_id: "p1", name: "Café", unit: "vaso", quantity: 2, unit_price: 1000, unit_cost: 400 }],
    invoices: [{ user_id: "u1", quote_id: "q1", invoice_number: "F-1", invoiced_at: "2026-08-16", amount: 2380 }],
  });
  assert.equal(snapshot.quotes[0].items[0].quantity, 2);
  assert.equal(snapshot.quotes[0].invoicedAmount, 2380);
  assert.equal(snapshot.quotes[0].customer.compraPorMercadoPublico, true);
  assert.equal(snapshot.business.defaultRecipient, "joseph540720@gmail.com");
});
