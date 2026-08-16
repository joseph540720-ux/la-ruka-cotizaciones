import type { SupabaseClient } from "@supabase/supabase-js";
import { seedBusiness, seedCustomers, seedProducts, seedQuotes } from "./seed.ts";
import type { AppSnapshot } from "./storage.ts";
import type { BusinessSettings, Customer, Product, Quote, QuoteDeliveryStatus, QuoteItem, QuoteStatus } from "./quote.ts";

type BusinessRow = {
  user_id: string; name: string; legal_name: string; rut: string; address: string; phone: string;
  email: string; default_recipient: string; logo_data_url: string | null;
};
type ProductRow = { user_id: string; id: string; name: string; category: string; unit: string; price: number; cost: number | null; active: boolean };
type CustomerRow = { user_id: string; id: string; name: string; rut: string | null; contact: string | null; email: string | null; phone: string | null; address: string | null; compra_por_mercado_publico: boolean };
type QuoteRow = {
  user_id: string; id: string; number: string; quote_date: string; customer_id: string; customer_name: string;
  customer_rut: string | null; customer_contact: string | null; customer_email: string | null; customer_phone: string | null;
  customer_address: string | null; customer_compra_por_mercado_publico: boolean; notes: string; status: QuoteStatus;
  status_updated_at: string | null; last_follow_up_at: string | null; delivery_status: QuoteDeliveryStatus;
  delivery_updated_at: string | null; id_adquisicion: string | null; owner_copy_sent_at: string | null;
};
type ItemRow = { user_id: string; quote_id: string; position: number; product_id: string; name: string; unit: string; quantity: number; unit_price: number; unit_cost: number | null };
type InvoiceRow = { user_id: string; quote_id: string; invoice_number: string | null; invoiced_at: string | null; amount: number };

export type CloudRows = {
  business: BusinessRow[];
  products: ProductRow[];
  customers: CustomerRow[];
  quotes: QuoteRow[];
  items: ItemRow[];
  invoices: InvoiceRow[];
};

function optional(value: string | null) {
  return value || undefined;
}

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedRows<T extends { id: string }>(previous: T[], next: T[]) {
  const previousById = new Map(previous.map((row) => [row.id, row]));
  return next.filter((row) => !equal(previousById.get(row.id), row));
}

function deletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  const nextIds = new Set(next.map((row) => row.id));
  return previous.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
}

export type SnapshotDiff = {
  businessChanged: boolean;
  productsToUpsert: Product[];
  productIdsToDelete: string[];
  customersToUpsert: Customer[];
  customerIdsToDelete: string[];
  quotesToUpsert: Quote[];
  quoteIdsToDelete: string[];
};

export function diffSnapshots(previous: AppSnapshot | null, next: AppSnapshot): SnapshotDiff {
  if (!previous) return {
    businessChanged: true,
    productsToUpsert: next.products,
    productIdsToDelete: [],
    customersToUpsert: next.customers,
    customerIdsToDelete: [],
    quotesToUpsert: next.quotes,
    quoteIdsToDelete: [],
  };
  return {
    businessChanged: !equal(previous.business, next.business),
    productsToUpsert: changedRows(previous.products, next.products),
    productIdsToDelete: deletedIds(previous.products, next.products),
    customersToUpsert: changedRows(previous.customers, next.customers),
    customerIdsToDelete: deletedIds(previous.customers, next.customers),
    quotesToUpsert: changedRows(previous.quotes, next.quotes),
    quoteIdsToDelete: deletedIds(previous.quotes, next.quotes),
  };
}

