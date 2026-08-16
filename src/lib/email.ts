type StoredEmailState = {
  business?: unknown;
  customers?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLocaleLowerCase("es-CL");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function resolveQuoteRecipient(requested: unknown, configured: unknown) {
  const requestedEmail = normalizeEmail(requested);
  return requestedEmail || normalizeEmail(configured);
}

export function allowedQuoteRecipients(state: StoredEmailState) {
  const allowed = new Set<string>();
  if (isRecord(state.business)) {
    const businessEmail = normalizeEmail(state.business.defaultRecipient);
    if (businessEmail) allowed.add(businessEmail);
  }
  if (Array.isArray(state.customers)) {
    for (const customer of state.customers) {
      if (!isRecord(customer)) continue;
      const customerEmail = normalizeEmail(customer.email);
      if (customerEmail) allowed.add(customerEmail);
    }
  }
  return allowed;
}

export function isQuoteRecipientAllowed(recipient: string, state: StoredEmailState) {
  const normalized = normalizeEmail(recipient);
  return Boolean(normalized && allowedQuoteRecipients(state).has(normalized));
}

export function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

export function emailSubjectValue(value: unknown) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 100);
}
