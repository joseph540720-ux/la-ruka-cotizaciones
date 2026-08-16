import { seedBusiness, seedCustomers, seedProducts, seedQuotes } from "./seed.ts";
import { tryNormalizeCustomer, tryNormalizeQuote, type BusinessSettings, type Customer, type Product, type Quote } from "./quote.ts";

export type AppSnapshot = {
  business: BusinessSettings;
  products: Product[];
  customers: Customer[];
  quotes: Quote[];
};

export const LOCAL_STORAGE_KEYS = {
  business: "coffee-break-business",
  products: "coffee-break-products",
  customers: "coffee-break-customers",
  quotes: "coffee-break-quotes",
} as const;

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "removeItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fallbackSnapshot(): AppSnapshot {
  return {
    business: { ...seedBusiness },
    products: [...seedProducts],
    customers: [...seedCustomers],
    quotes: [...seedQuotes],
  };
}

function isProduct(value: unknown): value is Product {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.category === "string"
    && typeof value.unit === "string"
    && typeof value.price === "number"
    && typeof value.active === "boolean";
}

function normalizeBusiness(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("Los datos del negocio no tenían un formato válido; se usó la configuración inicial.");
    return { ...seedBusiness };
  }
  const stored = value as Partial<BusinessSettings>;
  return {
    ...seedBusiness,
    ...stored,
    logoDataUrl: typeof stored.logoDataUrl === "string" && stored.logoDataUrl ? stored.logoDataUrl : "/la-ruka-logo.png",
    defaultRecipient: typeof stored.defaultRecipient === "string" ? stored.defaultRecipient : "",
  };
}

export function normalizeStoredAppState(value: unknown): { state: AppSnapshot; issues: string[] } {
  const fallback = fallbackSnapshot();
  const issues: string[] = [];
  if (!isRecord(value)) return { state: fallback, issues: ["Los datos guardados no tenían un formato válido; se usaron datos iniciales."] };

  const products = Array.isArray(value.products)
    ? value.products.filter(isProduct)
    : fallback.products;
  if (!Array.isArray(value.products)) issues.push("El catálogo guardado no era una lista; se restauró el catálogo inicial.");
  else if (products.length !== value.products.length) issues.push("Se descartaron productos guardados con datos incompletos.");

  const customers = Array.isArray(value.customers)
    ? value.customers.flatMap((customer) => {
      const normalized = tryNormalizeCustomer(customer);
      return normalized ? [normalized] : [];
    })
    : fallback.customers;
  if (!Array.isArray(value.customers)) issues.push("Los clientes guardados no eran una lista; se restauraron los clientes iniciales.");
  else if (customers.length !== value.customers.length) issues.push("Se descartaron clientes guardados con datos incompletos.");

  let quotes = fallback.quotes;
  if (Array.isArray(value.quotes)) {
    quotes = value.quotes.flatMap((rawQuote) => {
      const normalized = tryNormalizeQuote(rawQuote);
      if (!normalized) {
        issues.push("Se descartó una cotización sin número o cliente válido.");
        return [];
      }
      if (!isRecord(rawQuote) || !Array.isArray(rawQuote.items)) issues.push(`Se recuperó ${normalized.number} sin productos válidos.`);
      return [normalized];
    });
  } else {
    issues.push("Las cotizaciones guardadas no eran una lista; se inició un historial vacío.");
  }

  return {
    state: {
      business: normalizeBusiness(value.business, issues),
      products,
      customers,
      quotes,
    },
    issues,
  };
}

export function loadLocalAppState(storage: StorageReader) {
  const fallback = fallbackSnapshot();
  const raw: Record<keyof AppSnapshot, unknown> = { ...fallback };
  const issues: string[] = [];

  for (const key of Object.keys(LOCAL_STORAGE_KEYS) as Array<keyof AppSnapshot>) {
    const saved = storage.getItem(LOCAL_STORAGE_KEYS[key]);
    if (!saved) continue;
    try {
      raw[key] = JSON.parse(saved);
    } catch (error) {
      console.error(`[sync] No se pudo leer ${LOCAL_STORAGE_KEYS[key]}`, error);
      issues.push(`No se pudo leer ${LOCAL_STORAGE_KEYS[key]}; se usaron datos iniciales.`);
    }
  }

  const normalized = normalizeStoredAppState(raw);
  return { state: normalized.state, issues: [...issues, ...normalized.issues] };
}

export function saveLocalAppState(storage: StorageWriter, snapshot: AppSnapshot) {
  storage.setItem(LOCAL_STORAGE_KEYS.quotes, JSON.stringify(snapshot.quotes));
  storage.setItem(LOCAL_STORAGE_KEYS.customers, JSON.stringify(snapshot.customers));
  storage.setItem(LOCAL_STORAGE_KEYS.products, JSON.stringify(snapshot.products));
  storage.setItem(LOCAL_STORAGE_KEYS.business, JSON.stringify(snapshot.business));
}

export function clearLocalAppState(storage: StorageWriter) {
  Object.values(LOCAL_STORAGE_KEYS).forEach((key) => storage.removeItem(key));
}