export function cloudRowsToSnapshot(rows: CloudRows): AppSnapshot {
  const businessRow = rows.business[0];
  const business: BusinessSettings = businessRow ? {
    name: businessRow.name,
    legalName: businessRow.legal_name,
    rut: businessRow.rut,
    address: businessRow.address,
    phone: businessRow.phone,
    email: businessRow.email,
    defaultRecipient: businessRow.default_recipient.trim() || seedBusiness.defaultRecipient,
    logoDataUrl: optional(businessRow.logo_data_url),
  } : { ...seedBusiness };
  const products: Product[] = rows.products.map((row) => ({ id: row.id, name: row.name, category: row.category, unit: row.unit, price: Number(row.price), cost: row.cost == null ? undefined : Number(row.cost), active: row.active }));
  const customers: Customer[] = rows.customers.map((row) => ({ id: row.id, name: row.name, rut: optional(row.rut), contact: optional(row.contact), email: optional(row.email), phone: optional(row.phone), address: optional(row.address), compraPorMercadoPublico: row.compra_por_mercado_publico }));
  const itemsByQuote = new Map<string, QuoteItem[]>();
  rows.items.sort((left, right) => left.position - right.position).forEach((row) => {
    const item: QuoteItem = { productId: row.product_id, name: row.name, unit: row.unit, quantity: Number(row.quantity), unitPrice: Number(row.unit_price), unitCost: row.unit_cost == null ? undefined : Number(row.unit_cost) };
    itemsByQuote.set(row.quote_id, [...(itemsByQuote.get(row.quote_id) || []), item]);
  });
  const invoices = new Map(rows.invoices.map((row) => [row.quote_id, row]));
  const quotes: Quote[] = rows.quotes.map((row) => {
    const invoice = invoices.get(row.id);
    return {
      id: row.id,
      number: row.number,
      date: row.quote_date,
      customer: { id: row.customer_id, name: row.customer_name, rut: optional(row.customer_rut), contact: optional(row.customer_contact), email: optional(row.customer_email), phone: optional(row.customer_phone), address: optional(row.customer_address), compraPorMercadoPublico: row.customer_compra_por_mercado_publico },
      items: itemsByQuote.get(row.id) || [],
      notes: row.notes,
      status: row.status,
      statusUpdatedAt: optional(row.status_updated_at),
      lastFollowUpAt: optional(row.last_follow_up_at),
      deliveryStatus: row.delivery_status,
      deliveryUpdatedAt: optional(row.delivery_updated_at),
      idAdquisicion: optional(row.id_adquisicion),
      ownerCopySentAt: optional(row.owner_copy_sent_at),
      invoicedAmount: invoice ? Number(invoice.amount) : undefined,
      invoicedAt: invoice ? optional(invoice.invoiced_at) : undefined,
      invoiceNumber: invoice ? optional(invoice.invoice_number) : undefined,
    };
  });
  const hasStoredData = Boolean(businessRow || rows.products.length || rows.customers.length || rows.quotes.length);
  return hasStoredData ? { business, products, customers, quotes } : { business: { ...seedBusiness }, products: [...seedProducts], customers: [...seedCustomers], quotes: [...seedQuotes] };
}

function businessToRow(userId: string, business: BusinessSettings) {
  return { user_id: userId, name: business.name, legal_name: business.legalName, rut: business.rut, address: business.address, phone: business.phone, email: business.email, default_recipient: business.defaultRecipient, logo_data_url: business.logoDataUrl || null, updated_at: new Date().toISOString() };
}

function productToRow(userId: string, product: Product) {
  return { user_id: userId, id: product.id, name: product.name, category: product.category, unit: product.unit, price: product.price, cost: product.cost ?? null, active: product.active, updated_at: new Date().toISOString() };
}

function customerToRow(userId: string, customer: Customer) {
  return { user_id: userId, id: customer.id, name: customer.name, rut: customer.rut || null, contact: customer.contact || null, email: customer.email || null, phone: customer.phone || null, address: customer.address || null, compra_por_mercado_publico: customer.compraPorMercadoPublico, updated_at: new Date().toISOString() };
}

function quoteToRow(userId: string, quote: Quote) {
  return { user_id: userId, id: quote.id, number: quote.number, quote_date: quote.date, customer_id: quote.customer.id, customer_name: quote.customer.name, customer_rut: quote.customer.rut || null, customer_contact: quote.customer.contact || null, customer_email: quote.customer.email || null, customer_phone: quote.customer.phone || null, customer_address: quote.customer.address || null, customer_compra_por_mercado_publico: quote.customer.compraPorMercadoPublico, notes: quote.notes, status: quote.status, status_updated_at: quote.statusUpdatedAt || null, last_follow_up_at: quote.lastFollowUpAt || null, delivery_status: quote.deliveryStatus, delivery_updated_at: quote.deliveryUpdatedAt || null, id_adquisicion: quote.idAdquisicion || null, owner_copy_sent_at: quote.ownerCopySentAt || null, updated_at: new Date().toISOString() };
}

function quoteItemsToRows(userId: string, quote: Quote) {
  return quote.items.map((item, position) => ({ user_id: userId, quote_id: quote.id, position, product_id: item.productId, name: item.name, unit: item.unit, quantity: item.quantity, unit_price: item.unitPrice, unit_cost: item.unitCost ?? null, updated_at: new Date().toISOString() }));
}

function quoteInvoiceToRow(userId: string, quote: Quote) {
  if (quote.invoicedAmount == null) return null;
  return { user_id: userId, quote_id: quote.id, invoice_number: quote.invoiceNumber || null, invoiced_at: quote.invoicedAt || null, amount: quote.invoicedAmount, updated_at: new Date().toISOString() };
}

async function ensureResult(query: PromiseLike<{ error: { message: string } | null }>, context: string) {
  const { error } = await query;
  if (error) throw new Error(`${context}: ${error.message}`);
}

