const TESTING_EMAIL_ERROR = "only send testing emails to your own email address";

export function resendErrorMessage(message: unknown) {
  const detail = typeof message === "string" ? message.trim() : "";
  const normalized = detail.toLocaleLowerCase("en");
  if (normalized.includes(TESTING_EMAIL_ERROR)) {
    return "Resend está en modo de prueba. Por ahora solo puede enviar a joseph540720@gmail.com. Para enviar al cliente, verifica un dominio propio en Resend y configura RESEND_FROM_EMAIL con ese dominio.";
  }
  if (normalized.includes("domain is not verified")) {
    return "El dominio del remitente todavía no está verificado en Resend. Revisa sus registros DNS y luego vuelve a intentar.";
  }
  return detail || "El proveedor de correo rechazó el envío.";
}
