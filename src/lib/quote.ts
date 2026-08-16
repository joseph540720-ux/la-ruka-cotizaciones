export type Product = { id: string; name: string; category: string; unit: string; price: number; cost?: number; active: boolean };
export type Customer = { id: string; name: string; rut?: string; contact?: string; email?: string; phone?: string; address?: string };
export type QuoteItem = { productId: string; name: string; unit: string; quantity: number; unitPrice: number; unitCost?: number };
export type QuoteStatus = "Pendiente" | "Aceptada" | "Rechazada";
export type Quote = { id: string; number: string; date: string; customer: Customer; items: QuoteItem[]; notes: string; status: QuoteStatus; statusUpdatedAt?: string; lastFollowUpAt?: string; invoicedAmount?: number; invoicedAt?: string; invoiceNumber?: string };
export type BusinessSettings = { name: string; legalName: string; rut: string; address: string; phone: string; email: string; defaultRecipient: string; logoDataUrl?: string };

export const IVA_RATE = 19;

export function normalizeQuote(quote: Omit<Quote, "status"> & { status: string }): Quote {
  const status: QuoteStatus = quote.invoicedAmount && quote.invoicedAmount > 0
    ? "Aceptada"
    : quote.status === "Aceptada" || quote.status === "Rechazada" || quote.status === "Pendiente"
      ? quote.status
      : quote.status === "Anulada" ? "Rechazada" : "Pendiente";
  return { ...quote, status, statusUpdatedAt: quote.statusUpdatedAt || quote.date };
}

export function needsWeeklyFollowUp(quote: Quote, today = new Date()) {
  if (quote.status !== "Pendiente") return false;
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