export async function loadCloudAppState(client: SupabaseClient, userId: string) {
  const [business, products, customers, quotes, items, invoices] = await Promise.all([
    client.from("negocios").select("user_id,name,legal_name,rut,address,phone,email,default_recipient,logo_data_url").eq("user_id", userId),
    client.from("productos").select("user_id,id,name,category,unit,price,cost,active").eq("user_id", userId).order("name"),
    client.from("clientes").select("user_id,id,name,rut,contact,email,phone,address,compra_por_mercado_publico").eq("user_id", userId).order("name"),
    client.from("cotizaciones").select("user_id,id,number,quote_date,customer_id,customer_name,customer_rut,customer_contact,customer_email,customer_phone,customer_address,customer_compra_por_mercado_publico,notes,status,status_updated_at,last_follow_up_at,delivery_status,delivery_updated_at,id_adquisicion,owner_copy_sent_at").eq("user_id", userId).order("quote_date", { ascending: false }).order("number", { ascending: false }),
    client.from("cotizacion_items").select("user_id,quote_id,position,product_id,name,unit,quantity,unit_price,unit_cost").eq("user_id", userId).order("position"),
    client.from("facturas").select("user_id,quote_id,invoice_number,invoiced_at,amount").eq("user_id", userId),
  ]);
  const failed = [business, products, customers, quotes, items, invoices].find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
  const rows = {
    business: (business.data || []) as BusinessRow[],
    products: (products.data || []) as ProductRow[],
    customers: (customers.data || []) as CustomerRow[],
    quotes: (quotes.data || []) as QuoteRow[],
    items: (items.data || []) as ItemRow[],
    invoices: (invoices.data || []) as InvoiceRow[],
  };
  const stored = Boolean(rows.business.length || rows.products.length || rows.customers.length || rows.quotes.length);
  return { state: cloudRowsToSnapshot(rows), stored };
}

export async function persistCloudChanges(client: SupabaseClient, userId: string, previous: AppSnapshot | null, next: AppSnapshot) {
  const diff = diffSnapshots(previous, next);
  if (diff.businessChanged) await ensureResult(client.from("negocios").upsert(businessToRow(userId, next.business), { onConflict: "user_id" }), "No se guardó el negocio");
  if (diff.productsToUpsert.length) await ensureResult(client.from("productos").upsert(diff.productsToUpsert.map((product) => productToRow(userId, product)), { onConflict: "user_id,id" }), "No se guardaron los productos");
  if (diff.customersToUpsert.length) await ensureResult(client.from("clientes").upsert(diff.customersToUpsert.map((customer) => customerToRow(userId, customer)), { onConflict: "user_id,id" }), "No se guardaron los clientes");
  if (diff.quotesToUpsert.length) await ensureResult(client.from("cotizaciones").upsert(diff.quotesToUpsert.map((quote) => quoteToRow(userId, quote)), { onConflict: "user_id,id" }), "No se guardaron las cotizaciones");

  for (const quote of diff.quotesToUpsert) {
    const previousQuote = previous?.quotes.find((candidate) => candidate.id === quote.id);
    if (!previousQuote || !equal(previousQuote.items, quote.items)) {
      const itemRows = quoteItemsToRows(userId, quote);
      if (itemRows.length) await ensureResult(client.from("cotizacion_items").upsert(itemRows, { onConflict: "user_id,quote_id,position" }), `No se guardaron los ítems de ${quote.number}`);
      const staleItems = client.from("cotizacion_items").delete().eq("user_id", userId).eq("quote_id", quote.id);
      await ensureResult(itemRows.length ? staleItems.gte("position", itemRows.length) : staleItems, `No se limpiaron los ítems de ${quote.number}`);
    }
    const previousInvoice = previousQuote && { amount: previousQuote.invoicedAmount, date: previousQuote.invoicedAt, number: previousQuote.invoiceNumber };
    const nextInvoice = { amount: quote.invoicedAmount, date: quote.invoicedAt, number: quote.invoiceNumber };
    if (!equal(previousInvoice, nextInvoice)) {
      const invoice = quoteInvoiceToRow(userId, quote);
      if (invoice) await ensureResult(client.from("facturas").upsert(invoice, { onConflict: "user_id,quote_id" }), `No se guardó la factura de ${quote.number}`);
      else await ensureResult(client.from("facturas").delete().eq("user_id", userId).eq("quote_id", quote.id), `No se eliminó la factura de ${quote.number}`);
    }
  }

  if (diff.quoteIdsToDelete.length) await ensureResult(client.from("cotizaciones").delete().eq("user_id", userId).in("id", diff.quoteIdsToDelete), "No se eliminaron las cotizaciones");
  if (diff.productIdsToDelete.length) await ensureResult(client.from("productos").delete().eq("user_id", userId).in("id", diff.productIdsToDelete), "No se eliminaron los productos");
  if (diff.customerIdsToDelete.length) await ensureResult(client.from("clientes").delete().eq("user_id", userId).in("id", diff.customerIdsToDelete), "No se eliminaron los clientes");
}
