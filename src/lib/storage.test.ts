import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStoredAppState } from "./storage.ts";

test("repara cotizaciones sin items y descarta las que no tienen cliente o número", () => {
  const validCustomer = { id: "c", name: "Cliente" };
  const { state, issues } = normalizeStoredAppState({
    business: {},
    products: [],
    customers: [],
    quotes: [
      { id: "q1-real", number: "COT-1", date: "2026-08-01", customer: validCustomer, status: "Pendiente" },
      { id: "q2-real", number: "COT-2", date: "2026-08-01", status: "Pendiente", items: [] },
      { id: "q3-real", date: "2026-08-01", customer: validCustomer, status: "Pendiente", items: [] },
    ],
  });

  assert.equal(state.quotes.length, 1);
  assert.deepEqual(state.quotes[0].items, []);
  assert.equal(issues.some((issue) => issue.includes("recuperó COT-1")), true);
  assert.equal(issues.filter((issue) => issue.includes("descartó una cotización")).length, 2);
});

test("restaura semillas si productos o clientes no son arreglos", () => {
  const { state, issues } = normalizeStoredAppState({ business: {}, products: {}, customers: null, quotes: [] });
  assert.equal(state.products.length > 0, true);
  assert.equal(state.customers.length > 0, true);
  assert.equal(state.business.defaultRecipient, "joseph540720@gmail.com");
  assert.equal(issues.some((issue) => issue.includes("catálogo")), true);
  assert.equal(issues.some((issue) => issue.includes("clientes")), true);
});

test("migra el canal preferido de clientes antiguos", () => {
  const { state } = normalizeStoredAppState({
    business: {},
    products: [],
    customers: [
      { id: "c1", name: "Municipalidad de Mariquina" },
      { id: "propio", name: "Empresa privada" },
    ],
    quotes: [],
  });
  assert.equal(state.customers[0].compraPorMercadoPublico, true);
  assert.equal(state.customers[1].compraPorMercadoPublico, false);
});
