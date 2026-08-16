export type Product = { id: string; name: string; category: string; unit: string; price: number; cost?: number; active: boolean };
export type Customer = { id: string; name: string; rut?: string; contact?: string; email?: string; phone?: string; address?: string; compraPorMercadoPublico: boolean };
export type QuoteItem = { productId: string; name: string; unit: string; quantity: number; unitPrice: number; unitCost?: number };
export type QuoteStatus = "Pendiente" | "Aceptada" | "Rechazada";
export type QuoteDeliveryStatus = "borrador" | "enviada_cliente" | "subida_mercado_publico";
export type Quote = { id: string; number: string; date: string; customer: Customer; items: QuoteItem[]; notes: string; status: QuoteStatus; statusUpdatedAt?: string; lastFollowUpAt?: string; deliveryStatus: QuoteDeliveryStatus; deliveryUpdatedAt?: string; idAdquisicion?: string; ownerCopySentAt?: string; invoicedAmount?: number; invoicedAt?: string; invoiceNumber?: string };
export type BusinessSettings = { name: string; legalName: string; rut: string; address: string; phone: string; email: string; defaultRecipient: string; logoDataUrl?: string };

export const IVA_RATE = 19;

export function hoyLocal(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(now);
}

export function nextQuoteNumber(quotes: readonly Pick<Quote, "number">[], now = new Date()) {
  const year = hoyLocal(now).slice(0, 4);
  const pattern = new RegExp(`^COT-${year}-(\\d+)$`);
  const used = new Set(quotes.map((quote) => quote.number));
  const highest = quotes.reduce((maximum, quote) => {
    const match = quote.number.match(pattern);
    if (!match) return maximum;
    const sequence = Number(match[1]);
    return Number.isSafeInteger(sequence) && sequence > maximum ? sequence : maximum;
  }, 0);
  let sequence = highest + 1;
  let candidate = `COT-${year}-${String(sequence).padStart(4, "0")}`;
  while (used.has(candidate)) {
    sequence += 1;
    candidate = `COT-${year}-${String(sequence).padStart(4, "0")}`;
  }
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function inferMercadoPublico(value: Record<string, unknown>) {
  if (typeof value.compraPorMercadoPublico === "boolean") return value.compraPorMercadoPublico;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name.toLocaleLowerCase("es-CL") : "";
  return id === "c1" || id === "c3" || name.includes("municipalidad") || name.includes("escuela");
}

export function tryNormalizeCustomer(value: unknown): Customer | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : `cliente-${value.name}`,
    name: value.name,
    rut: optionalString(value.rut),
    contact: optionalString(value.contact),
    email: optionalString(value.email),
    phone: optionalString(value.phone),
    address: optionalString(value.address),
    compraPorMercadoPublico: inferMercadoPublico(value),
  };
}

function normalizeItems(value: unknown): QuoteItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice)) return [];
    return [{
      productId: typeof item.productId === "string" && item.productId ? item.productId : `producto-${item.name}`,
      name: item.name,
      unit: typeof item.unit === "string" ? item.unit : "unidad",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: typeof item.unitCost === "number" && Number.isFinite(item.unitCost) ? item.unitCost : undefined,
    }];
  });
}

export function tryNormalizeQuote(quote: unknown): Quote | null {
  if (!isRecord(quote) || typeof quote.number !== "string" || !quote.number.trim()) return null;
  const customer = tryNormalizeCustomer(quote.customer);
  if (!customer) return null;
  const invoicedAmount = typeof quote.invoicedAmount === "number" && Number.isFinite(quote.invoicedAmount) ? quote.invoicedAmount : undefined;
  const status: QuoteStatus = invoicedAmount && invoicedAmount > 0
    ? "Aceptada"
    : quote.status === "Aceptada" || quote.status === "Rechazada" || quote.status === "Pendiente"
      ? quote.status
      : quote.status === "Anulada" ? "Rechazada" : "Pendiente";
  const date = typeof quote.date === "string" && quote.date ? quote.date : "1970-01-01";
  const deliveryStatus: QuoteDeliveryStatus = quote.deliveryStatus === "enviada_cliente" || quote.deliveryStatus === "subida_mercado_publico" || quote.deliveryStatus === "borrador"
    ? quote.deliveryStatus
    : quote.status === "Enviada" || Boolean(optionalString(quote.sentAt))
      ? "enviada_cliente"
      : "borrador";
  const deliveryUpdatedAt = optionalString(quote.deliveryUpdatedAt)
    || (deliveryStatus !== "borrador" ? optionalString(quote.sentAt) || optionalString(quote.statusUpdatedAt) || date : undefined);
  return {
    id: typeof quote.id === "string" && quote.id ? quote.id : `cotizacion-${quote.number}`,
    number: quote.number,
    date,
    customer,
    items: normalizeItems(quote.items),
    notes: typeof quote.notes === "string" ? quote.notes : "",
    status,
    statusUpdatedAt: optionalString(quote.statusUpdatedAt) || date,
    lastFollowUpAt: optionalString(quote.lastFollowUpAt),
    deliveryStatus,
    deliveryUpdatedAt,
    idAdquisicion: optionalString(quote.idAdquisicion),
    ownerCopySentAt: optionalString(quote.ownerCopySentAt),
    invoicedAmount,
    invoicedAt: optionalString(quote.invoicedAt),
    invoiceNumber: optionalString(quote.invoiceNumber),
  };
}

export function normalizeQuote(quote: unknown): Quote {
  return tryNormalizeQuote(quote) || {
    id: "cotizacion-recuperada",
    number: "Cotización recuperada",
    date: "1970-01-01",
    customer: { id: "cliente-recuperado", name: "Cliente no disponible", compraPorMercadoPublico: false },
    items: [],
    notes: "",
    status: "Pendiente",
    statusUpdatedAt: "1970-01-01",
    deliveryStatus: "borrador",
  };
}

export function needsWeeklyFollowUp(quote: Quote, today = new Date()) {
  if (quote.status !== "Pendiente" || quote.deliveryStatus === "borrador") return false;
  const reference = new Date(`${quote.lastFollowUpAt || quote.statusUpdatedAt || quote.date}T12:00:00`);
  return today.getTime() - reference.getTime() >= 7 * 24 * 60 * 60 * 1000;
}

export function lineSubtotal(item: QuoteItem) {
  return Math.round(item.quantity * item.unitPrice);
}

export function quoteTotals(items: QuoteItem[]) {
  const net = items.reduce((sum, item) => sum + lineSubtotal(item), 0);
  const tax = Math.round((net * IVA_RATE) / 100);
  const total = net + tax;
  const knownCost = items.reduce((sum, item) => sum + (item.unitCost == null ? 0 : Math.round(item.quantity * item.unitCost)), 0);
  const hasMissingCosts = items.some((item) => item.unitCost == null);
  const profit = hasMissingCosts ? null : net - knownCost;
  const margin = profit == null || net === 0 ? null : (profit / net) * 100;
  return { net, tax, total, cost: knownCost, profit, margin, hasMissingCosts };
}

export function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
