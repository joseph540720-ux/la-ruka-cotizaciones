import assert from "node:assert/strict";
import test from "node:test";
import { allowedQuoteRecipients, emailSubjectValue, escapeHtml, isQuoteRecipientAllowed, resolveQuoteRecipient } from "./email.ts";

const state = {
  business: { defaultRecipient: "DUEÑO@EJEMPLO.CL" },
  customers: [{ email: "cliente@ejemplo.cl" }, { email: "" }, null],
};

test("prioriza el destinatario solicitado y usa el configurado solo como respaldo", () => {
  assert.equal(resolveQuoteRecipient("cliente@ejemplo.cl", "dueno@ejemplo.cl"), "cliente@ejemplo.cl");
  assert.equal(resolveQuoteRecipient("", "dueno@ejemplo.cl"), "dueno@ejemplo.cl");
});

test("autoriza únicamente correos guardados por el usuario", () => {
  assert.deepEqual([...allowedQuoteRecipients(state)].sort(), ["cliente@ejemplo.cl", "dueño@ejemplo.cl"]);
  assert.equal(isQuoteRecipientAllowed(" CLIENTE@EJEMPLO.CL ", state), true);
  assert.equal(isQuoteRecipientAllowed("atacante@ejemplo.cl", state), false);
});

test("escapa contenido HTML y elimina saltos del asunto", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(emailSubjectValue("COT-1\r\nBcc: atacante@ejemplo.cl"), "COT-1 Bcc: atacante@ejemplo.cl");
});
