import assert from "node:assert/strict";
import test from "node:test";
import { customerInitials, savedQuotesLabel } from "./text.ts";

test("usa las iniciales de las primeras dos palabras", () => {
  assert.equal(customerInitials("Municipalidad de Mariquina"), "MD");
  assert.equal(customerInitials("  la ruka "), "LR");
});

test("concordancia singular y plural de cotizaciones", () => {
  assert.equal(savedQuotesLabel(1), "1 cotización guardada");
  assert.equal(savedQuotesLabel(2), "2 cotizaciones guardadas");
});
