import assert from "node:assert/strict";
import test from "node:test";
import { resendErrorMessage } from "./resend.ts";

test("explica en español la restricción del dominio de prueba", () => {
  const message = "You can only send testing emails to your own email address (joseph540720@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.";
  assert.match(resendErrorMessage(message), /modo de prueba/);
  assert.match(resendErrorMessage(message), /verifica un dominio propio/);
});

test("conserva otros errores de Resend y entrega un respaldo", () => {
  assert.equal(resendErrorMessage("Daily quota exceeded"), "Daily quota exceeded");
  assert.equal(resendErrorMessage(undefined), "El proveedor de correo rechazó el envío.");
});
