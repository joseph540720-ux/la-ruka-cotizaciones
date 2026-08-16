import assert from "node:assert/strict";
import test from "node:test";
import { calcularDv, esRutValido, formatearRut, normalizarRutOpcional } from "./rut.ts";

test("calcula el dígito verificador con módulo 11", () => {
  assert.equal(calcularDv("12345678"), "5");
  assert.equal(calcularDv("1000005"), "K");
});

test("valida RUT con puntos, sin puntos y con K", () => {
  assert.equal(esRutValido("69.200.100-1"), true);
  assert.equal(esRutValido("692001001"), true);
  assert.equal(esRutValido("1.000.005-k"), true);
  assert.equal(esRutValido("12.345.678-0"), false);
  assert.equal(esRutValido("69.200.100-8"), false);
});

test("formatea al guardar y permite dejar el RUT vacío", () => {
  assert.equal(formatearRut("692001001"), "69.200.100-1");
  assert.equal(normalizarRutOpcional("  "), "");
  assert.equal(normalizarRutOpcional("12345678-0"), null);
});
