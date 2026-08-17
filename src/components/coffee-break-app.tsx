"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { seedBusiness, seedCustomers, seedProducts, seedQuotes } from "@/lib/seed";
import { formatCLP, formatDate, formatMargin, hoyLocal, lineSubtotal, needsWeeklyFollowUp, nextQuoteNumber, normalizeInvoiceInput, quoteTotals, type BusinessSettings, type Customer, type Product, type Quote, type QuoteDeliveryStatus, type QuoteItem, type QuoteStatus } from "@/lib/quote";
import { downloadQuotePdf, quotePdfAttachment, shareQuotePdf } from "@/lib/pdf";
import { getSupabase, isCloudConfigured } from "@/lib/supabase";
import { clearNewQuoteDraft, loadLocalAppState, loadNewQuoteDraft, saveLocalAppState, saveNewQuoteDraft, type AppSnapshot } from "@/lib/storage";
import { loadCloudAppState, persistCloudChanges } from "@/lib/cloud-storage";
import { normalizeEmail } from "@/lib/email";
import { esRutValido, formatearRut, normalizarRutOpcional } from "@/lib/rut";
import { customerInitials, savedQuotesLabel } from "@/lib/text";

type View = "home" | "quotes" | "products" | "customers" | "settings" | "new-quote";
type QuoteWizardMode = "create" | "duplicate" | "edit";
type AppRoute = { view: View; quoteId?: string; wizardMode?: QuoteWizardMode };
type IconName = "home" | "file" | "box" | "users" | "settings" | "plus" | "search" | "arrow" | "check" | "trash" | "coffee" | "mail" | "download" | "share" | "edit" | "chevron";
type SyncStatus = "guardando" | "guardado" | "error";
type EmailTarget = "owner" | "customer";

function safeDecodeRouteSegment(value: string) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

function quotePath(id: string) {
  return `/cotizaciones/${encodeURIComponent(id)}`;
}

function appRoute(pathname: string): AppRoute {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { view: "home" };
  if (segments[0] === "productos") return { view: "products" };
  if (segments[0] === "clientes") return { view: "customers" };
  if (segments[0] === "mi-negocio") return { view: "settings" };
  if (segments[0] !== "cotizaciones") return { view: "home" };
  if (segments.length === 1) return { view: "quotes" };
  if (segments[1] === "nueva") return { view: "new-quote", wizardMode: "create" };
  const quoteId = safeDecodeRouteSegment(segments[1]);
  if (segments[2] === "editar") return { view: "new-quote", quoteId, wizardMode: "edit" };
  if (segments[2] === "duplicar") return { view: "new-quote", quoteId, wizardMode: "duplicate" };
  return { view: "quotes", quoteId };
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    file: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2M16 4a4 4 0 0 1 0 8M18 14a5 5 0 0 1 4 5v2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>, check: <path d="m5 12 4 4L19 6"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    coffee: <><path d="M4 9h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 11h1a3 3 0 0 1 0 6h-2M8 3v3M12 2v4"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></>,
    edit: <><path d="m4 20 4-.8L19 8.3 15.7 5 4.8 15.9zM13.8 6.9l3.3 3.3"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Badge({ status }: { status: Quote["status"] }) {
  return <span className={`badge badge-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

const deliveryLabels: Record<QuoteDeliveryStatus, string> = {
  borrador: "Borrador",
  descargada: "PDF descargado",
  compartida: "Compartida",
  enviada_encargado: "Enviada al encargado",
  enviada_cliente: "Enviada al cliente",
  subida_mercado_publico: "Mercado Público",
};

function DeliveryBadge({ status }: { status: QuoteDeliveryStatus }) {
  return <span className={`delivery-badge delivery-${status}`}>{deliveryLabels[status]}</span>;
}

function MarginIndicator({ items }: { items: QuoteItem[] }) {
  const totals = quoteTotals(items);
  return totals.margin == null
    ? <span className="margin-indicator incomplete" title="Falta el costo de uno o más productos, o no hay venta neta">Sin calcular</span>
    : <span className={`margin-indicator${totals.margin < 0 ? " negative" : ""}`}>{formatMargin(totals.margin)}</span>;
}

function ProfitabilitySummary({ items, className = "" }: { items: QuoteItem[]; className?: string }) {
  const totals = quoteTotals(items);
  return <div className={`profit-box ${className}`.trim()}>
    <small>Información interna · no aparece en el PDF</small>
    <span>Venta neta <b>{formatCLP(totals.net)}</b></span>
    <span>Costo estimado <b>{totals.hasMissingCosts ? "Incompleto" : formatCLP(totals.cost)}</b></span>
    <span>Ganancia estimada <b>{totals.profit == null ? "No calculada" : formatCLP(totals.profit)}</b></span>
    <span className={`profit-margin${totals.margin != null && totals.margin < 0 ? " negative" : totals.margin == null ? " incomplete" : ""}`}>Margen de ganancia <b>{formatMargin(totals.margin)}</b></span>
    {totals.hasMissingCosts && <p>Agrega el costo referencial de todos los productos para calcular el margen.</p>}
  </div>;
}

function deliveryDate(value?: string) {
  return value ? formatDate(value.slice(0, 10)) : "";
}

function deliveryDescription(quote: Quote) {
  const date = deliveryDate(quote.deliveryUpdatedAt);
  if (quote.deliveryStatus === "borrador") return "Aún no se registra una entrega.";
  if (quote.deliveryStatus === "descargada") return `PDF descargado${date ? ` el ${date}` : ""}.`;
  if (quote.deliveryStatus === "compartida") return `Cotización compartida${date ? ` el ${date}` : ""}.`;
  if (quote.deliveryStatus === "enviada_encargado") return `Enviada al encargado${date ? ` el ${date}` : ""}.`;
  if (quote.deliveryStatus === "enviada_cliente") return `Enviada al cliente${date ? ` el ${date}` : ""}.`;
  return `Subida a Mercado Público${date ? ` el ${date}` : ""}.`;
}

async function sendQuoteEmail(quote: Quote, business: BusinessSettings, recipient: string) {
  const attachment = await quotePdfAttachment(quote, business);
  const session = await getSupabase()?.auth.getSession();
  const accessToken = session?.data.session?.access_token;
  if (!accessToken) throw new Error("La sesión expiró. Vuelve a ingresar.");
  const response = await fetch("/api/send-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ to: recipient, quoteNumber: quote.number, customerName: quote.customer.name, ...attachment }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "No fue posible enviar el correo.");
}

function withQuoteStatus(quote: Quote, status: QuoteStatus): Quote {
  const today = hoyLocal();
  return { ...quote, status, statusUpdatedAt: today, lastFollowUpAt: status === "Pendiente" ? undefined : quote.lastFollowUpAt };
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search"><Icon name="search"/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/></label>;
}

const INVALID_RUT_MESSAGE = "Ingresa un RUT chileno válido o deja el campo vacío.";
const DEFAULT_QUOTE_NOTES = "Valores netos. Cotización válida por 10 días.";

function validateRutInput(input: HTMLInputElement, report = false) {
  const value = input.value.trim();
  const valid = !value || esRutValido(value);
  input.setCustomValidity(valid ? "" : INVALID_RUT_MESSAGE);
  if (valid && value) input.value = formatearRut(value);
  if (!valid && report) input.reportValidity();
  return valid;
}

function validateRutForm(event: FormEvent<HTMLFormElement>) {
  const input = event.currentTarget.elements.namedItem("rut");
  if (input instanceof HTMLInputElement && !validateRutInput(input, true)) event.preventDefault();
}

function RutInput({ defaultValue, placeholder }: { defaultValue?: string; placeholder?: string }) {
  return <input name="rut" defaultValue={defaultValue} placeholder={placeholder} inputMode="text" autoCapitalize="characters" onChange={(event) => event.currentTarget.setCustomValidity("")} onBlur={(event) => validateRutInput(event.currentTarget, true)}/>;
}

function CustomerForm({ initialCustomer, onSave, onCancel, submitLabel, autoFocusName = false }: { initialCustomer?: Customer | null; onSave: (customer: Customer) => void; onCancel: () => void; submitLabel: string; autoFocusName?: boolean }) {
  const saveCustomer = (data: FormData) => {
    const name = String(data.get("name") || "").trim();
    const rut = normalizarRutOpcional(String(data.get("rut") || ""));
    if (!name || rut == null) return;
    onSave({
      id: initialCustomer?.id || crypto.randomUUID(),
      name,
      rut,
      contact: String(data.get("contact") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      address: String(data.get("address") || "").trim(),
      compraPorMercadoPublico: data.get("compraPorMercadoPublico") === "on",
    });
  };
  return <form className="quote-customer-form customer-editor-form" action={saveCustomer} onSubmit={validateRutForm}>
    <label>Nombre o institución *<input name="name" required autoFocus={autoFocusName} placeholder="Ej: Junta de vecinos Los Alerces" defaultValue={initialCustomer?.name}/></label>
    <label>RUT<RutInput placeholder="12.345.678-9" defaultValue={initialCustomer?.rut}/></label>
    <label>Persona de contacto<input name="contact" placeholder="Nombre del contacto" defaultValue={initialCustomer?.contact}/></label>
    <label>Correo<input name="email" type="email" placeholder="correo@ejemplo.cl" defaultValue={initialCustomer?.email}/></label>
    <label>Teléfono<input name="phone" placeholder="+56 9..." defaultValue={initialCustomer?.phone}/></label>
    <label>Dirección<input name="address" placeholder="Comuna o dirección" defaultValue={initialCustomer?.address}/></label>
    <label className="checkbox-field quote-customer-checkbox"><input name="compraPorMercadoPublico" type="checkbox" defaultChecked={initialCustomer?.compraPorMercadoPublico}/> Compra por Mercado Público</label>
    <div className="quote-customer-form-actions"><button className="secondary" type="button" onClick={onCancel}>Cancelar</button><button className="primary" type="submit"><Icon name="check"/> {submitLabel}</button></div>
  </form>;
}

export function CoffeeBreakApp() {
  const pathname = usePathname();
  const router = useRouter();
  const route = appRoute(pathname);
  const view = route.view;
  const [mobileNav, setMobileNav] = useState(false);
  const [products, setProducts] = useState(seedProducts);
  const [customers, setCustomers] = useState(seedCustomers);
  const [quotes, setQuotes] = useState(seedQuotes);
  const [business, setBusiness] = useState(seedBusiness);
  const [storageReady, setStorageReady] = useState(false);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isCloudConfigured ? "guardando" : "guardado");
  const [syncError, setSyncError] = useState("");
  const [dataIssues, setDataIssues] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const cloudUserIdRef = useRef<string | null>(null);
  const latestStateRef = useRef<AppSnapshot>({ business: seedBusiness, products: seedProducts, customers: seedCustomers, quotes: seedQuotes });
  const persistedStateRef = useRef<AppSnapshot | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef(0);

  const persistSnapshot = useCallback((snapshot: AppSnapshot, reason: string) => {
    console.info("[sync] Guardado en cola", { reason, cloudUserReady: Boolean(cloudUserIdRef.current), products: snapshot.products.length, customers: snapshot.customers.length, quotes: snapshot.quotes.length });

    const operation = saveQueueRef.current.catch(() => undefined).then(async () => {
      pendingWritesRef.current += 1;
      setSyncStatus("guardando");
      setSyncError("");
      const supabase = getSupabase();
      if (supabase) {
        const userId = cloudUserIdRef.current;
        if (!userId) throw new Error("No hay un usuario autenticado disponible para sincronizar.");
        await persistCloudChanges(supabase, userId, persistedStateRef.current, snapshot);
      } else {
        saveLocalAppState(localStorage, snapshot);
      }
      if (supabase) saveLocalAppState(localStorage, snapshot);
      persistedStateRef.current = snapshot;
      console.info("[sync] Guardado completado", { reason, destination: supabase ? "supabase" : "local" });
    });

    const monitored = operation.then(() => {
      pendingWritesRef.current -= 1;
      if (pendingWritesRef.current === 0) setSyncStatus("guardado");
    }).catch((error: unknown) => {
      pendingWritesRef.current -= 1;
      console.error(`[sync] Falló el guardado (${reason})`, error);
      setSyncStatus("error");
      setSyncError("No pudimos guardar los últimos cambios. Revisa tu conexión e inténtalo nuevamente.");
      throw error;
    });
    saveQueueRef.current = monitored.catch(() => undefined);
    return monitored;
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (supabase) {
      let active = true;
      console.info("[sync] Iniciando carga desde Supabase");
      supabase.auth.getUser().then(async ({ data, error: authError }) => {
        if (!active) return;
        if (authError) {
          console.error("[sync] Falló getUser", authError);
          setSyncStatus("error"); setSyncError("No pudimos comprobar tu sesión. Tus datos no se modificarán."); setStorageReady(true);
          return;
        }
        if (!data.user) {
          const error = new Error("Supabase no devolvió un usuario autenticado.");
          console.error("[sync] Falló getUser", error);
          setSyncStatus("error"); setSyncError("No encontramos una sesión activa. Tus datos no se modificarán."); setStorageReady(true);
          return;
        }
        cloudUserIdRef.current = data.user.id;
        let loaded: Awaited<ReturnType<typeof loadCloudAppState>>;
        try { loaded = await loadCloudAppState(supabase, data.user.id); }
        catch (readError) {
          if (!active) return;
          console.error("[sync] Falló la lectura de las tablas relacionales", readError);
          if (!navigator.onLine) {
            const local = loadLocalAppState(localStorage);
            persistedStateRef.current = local.state; latestStateRef.current = local.state;
            setBusiness(local.state.business); setProducts(local.state.products); setCustomers(local.state.customers); setQuotes(local.state.quotes); setDataIssues(local.issues);
            setSyncStatus("error"); setSyncError("Estás sin conexión. Mostramos la última copia guardada en este dispositivo; los cambios no se guardarán hasta volver a conectarte."); setStorageReady(true);
            return;
          }
          setSyncStatus("error"); setSyncError("No pudimos cargar tus datos. No se guardará nada hasta recuperar la conexión."); setStorageReady(true);
          return;
        }
        if (!active) return;
        const stored = loaded.state;
        saveLocalAppState(localStorage, stored);
        persistedStateRef.current = loaded.stored ? stored : null;
        latestStateRef.current = stored;
        setBusiness(stored.business); setProducts(stored.products); setCustomers(stored.customers); setQuotes(stored.quotes);
        setCloudUserId(data.user.id); setPersistenceEnabled(true); setStorageReady(true); setSyncStatus("guardado");
        console.info("[sync] Carga completada", { rowFound: loaded.stored, cloudUserReady: true });
      }).catch((error: unknown) => {
        console.error("[sync] getUser rechazó la promesa", error);
        if (active) { setSyncStatus("error"); setSyncError("La conexión se interrumpió al abrir la aplicación. Tus datos no se modificarán."); setStorageReady(true); }
      });
      return () => { active = false; };
    }
    const frame = requestAnimationFrame(() => {
      const loaded = loadLocalAppState(localStorage);
      persistedStateRef.current = loaded.state;
      latestStateRef.current = loaded.state;
      setBusiness(loaded.state.business); setProducts(loaded.state.products); setCustomers(loaded.state.customers); setQuotes(loaded.state.quotes); setDataIssues(loaded.issues);
      setPersistenceEnabled(true); setStorageReady(true); setSyncStatus("guardado");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    latestStateRef.current = { business, products, customers, quotes };
  }, [quotes, customers, products, business]);

  useEffect(() => {
    console.info("[sync] Efecto de persistencia", { storageReady, persistenceEnabled, cloudUserReady: Boolean(cloudUserId) });
    if (!storageReady || !persistenceEnabled) return;
    const snapshot = { business, products, customers, quotes };
    void persistSnapshot(snapshot, "cambio de estado").catch(() => undefined);
  }, [quotes, customers, products, business, storageReady, persistenceEnabled, cloudUserId, persistSnapshot]);

  const navigate = (href: string) => { router.push(href); setMobileNav(false); };
  const startQuote = () => navigate("/cotizaciones/nueva");
  const updateQuote = (updated: Quote) => setQuotes((current) => current.map((quote) => quote.id === updated.id ? updated : quote));
  const deleteQuote = (deleted: Quote) => {
    setQuotes((current) => current.filter((quote) => quote.id !== deleted.id));
  };
  const saveQuote = async (quote: Quote) => {
    const current = latestStateRef.current;
    const nextQuotes = [quote, ...current.quotes.filter((stored) => stored.id !== quote.id)];
    const nextCustomers = current.customers.some((customer) => customer.id === quote.customer.id)
      ? current.customers
      : [...current.customers, quote.customer];
    const nextSnapshot = { ...current, customers: nextCustomers, quotes: nextQuotes };
    await persistSnapshot(nextSnapshot, `cotización ${quote.number}`);
    latestStateRef.current = nextSnapshot;
    setCustomers(nextCustomers); setQuotes(nextQuotes);
  };
  const prepareEmailRecipient = async (target: EmailTarget, email: string, customerId: string) => {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error("Ingresa un correo válido antes de enviar.");
    const current = latestStateRef.current;
    if (target === "owner") {
      if (current.business.defaultRecipient === normalized) return normalized;
      const nextBusiness = { ...current.business, defaultRecipient: normalized };
      const nextSnapshot = { ...current, business: nextBusiness };
      await persistSnapshot(nextSnapshot, "correo destinatario del negocio");
      latestStateRef.current = nextSnapshot; setBusiness(nextBusiness);
      return normalized;
    }
    const storedCustomer = current.customers.find((candidate) => candidate.id === customerId);
    if (!storedCustomer) throw new Error("No encontramos el cliente seleccionado.");
    if (storedCustomer.email === normalized) return normalized;
    const nextCustomers = current.customers.map((candidate) => candidate.id === customerId ? { ...candidate, email: normalized } : candidate);
    const nextQuotes = current.quotes.map((quote) => quote.customer.id === customerId ? { ...quote, customer: { ...quote.customer, email: normalized } } : quote);
    const nextSnapshot = { ...current, customers: nextCustomers, quotes: nextQuotes };
    await persistSnapshot(nextSnapshot, `correo de ${storedCustomer.name}`);
    latestStateRef.current = nextSnapshot; setCustomers(nextCustomers); setQuotes(nextQuotes);
    return normalized;
  };
  const wizardSource = route.quoteId ? quotes.find((quote) => quote.id === route.quoteId) || null : null;
  const wizardMode = route.wizardMode || "create";
  const titles: Record<View, string> = { home: "", quotes: route.quoteId ? "Detalle de cotización" : "Cotizaciones", products: "Productos", customers: "Clientes", settings: "Mi negocio", "new-quote": wizardMode === "edit" ? "Editar cotización" : wizardMode === "duplicate" ? "Duplicar cotización" : "Nueva cotización" };
  const syncLabel = !isCloudConfigured ? "Modo local" : syncStatus === "guardando" ? "Guardando cambios…" : syncStatus === "guardado" ? "Datos sincronizados" : "Error de sincronización";

  if (!storageReady) return <main className="auth-page"><div className="auth-card"><Image className="auth-logo-image" src="/la-ruka-logo.png" alt="Logo de La Ruka" width={92} height={92} priority/><h1>La Ruka</h1><p>Cargando tus cotizaciones guardadas…</p></div></main>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><Image className="sidebar-logo" src="/la-ruka-logo.png" alt="Logo de La Ruka" width={48} height={48} priority/><span><strong>La Ruka</strong><small>Food truck · Coffee break</small></span></div>
      <nav>
        <NavButton icon="home" label="Inicio" href="/" active={view === "home"} onNavigate={() => setMobileNav(false)}/>
        <NavButton icon="file" label="Cotizaciones" href="/cotizaciones" active={view === "quotes" || view === "new-quote"} onNavigate={() => setMobileNav(false)}/>
        <NavButton icon="box" label="Productos" href="/productos" active={view === "products"} onNavigate={() => setMobileNav(false)}/>
        <NavButton icon="users" label="Clientes" href="/clientes" active={view === "customers"} onNavigate={() => setMobileNav(false)}/>
      </nav>
      <div className="sidebar-bottom">
        <NavButton icon="settings" label="Mi negocio" href="/mi-negocio" active={view === "settings"} onNavigate={() => setMobileNav(false)}/>
        <div className="profile"><span>LR</span><div><strong>La Ruka</strong><small className={`sync-state sync-${syncStatus}`}>{syncLabel}</small>{isCloudConfigured && <button className="sign-out" onClick={() => getSupabase()?.auth.signOut()}>Cerrar sesión</button>}</div></div>
      </div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)}/>} 
    <main className="main">
      <header className={`topbar${view === "home" ? " home-topbar" : ""}`}>
        <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menú">☰</button>
        {view !== "home" && <div><h1>{titles[view]}</h1></div>}
        {view !== "home" && view !== "new-quote" && <Link className="primary compact" href="/cotizaciones/nueva"><Icon name="plus"/> Crear cotización</Link>}
      </header>
      <div className="content">
        {syncStatus === "error" && <div className="sync-notice sync-notice-error" role="alert"><div><strong>No se guardaron los últimos cambios</strong><span>{syncError}</span></div></div>}
        {successMessage && <div className="sync-notice sync-notice-success" role="status"><div><strong>Cambio guardado</strong><span>{successMessage}</span></div><button className="secondary" onClick={() => setSuccessMessage("")}>Cerrar</button></div>}
        {dataIssues.length > 0 && <div className="sync-notice sync-notice-warning" role="status"><div><strong>Recuperamos datos incompatibles</strong><span>{dataIssues.join(" ")}</span></div><button className="secondary" onClick={() => setDataIssues([])}>Entendido</button></div>}
        {view === "home" && <Dashboard quotes={quotes} onNew={startQuote} onQuotes={() => navigate("/cotizaciones")} onUpdate={updateQuote}/>}
        {view === "quotes" && <Quotes key={route.quoteId || "list"} business={business} quotes={quotes} selectedQuoteId={route.quoteId || null} onNew={startQuote} onBack={() => navigate("/cotizaciones")} onDuplicate={(quote) => navigate(`${quotePath(quote.id)}/duplicar`)} onEdit={(quote) => navigate(`${quotePath(quote.id)}/editar`)} onUpdate={updateQuote} onSave={saveQuote} onPrepareRecipient={prepareEmailRecipient} onDelete={deleteQuote}/>}
        {view === "products" && <Products products={products} setProducts={setProducts}/>} 
        {view === "customers" && <Customers customers={customers} setCustomers={setCustomers}/>} 
        {view === "settings" && <Settings business={business} onChange={setBusiness}/>} 
        {view === "new-quote" && <QuoteWizard
          key={`${wizardMode}-${route.quoteId || "new"}`}
          business={business}
          products={products}
          customers={customers}
          quotes={quotes}
          initialQuote={wizardSource}
          mode={wizardMode}
          onAddCustomer={(customer) => setCustomers((current) => [...current, customer])}
          onCancel={() => navigate(route.quoteId ? quotePath(route.quoteId) : "/cotizaciones")}
          onSave={saveQuote}
          onPrepareRecipient={prepareEmailRecipient}
          onDone={(quote) => { setSuccessMessage(wizardMode === "edit" ? `${quote.number} fue actualizada correctamente.` : `${quote.number} quedó guardada correctamente.`); navigate(quotePath(quote.id)); }}
        />}
      </div>
    </main>
  </div>;
}

function NavButton({ icon, label, href, active, onNavigate }: { icon: IconName; label: string; href: string; active: boolean; onNavigate: () => void }) {
  return <Link className={`nav-button ${active ? "active" : ""}`} href={href} aria-current={active ? "page" : undefined} onClick={onNavigate}><Icon name={icon}/><span>{label}</span></Link>;
}

function Dashboard({ quotes, onNew, onQuotes, onUpdate }: { quotes: Quote[]; onNew: () => void; onQuotes: () => void; onUpdate: (quote: Quote) => void }) {
  const acceptedQuotes = quotes.filter((quote) => quote.status === "Aceptada");
  const pendingQuotes = quotes.filter((quote) => quote.status === "Pendiente");
  const rejectedQuotes = quotes.filter((quote) => quote.status === "Rechazada");
  const acceptedTotal = acceptedQuotes.reduce((sum, quote) => sum + quoteTotals(quote.items).total, 0);
  const invoicedTotal = quotes.reduce((sum, quote) => sum + (quote.invoicedAmount || 0), 0);
  const followUps = pendingQuotes.filter((quote) => needsWeeklyFollowUp(quote));
  const followUpDone = (quote: Quote) => onUpdate({ ...quote, lastFollowUpAt: hoyLocal() });
  return <>
    <section className="hero-card">
      <div><h2>¿Creamos una cotización?</h2><p>Elige un cliente, agrega productos y nosotros hacemos el resto.</p><button className="primary hero-button" onClick={onNew}><Icon name="plus" size={23}/> Crear nueva cotización <Icon name="arrow"/></button></div>
      <div className="hero-art" aria-hidden="true"><span className="steam s1"/><span className="steam s2"/><div className="cup"><Icon name="coffee" size={76}/></div><span className="bean b1">●</span><span className="bean b2">●</span></div>
    </section>
    <section className="stats">
      <div className="stat-card"><span className="stat-icon green"><Icon name="check"/></span><div><small>Aceptadas</small><strong>{acceptedQuotes.length}</strong></div></div>
      <div className="stat-card"><span className="stat-icon orange"><Icon name="file"/></span><div><small>Pendientes</small><strong>{pendingQuotes.length}</strong></div></div>
      <div className="stat-card"><span className="stat-icon blue"><Icon name="file"/></span><div><small>Total cotizado · aceptadas</small><strong>{formatCLP(acceptedTotal)}</strong></div></div>
      <div className="stat-card"><span className="stat-icon green"><Icon name="check"/></span><div><small>Total facturado</small><strong>{formatCLP(invoicedTotal)}</strong></div></div>
    </section>
    <section className={`follow-up-panel ${followUps.length ? "due" : ""}`}>
      <div className="section-head"><div><h3>Seguimiento semanal</h3><p>{followUps.length ? `${followUps.length} cotización${followUps.length === 1 ? " necesita" : "es necesitan"} actualización` : "No hay seguimientos vencidos"} · {rejectedQuotes.length} rechazada{rejectedQuotes.length === 1 ? "" : "s"} fuera del total cotizado</p></div><button className="text-button" onClick={onQuotes}>Ver historial <Icon name="arrow" size={17}/></button></div>
      {followUps.length > 0 && <div className="follow-up-list">{followUps.map((quote) => <article className="follow-up-item" key={quote.id}><div><strong>{quote.number} · {quote.customer.name}</strong><span>{formatCLP(quoteTotals(quote.items).total)} · pendiente desde {formatDate(quote.statusUpdatedAt || quote.date)}</span></div><div className="follow-up-actions"><button className="secondary" onClick={() => onUpdate(withQuoteStatus(quote, "Aceptada"))}>Aceptar</button><button className="secondary" onClick={() => onUpdate(withQuoteStatus(quote, "Rechazada"))}>Rechazar</button><button className="primary" onClick={() => followUpDone(quote)}>Recordar en 7 días</button></div></article>)}</div>}
    </section>
    <section className="panel recent"><div className="section-head"><div><h3>Cotizaciones recientes</h3><p>Tus últimos trabajos, siempre a mano.</p></div><button className="text-button" onClick={onQuotes}>Ver todas <Icon name="arrow" size={17}/></button></div><QuoteTable quotes={quotes.slice(0, 4)}/></section>
  </>;
}

function QuoteEmailActions({ business, customer, busyTarget, disabled = false, onSend }: { business: BusinessSettings; customer: Customer; busyTarget: EmailTarget | null; disabled?: boolean; onSend: (target: EmailTarget, recipient: string) => void }) {
  const [ownerRecipient, setOwnerRecipient] = useState(business.defaultRecipient);
  const [customerRecipient, setCustomerRecipient] = useState(customer.email || "");
  const recommended: EmailTarget = customer.compraPorMercadoPublico ? "owner" : "customer";
  return <div className="email-options">
    <div className={`email-option ${recommended === "owner" ? "recommended" : ""}`}>
      <div className="email-option-head"><div><strong>Mercado Público</strong><span>Recibe el PDF para subirlo tú.</span></div>{recommended === "owner" && <small>Recomendado</small>}</div>
      <label>Correo del encargado<input aria-label="Destinatario de mi correo" type="email" value={ownerRecipient} onChange={(event) => setOwnerRecipient(event.target.value)}/></label>
      <button className="secondary full" type="button" disabled={disabled || Boolean(busyTarget) || !normalizeEmail(ownerRecipient)} onClick={() => onSend("owner", ownerRecipient)}><Icon name="mail"/> {busyTarget === "owner" ? "Enviando…" : "Enviar a mi correo"}</button>
    </div>
    <div className={`email-option ${recommended === "customer" ? "recommended" : ""}`}>
      <div className="email-option-head"><div><strong>Envío directo</strong><span>Llega al contacto guardado.</span></div>{recommended === "customer" && <small>Recomendado</small>}</div>
      <label>Correo del cliente<input aria-label="Correo del cliente para envío" type="email" value={customerRecipient} onChange={(event) => setCustomerRecipient(event.target.value)}/></label>
      <button className="primary full" type="button" disabled={disabled || Boolean(busyTarget) || !normalizeEmail(customerRecipient)} onClick={() => onSend("customer", customerRecipient)}><Icon name="mail"/> {busyTarget === "customer" ? "Enviando…" : "Enviar al cliente"}</button>
    </div>
  </div>;
}

function QuoteMobileCard({ quote }: { quote: Quote }) {
  const total = quoteTotals(quote.items).total;
  const content = <>
    <span className="quote-mobile-head"><strong>{quote.number}</strong><Icon name="chevron"/></span>
    <span className="quote-mobile-customer">{quote.customer.name}</span>
    <span className="quote-mobile-meta"><span><small>Fecha</small>{formatDate(quote.date)}</span><span><small>Total</small><strong>{formatCLP(total)}</strong></span><span><small>Margen</small><MarginIndicator items={quote.items}/></span></span>
    <span className="quote-mobile-statuses"><DeliveryBadge status={quote.deliveryStatus}/><Badge status={quote.status}/>{quote.invoicedAmount ? <span className="billing-badge">Facturada · {formatCLP(quote.invoicedAmount)}</span> : <span className="billing-pending">Sin facturar</span>}</span>
  </>;
  return <Link className="quote-mobile-card interactive" href={quotePath(quote.id)} aria-label={`Abrir ${quote.number} de ${quote.customer.name}, total ${formatCLP(total)}, ${deliveryLabels[quote.deliveryStatus]}, respuesta ${quote.status}`}>{content}</Link>;
}

function QuoteTable({ quotes }: { quotes: Quote[] }) {
  return <><div className="table-wrap quote-table-desktop"><table><thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Margen</th><th>Envío</th><th>Respuesta</th><th>Facturación</th><th aria-label="Acciones"/></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id}><td><strong>{quote.number}</strong></td><td>{quote.customer.name}</td><td>{formatDate(quote.date)}</td><td><strong>{formatCLP(quoteTotals(quote.items).total)}</strong></td><td><MarginIndicator items={quote.items}/></td><td><DeliveryBadge status={quote.deliveryStatus}/></td><td><Badge status={quote.status}/></td><td>{quote.invoicedAmount ? <span className="billing-badge">Facturada · {formatCLP(quote.invoicedAmount)}</span> : <span className="billing-pending">Pendiente</span>}</td><td><Link className="icon-button" href={quotePath(quote.id)} aria-label={`Abrir ${quote.number}`}><Icon name="chevron"/></Link></td></tr>)}</tbody></table></div><div className="quote-mobile-list">{quotes.map((quote) => <QuoteMobileCard quote={quote} key={quote.id}/>)}</div></>;
}

function Quotes({ business, quotes, selectedQuoteId, onNew, onBack, onDuplicate, onEdit, onUpdate, onSave, onPrepareRecipient, onDelete }: { business: BusinessSettings; quotes: Quote[]; selectedQuoteId: string | null; onNew: () => void; onBack: () => void; onDuplicate: (quote: Quote) => void; onEdit: (quote: Quote) => void; onUpdate: (quote: Quote) => void; onSave: (quote: Quote) => Promise<void>; onPrepareRecipient: (target: EmailTarget, email: string, customerId: string) => Promise<string>; onDelete: (quote: Quote) => void }) {
  const [search, setSearch] = useState(""); const [billing, setBilling] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailBusyTarget, setDetailBusyTarget] = useState<EmailTarget | null>(null); const [detailMessage, setDetailMessage] = useState(""); const [detailError, setDetailError] = useState(""); const [deliverySaving, setDeliverySaving] = useState(false); const [invoiceSaving, setInvoiceSaving] = useState(false); const [detailFileAction, setDetailFileAction] = useState<"download" | "share" | null>(null);
  const selected = selectedQuoteId ? quotes.find((quote) => quote.id === selectedQuoteId) || null : null;
  const filtered = quotes.filter((q) => `${q.number} ${q.customer.name}`.toLowerCase().includes(search.toLowerCase()));
  const sendFromDetail = async (target: EmailTarget, email: string) => {
    if (!selected) return;
    setDetailBusyTarget(target); setDetailError(""); setDetailMessage("");
    try {
      const recipient = await onPrepareRecipient(target, email, selected.customer.id);
      const preparedQuote = target === "customer" ? { ...selected, customer: { ...selected.customer, email: recipient } } : selected;
      await onSave(preparedQuote);
      await sendQuoteEmail(preparedQuote, business, recipient);
      const sentAt = new Date().toISOString();
      const updated: Quote = target === "customer"
        ? { ...preparedQuote, deliveryStatus: "enviada_cliente", deliveryUpdatedAt: sentAt }
        : { ...preparedQuote, deliveryStatus: "enviada_encargado", deliveryUpdatedAt: sentAt, ownerCopySentAt: sentAt };
      await onSave(updated);
      setDetailMessage(target === "customer" ? "Cotización enviada al cliente y registrada." : "PDF enviado a tu correo. Confirma la subida cuando la completes en Mercado Público.");
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible enviar el correo.");
    } finally { setDetailBusyTarget(null); }
  };
  const saveMarketplaceDelivery = async (data: FormData) => {
    if (!selected) return;
    setDeliverySaving(true); setDetailError(""); setDetailMessage("");
    const updated: Quote = { ...selected, deliveryStatus: "subida_mercado_publico", deliveryUpdatedAt: new Date().toISOString(), idAdquisicion: String(data.get("idAdquisicion") || "").trim() || undefined };
    try { await onSave(updated); setDetailMessage("Subida a Mercado Público registrada."); }
    catch (error) { setDetailError(error instanceof Error ? error.message : "No fue posible registrar la subida."); }
    finally { setDeliverySaving(false); }
  };
  const saveFileDelivery = async (action: "download" | "share") => {
    if (!selected) return;
    setDetailFileAction(action); setDetailError(""); setDetailMessage("");
    const updated: Quote = { ...selected, deliveryStatus: action === "download" ? "descargada" : "compartida", deliveryUpdatedAt: new Date().toISOString() };
    let statusSaved = false;
    try {
      await onSave(updated); statusSaved = true;
      if (action === "download") await downloadQuotePdf(updated, business);
      else await shareQuotePdf(updated, business);
      setDetailMessage(action === "download" ? "PDF descargado y estado actualizado." : "Cotización compartida y estado actualizado.");
    } catch (error) {
      if (statusSaved) { try { await onSave(selected); } catch { /* El aviso global de sincronización mostrará el error. */ } }
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDetailError(error instanceof Error ? error.message : "No fue posible completar la acción.");
    } finally { setDetailFileAction(null); }
  };
  if (selected) {
    const totals = quoteTotals(selected.items);
    const delivered = selected.deliveryStatus !== "borrador";
    const answered = selected.status !== "Pendiente";
    const invoiced = Boolean(selected.invoicedAmount);
    const currentStep = !delivered ? 1 : !answered ? 2 : selected.status === "Aceptada" && !invoiced ? 3 : 0;
    const progressClass = (step: number, complete: boolean) => `quote-progress-step${complete ? " complete" : currentStep === step ? " active" : ""}`;
    const setStatus = (status: QuoteStatus) => { const updated = withQuoteStatus(selected, status); onUpdate(updated); setDetailError(""); setDetailMessage(`Estado actualizado a ${status}.`); };
    const saveInvoice = async (data: FormData) => {
      const invoice = normalizeInvoiceInput(data.get("invoiceNumber"), data.get("invoicedAt"), data.get("invoicedAmount"));
      setDetailError(""); setDetailMessage("");
      if (!invoice) { setDetailError("Ingresa una fecha y un monto facturado mayor a cero, sin decimales."); return; }
      setInvoiceSaving(true);
      const updated = withQuoteStatus({ ...selected, ...invoice }, "Aceptada");
      try { await onSave(updated); setBilling(false); setDetailMessage("Factura registrada correctamente."); }
      catch (error) { setDetailError(error instanceof Error ? error.message : "No fue posible registrar la factura."); }
      finally { setInvoiceSaving(false); }
    };
    return <section className="panel quote-detail">
      <button className="back-link" onClick={onBack}>← Volver al historial</button>
      <header className="quote-detail-hero">
        <div>
          <span className="quote-detail-eyebrow">Cotización</span>
          <h2>{selected.number}</h2>
          <p>{formatDate(selected.date)} · {selected.customer.name}</p>
        </div>
        <div className="quote-detail-total">
          <small>Total cotizado</small>
          <strong>{formatCLP(totals.total)}</strong>
          <span>{selected.items.length} {selected.items.length === 1 ? "ítem" : "ítems"}</span>
        </div>
      </header>

      <ol className="quote-progress" aria-label="Progreso de la cotización">
        <li className={progressClass(1, delivered)}>
          <span className="quote-progress-number">{delivered ? <Icon name="check" size={17}/> : "1"}</span>
          <span><small>Entrega</small><strong>{deliveryLabels[selected.deliveryStatus]}</strong></span>
        </li>
        <li className={progressClass(2, answered)}>
          <span className="quote-progress-number">{answered ? <Icon name="check" size={17}/> : "2"}</span>
          <span><small>Respuesta</small><strong>{selected.status}</strong></span>
        </li>
        <li className={progressClass(3, invoiced)}>
          <span className="quote-progress-number">{invoiced ? <Icon name="check" size={17}/> : "3"}</span>
          <span><small>Facturación</small><strong>{invoiced ? "Registrada" : selected.status === "Rechazada" ? "No corresponde" : "Pendiente"}</strong></span>
        </li>
      </ol>

      {detailError && <div className="send-error detail-feedback" role="alert">{detailError}</div>}
      {detailMessage && <div className="send-success detail-feedback" role="status">{detailMessage}</div>}

      <div className="quote-detail-workspace">
        <div className="quote-detail-flow">
          <section className={`quote-flow-card${currentStep === 1 ? " current" : ""}`} aria-labelledby="delivery-step-title">
            <div className="quote-flow-head">
              <span className="quote-flow-number">1</span>
              <div><h3 id="delivery-step-title">Entregar la cotización</h3><p>Envía el PDF, compártelo o registra su subida a Mercado Público.</p></div>
              <DeliveryBadge status={selected.deliveryStatus}/>
            </div>
            <div className="quote-flow-body">
              <div className="delivery-state-row">
                <span>{deliveryDescription(selected)}</span>
                {selected.idAdquisicion && <span>ID de adquisición: <strong>{selected.idAdquisicion}</strong></span>}
                {selected.ownerCopySentAt && <span>Copia enviada a tu correo el {deliveryDate(selected.ownerCopySentAt)}.</span>}
              </div>
              <div className="delivery-file-actions">
                <button className="secondary" disabled={Boolean(detailFileAction)} onClick={() => void saveFileDelivery("download")}><Icon name="download"/> {detailFileAction === "download" ? "Descargando…" : "Descargar PDF"}</button>
                <button className="secondary" disabled={Boolean(detailFileAction)} onClick={() => void saveFileDelivery("share")}><Icon name="share"/> {detailFileAction === "share" ? "Compartiendo…" : "Compartir por WhatsApp"}</button>
              </div>
              <QuoteEmailActions key={selected.id} business={business} customer={selected.customer} busyTarget={detailBusyTarget} onSend={(target, recipient) => void sendFromDetail(target, recipient)}/>
              {(selected.customer.compraPorMercadoPublico || selected.deliveryStatus === "subida_mercado_publico") && <form className="marketplace-form flow-marketplace" action={saveMarketplaceDelivery}>
                <label>ID de Mercado Público (opcional)<input name="idAdquisicion" defaultValue={selected.idAdquisicion}/></label>
                <button className="secondary" disabled={deliverySaving}>{deliverySaving ? "Guardando…" : "Confirmar subida a Mercado Público"}</button>
              </form>}
            </div>
          </section>

          <section className={`quote-flow-card${currentStep === 2 ? " current" : ""}`} aria-labelledby="response-step-title">
            <div className="quote-flow-head">
              <span className="quote-flow-number">2</span>
              <div><h3 id="response-step-title">Registrar la respuesta</h3><p>Actualiza la situación cuando el cliente o Mercado Público responda.</p></div>
              <Badge status={selected.status}/>
            </div>
            <div className="status-choice" role="group" aria-label="Situación de la cotización">
              <button className={selected.status === "Pendiente" ? "primary" : "secondary"} onClick={() => setStatus("Pendiente")}>Pendiente</button>
              <button className={selected.status === "Aceptada" ? "primary" : "secondary"} onClick={() => setStatus("Aceptada")}>Aceptada</button>
              <button className={selected.status === "Rechazada" ? "danger-button" : "secondary"} onClick={() => setStatus("Rechazada")}>Rechazada</button>
            </div>
          </section>

          <section className={`quote-flow-card${currentStep === 3 ? " current" : ""}`} aria-labelledby="invoice-step-title">
            <div className="quote-flow-head">
              <span className="quote-flow-number">3</span>
              <div><h3 id="invoice-step-title">Registrar la facturación</h3><p>Guarda el monto completo o una facturación parcial.</p></div>
              {selected.status !== "Rechazada" && <button className={invoiced ? "secondary" : "primary"} onClick={() => setBilling(!billing)}><Icon name="file"/> {invoiced ? "Editar factura" : "Registrar factura"}</button>}
            </div>
            <div className="quote-flow-body invoice-flow-body">
              {invoiced ? <div className="invoice-summary"><span className="stat-icon green"><Icon name="check"/></span><div><small>FACTURADA {selected.invoicedAt ? `EL ${formatDate(selected.invoicedAt)}` : ""}</small><strong>{formatCLP(selected.invoicedAmount || 0)}</strong><span>{selected.invoiceNumber || "Sin número de factura"}</span></div></div> : <div className="invoice-pending-note">{selected.status === "Rechazada" ? "Esta cotización fue rechazada y no corresponde facturarla. Si la situación cambia, márcala como aceptada." : "Todavía no se ha registrado una factura para esta cotización."}</div>}
              {billing && selected.status !== "Rechazada" && <form className="invoice-form" action={saveInvoice}><div><h3>Datos de la factura</h3><p>El número puede quedar pendiente.</p></div><label>Número de factura (opcional)<input name="invoiceNumber" defaultValue={selected.invoiceNumber}/></label><label>Fecha<input name="invoicedAt" type="date" required defaultValue={selected.invoicedAt || hoyLocal()}/></label><label>Monto facturado<input name="invoicedAmount" type="number" inputMode="numeric" min="1" step="1" required defaultValue={selected.invoicedAmount || totals.total}/></label><button className="primary" type="submit" disabled={invoiceSaving}>{invoiceSaving ? "Guardando…" : "Guardar factura"}</button></form>}
            </div>
          </section>

          <section className="quote-content-card" aria-labelledby="quote-content-title">
            <div className="quote-content-head"><div><h3 id="quote-content-title">Productos y totales</h3><p>Detalle incluido en la cotización.</p></div><span>{selected.items.length} {selected.items.length === 1 ? "ítem" : "ítems"}</span></div>
            <table className="doc-table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{selected.items.map((item) => <tr key={item.productId}><td>{item.name}</td><td>{item.quantity}</td><td>{formatCLP(item.unitPrice)}</td><td>{formatCLP(lineSubtotal(item))}</td></tr>)}</tbody></table>
            <div className="detail-totals"><span>Neto <b>{formatCLP(totals.net)}</b></span><span>IVA 19% <b>{formatCLP(totals.tax)}</b></span><span>Total <b>{formatCLP(totals.total)}</b></span></div>
            {selected.notes && <div className="detail-notes"><small>OBSERVACIONES</small><p>{selected.notes}</p></div>}
          </section>
        </div>

        <aside className="quote-detail-sidebar" aria-label="Cliente y acciones de la cotización">
          <section className="detail-side-card customer-side-card">
            <small>CLIENTE</small>
            <strong>{selected.customer.name}</strong>
            {selected.customer.rut && <span>{selected.customer.rut}</span>}
            {selected.customer.contact && <span>{selected.customer.contact}</span>}
            {selected.customer.email && <span>{selected.customer.email}</span>}
            {selected.customer.phone && <span>{selected.customer.phone}</span>}
          </section>
          <section className="detail-side-card profitability-card">
            <h3>Rentabilidad de la cotización</h3>
            <ProfitabilitySummary items={selected.items} className="detail-profitability"/>
          </section>
          <section className="detail-side-card">
            <h3>Otras acciones</h3>
            <button className="secondary full" onClick={() => onEdit(selected)}><Icon name="edit"/> Editar cotización</button>
            <button className="secondary full" onClick={() => onDuplicate(selected)}><Icon name="plus"/> Duplicar cotización</button>
            <button className="danger-text full" onClick={() => setConfirmDelete(true)}><Icon name="trash"/> Borrar cotización</button>
          </section>
        </aside>
      </div>
      {confirmDelete && <div className="modal-scrim" role="presentation" onMouseDown={() => setConfirmDelete(false)}><div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(event) => event.stopPropagation()}><span className="delete-icon"><Icon name="trash" size={27}/></span><h3 id="delete-title">¿Borrar esta cotización?</h3><p>Se eliminará <strong>{selected.number}</strong> de {selected.customer.name}. Esta acción no se puede deshacer.</p><div className="confirm-actions"><button className="secondary" onClick={() => setConfirmDelete(false)}>No, mantenerla</button><button className="danger-button" onClick={() => { onDelete(selected); setConfirmDelete(false); onBack(); }}>Sí, borrar cotización</button></div></div></div>}
    </section>;
  }
  if (selectedQuoteId) return <section className="panel"><button className="back-link" onClick={onBack}>← Volver al historial</button><div className="empty"><strong>No encontramos esta cotización.</strong><p>Puede haber sido eliminada o el enlace ya no es válido.</p></div></section>;
  const hasSearch = Boolean(search.trim());
  return <section className="panel"><div className="section-head responsive"><div><h2>Historial de cotizaciones</h2><p>{savedQuotesLabel(quotes.length)}</p></div><button className="primary" onClick={onNew}><Icon name="plus"/> Nueva cotización</button></div><Search value={search} onChange={setSearch} placeholder="Buscar por número o cliente..."/>{filtered.length > 0 && <QuoteTable quotes={filtered}/>} {filtered.length === 0 && (quotes.length === 0 && !hasSearch ? <div className="empty first-quote-empty"><h3>Aún no hay cotizaciones</h3><p>Crea la primera para comenzar el historial de La Ruka.</p><button className="primary" onClick={onNew}><Icon name="plus"/> Crear primera cotización</button></div> : <div className="empty">No encontramos cotizaciones con esa búsqueda.</div>)}</section>;
}

function Products({ products, setProducts }: { products: Product[]; setProducts: (products: Product[]) => void }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const filtered = products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  const categoryOrder = ["Bebestibles", "Dulces", "Salados"];
  const categories = [...new Set(products.map((product) => product.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const groupedCategories = [...new Set(filtered.map((product) => product.category))].sort((a, b) => {
    const positionA = categoryOrder.indexOf(a); const positionB = categoryOrder.indexOf(b);
    if (positionA === -1 && positionB === -1) return a.localeCompare(b, "es");
    if (positionA === -1) return 1; if (positionB === -1) return -1;
    return positionA - positionB;
  });
  const saveProduct = (data: FormData) => {
    const name = String(data.get("name") || "").trim(); const category = String(data.get("category") || "").trim(); if (!name || !category) return;
    const rawCost = String(data.get("cost") || "").trim();
    const product: Product = { id: editing?.id || crypto.randomUUID(), name, category, unit: String(data.get("unit") || "unidad").trim() || "unidad", price: Math.max(0, Math.trunc(Number(data.get("price")) || 0)), cost: rawCost === "" ? undefined : Math.max(0, Math.trunc(Number(rawCost) || 0)), active: editing?.active ?? true };
    setProducts(editing ? products.map((current) => current.id === editing.id ? product : current) : [...products, product]); setAdding(false); setEditing(null);
  };
  return <section className="panel"><div className="section-head responsive"><div><h2>Catálogo de productos</h2><p>{products.filter((p) => p.active).length} productos disponibles</p></div><button className="primary" onClick={() => { setEditing(null); setAdding(!adding); }}><Icon name="plus"/> Nuevo producto</button></div>
    {adding && <form className="inline-form" key={editing?.id || "new"} action={saveProduct}><label>Nombre<input name="name" required placeholder="Ej: Mini sándwich" defaultValue={editing?.name}/></label><label>Categoría<input name="category" list="product-categories" required placeholder="Elige o escribe una nueva" defaultValue={editing?.category}/><datalist id="product-categories">{categories.map((category) => <option value={category} key={category}/>)}</datalist></label><label>Unidad<input name="unit" defaultValue={editing?.unit || "unidad"}/></label><label>Precio neto<input name="price" type="number" inputMode="numeric" min="0" step="1" required defaultValue={editing?.price}/></label><label>Costo unitario <small className="field-help">Recomendado para calcular el margen; puede quedar vacío.</small><input name="cost" type="number" inputMode="numeric" min="0" step="1" defaultValue={editing?.cost}/></label><button className="primary" type="submit">{editing ? "Actualizar" : "Guardar"}</button></form>}
    <Search value={search} onChange={setSearch} placeholder="Buscar producto o categoría..."/>
    <div className="catalog-groups">{groupedCategories.map((categoryName) => { const categoryProducts = filtered.filter((product) => product.category === categoryName); return <section className="catalog-section" key={categoryName}><div className="catalog-section-head"><h3>{categoryName}</h3><span>{categoryProducts.length} producto{categoryProducts.length === 1 ? "" : "s"}</span></div><div className="product-grid">{categoryProducts.map((product) => <article className={`product-card ${!product.active ? "inactive" : ""}`} key={product.id}><div className="product-top"><span className="product-symbol"><Icon name="coffee"/></span><span className="category">{product.category}</span></div><h3>{product.name}</h3><p>{formatCLP(product.price)} <small>/ {product.unit}</small></p><small className={`product-cost${product.cost == null ? " missing" : ""}`}>{product.cost == null ? "Sin costo referencial · margen no disponible" : `Costo referencial: ${formatCLP(product.cost)}`}</small><div className="product-actions"><span className={product.active ? "active-label" : "inactive-label"}>{product.active ? "Activo" : "Inactivo"}</span><span className="card-action-group"><button className="text-button" onClick={() => { setEditing(product); setAdding(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button><button className="text-button" onClick={() => setProducts(products.map((p) => p.id === product.id ? { ...p, active: !p.active } : p))}>{product.active ? "Desactivar" : "Activar"}</button></span></div></article>)}</div></section>; })}</div>
    {filtered.length === 0 && <div className="empty">No encontramos productos con esa búsqueda.</div>}
  </section>;
}

function Customers({ customers, setCustomers }: { customers: Customer[]; setCustomers: (customers: Customer[]) => void }) {
  const [search, setSearch] = useState(""); const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<Customer | null>(null);
  const filtered = customers.filter((c) => `${c.name} ${c.rut} ${c.contact}`.toLowerCase().includes(search.toLowerCase()));
  const saveCustomer = (customer: Customer) => {
    setCustomers(editing ? customers.map((current) => current.id === editing.id ? customer : current) : [...customers, customer]); setAdding(false); setEditing(null);
  };
  return <section className="panel"><div className="section-head responsive"><div><h2>Clientes</h2><p>{customers.length} clientes guardados</p></div><button className="primary" onClick={() => { setEditing(null); setAdding(!adding); }}><Icon name="plus"/> Nuevo cliente</button></div>
    {adding && <CustomerForm key={editing?.id || "new"} initialCustomer={editing} autoFocusName={!editing} onSave={saveCustomer} onCancel={() => { setAdding(false); setEditing(null); }} submitLabel={editing ? "Actualizar cliente" : "Guardar cliente"}/>}
    <Search value={search} onChange={setSearch} placeholder="Buscar por nombre, RUT o contacto..."/><div className="customer-list">{filtered.map((customer) => <article className="customer-card" key={customer.id}><span className="avatar">{customerInitials(customer.name)}</span><div className="customer-main"><h3>{customer.name}</h3><p>{customer.rut || "Sin RUT"}</p><small className="customer-channel">{customer.compraPorMercadoPublico ? "Mercado Público" : "Envío directo"}</small></div><div className="customer-contact"><span>{customer.contact || "Sin contacto"}</span><small>{customer.email || "Sin correo"}</small></div><button className="icon-button" aria-label={`Editar ${customer.name}`} onClick={() => { setEditing(customer); setAdding(true); }}><Icon name="edit"/></button></article>)}</div>
  </section>;
}

function Settings({ business, onChange }: { business: BusinessSettings; onChange: (business: BusinessSettings) => void }) {
  const [saved, setSaved] = useState(false);
  const saveBusiness = (data: FormData) => {
    const rut = normalizarRutOpcional(String(data.get("rut") || ""));
    if (rut == null) return;
    onChange({ ...business, name: String(data.get("name") || "La Ruka"), legalName: String(data.get("legalName") || ""), rut, phone: String(data.get("phone") || ""), email: String(data.get("email") || ""), address: String(data.get("address") || ""), defaultRecipient: String(data.get("defaultRecipient") || "") });
    setSaved(true); window.setTimeout(() => setSaved(false), 2500);
  };
  const loadLogo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2_000_000) { window.alert("Elige una imagen PNG o JPG de menos de 2 MB."); return; }
    const reader = new FileReader(); reader.onload = () => onChange({ ...business, logoDataUrl: String(reader.result) }); reader.readAsDataURL(file);
  };
  return <section className="panel narrow"><div className="section-head"><div><h2>Datos del negocio</h2><p>Esta información y el logo aparecerán en todas tus cotizaciones.</p></div></div><form className="settings-form" action={saveBusiness} onSubmit={validateRutForm}><div className="logo-box">{business.logoDataUrl ? <Image className="business-logo" src={business.logoDataUrl} alt="Logo de La Ruka" width={72} height={72} unoptimized/> : <span className="brand-mark large"><Icon name="coffee" size={32}/></span>}<div><strong>Logo de La Ruka</strong><p>PNG o JPG, máximo 2 MB</p></div><label className="secondary upload-label">{business.logoDataUrl ? "Cambiar logo" : "Cargar logo"}<input type="file" accept="image/png,image/jpeg" onChange={(event) => loadLogo(event.target.files?.[0])}/></label></div><div className="form-grid"><label>Nombre comercial<input name="name" defaultValue={business.name}/></label><label>Razón social<input name="legalName" defaultValue={business.legalName} placeholder="Completar razón social"/></label><label>RUT<RutInput defaultValue={business.rut}/></label><label>Teléfono<input name="phone" defaultValue={business.phone}/></label><label>Correo<input name="email" defaultValue={business.email} type="email"/></label><label>IVA<input defaultValue="19%" disabled/></label><label className="wide">Dirección<input name="address" defaultValue={business.address}/></label><label className="wide">Correo del encargado de Mercado Público<input name="defaultRecipient" defaultValue={business.defaultRecipient} type="email"/></label></div><div className="form-footer"><span>{saved ? "✓ Datos guardados correctamente" : "El logo se incluirá automáticamente en el PDF."}</span><button className="primary" type="submit">Guardar cambios</button></div></form></section>;
}

function QuoteWizard({ business, products, customers, quotes, initialQuote, mode, onAddCustomer, onCancel, onSave, onPrepareRecipient, onDone }: { business: BusinessSettings; products: Product[]; customers: Customer[]; quotes: Quote[]; initialQuote: Quote | null; mode: QuoteWizardMode; onAddCustomer: (customer: Customer) => void; onCancel: () => void; onSave: (quote: Quote) => Promise<void>; onPrepareRecipient: (target: EmailTarget, email: string, customerId: string) => Promise<string>; onDone: (quote: Quote) => void }) {
  const [step, setStep] = useState(1); const [customerId, setCustomerId] = useState(initialQuote?.customer.id || ""); const [creatingCustomer, setCreatingCustomer] = useState(false); const [items, setItems] = useState<QuoteItem[]>(initialQuote?.items || []); const [search, setSearch] = useState(""); const [notes, setNotes] = useState(initialQuote?.notes || DEFAULT_QUOTE_NOTES); const [sentTarget, setSentTarget] = useState<EmailTarget | null>(null);
  const [sending, setSending] = useState(false); const [sendingTarget, setSendingTarget] = useState<EmailTarget | null>(null); const [sendError, setSendError] = useState(""); const [sentWarning, setSentWarning] = useState(""); const [fileDeliveryAction, setFileDeliveryAction] = useState<"download" | "share" | null>(null); const [completedQuote, setCompletedQuote] = useState<Quote | null>(null);
  const [quoteId, setQuoteId] = useState(() => mode === "edit" && initialQuote ? initialQuote.id : crypto.randomUUID());
  const [quoteNumber, setQuoteNumber] = useState(() => mode === "edit" && initialQuote ? initialQuote.number : nextQuoteNumber(quotes));
  const [draftReady, setDraftReady] = useState(mode !== "create");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftCustomer, setDraftCustomer] = useState<Customer | undefined>();
  const [addFeedback, setAddFeedback] = useState<{ productId: string; sequence: number } | null>(null);
  const draftLoadedRef = useRef(false);
  const addFeedbackTimerRef = useRef<number | null>(null);
  const customer = customers.find((candidate) => candidate.id === customerId)
    || (draftCustomer?.id === customerId ? draftCustomer : undefined)
    || (initialQuote?.customer.id === customerId ? initialQuote.customer : undefined); const totals = quoteTotals(items);
  const customersWithInitial = initialQuote && !customers.some((candidate) => candidate.id === initialQuote.customer.id) ? [initialQuote.customer, ...customers] : customers;
  const availableCustomers = draftCustomer && !customersWithInitial.some((candidate) => candidate.id === draftCustomer.id) ? [draftCustomer, ...customersWithInitial] : customersWithInitial;
  const visibleProducts = products.filter((p) => p.active && `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    if (mode !== "create" || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    const frame = requestAnimationFrame(() => {
      const draft = loadNewQuoteDraft(localStorage);
      if (draft) {
        setStep(draft.step); setCustomerId(draft.customerId); setDraftCustomer(draft.customer); setItems(draft.items); setNotes(draft.notes || DEFAULT_QUOTE_NOTES); setQuoteId(draft.quoteId); setQuoteNumber(draft.quoteNumber); setDraftRestored(true);
      }
      setDraftReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);
  useEffect(() => {
    if (mode !== "create" || !draftReady) return;
    const hasProgress = Boolean(customerId || items.length || step > 1 || notes !== DEFAULT_QUOTE_NOTES);
    if (!hasProgress) { clearNewQuoteDraft(localStorage); return; }
    saveNewQuoteDraft(localStorage, { quoteId, quoteNumber, customerId, customer, items, notes, step: step === 2 || step === 3 ? step : 1 });
  }, [customer, customerId, draftReady, items, mode, notes, quoteId, quoteNumber, step]);
  useEffect(() => () => {
    if (addFeedbackTimerRef.current !== null) window.clearTimeout(addFeedbackTimerRef.current);
  }, []);
  const addItem = (product: Product) => {
    setItems((current) => { const found = current.find((item) => item.productId === product.id); return found ? current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { productId: product.id, name: product.name, unit: product.unit, quantity: 1, unitPrice: product.price, unitCost: product.cost }]; });
    setAddFeedback((current) => ({ productId: product.id, sequence: (current?.sequence || 0) + 1 }));
    if (addFeedbackTimerRef.current !== null) window.clearTimeout(addFeedbackTimerRef.current);
    addFeedbackTimerRef.current = window.setTimeout(() => setAddFeedback(null), 850);
  };
  const updateItem = (id: string, field: "quantity" | "unitPrice", value: number) => setItems((current) => current.map((item) => item.productId === id ? { ...item, [field]: field === "quantity" ? Math.max(1, Math.trunc(value || 1)) : Math.max(0, Math.trunc(value || 0)) } : item));
  const createCustomer = (newCustomer: Customer) => {
    onAddCustomer(newCustomer); setDraftCustomer(newCustomer); setCustomerId(newCustomer.id); setCreatingCustomer(false);
  };
  const discardDraft = () => {
    if (!window.confirm("¿Descartar esta cotización en curso? Los datos que todavía no guardaste se perderán.")) return;
    clearNewQuoteDraft(localStorage); setStep(1); setCustomerId(""); setDraftCustomer(undefined); setItems([]); setNotes(DEFAULT_QUOTE_NOTES); setQuoteId(crypto.randomUUID()); setQuoteNumber(nextQuoteNumber(quotes)); setDraftRestored(false);
  };
  const buildQuote = (customerOverride?: Customer): Quote | null => {
    const today = hoyLocal(); const selectedCustomer = customerOverride || customer;
    if (!selectedCustomer) return null;
    if (mode === "edit" && initialQuote) return { ...initialQuote, customer: selectedCustomer, items, notes };
    return { id: quoteId, number: quoteNumber, date: today, customer: selectedCustomer, items, notes, status: "Pendiente", statusUpdatedAt: today, deliveryStatus: "borrador" };
  };
  const finish = async () => {
    const quote = buildQuote(); if (!quote) return;
    setSending(true); setSendError("");
    try { await onSave(quote); if (mode === "create") clearNewQuoteDraft(localStorage); onDone(quote); }
    catch (error) { setSendError(error instanceof Error ? error.message : "No fue posible guardar la cotización."); }
    finally { setSending(false); }
  };
  const downloadPdfOnly = async () => { const quote = completedQuote || buildQuote(); if (quote) await downloadQuotePdf(quote, business); };
  const completeWithFileDelivery = async (action: "download" | "share") => {
    const quote = buildQuote(); if (!quote) return;
    const updated: Quote = { ...quote, deliveryStatus: action === "download" ? "descargada" : "compartida", deliveryUpdatedAt: new Date().toISOString() };
    setSending(true); setFileDeliveryAction(action); setSendError("");
    let statusSaved = false;
    try {
      await onSave(updated); statusSaved = true;
      if (mode === "create") clearNewQuoteDraft(localStorage);
      if (action === "download") await downloadQuotePdf(updated, business);
      else await shareQuotePdf(updated, business);
      onDone(updated);
    } catch (error) {
      if (statusSaved) { try { await onSave(quote); } catch { /* El aviso global de sincronización mostrará el error. */ } }
      if (error instanceof DOMException && error.name === "AbortError") { setSendError("No se compartió la cotización. Puedes volver a intentarlo."); return; }
      setSendError(error instanceof Error ? error.message : "No fue posible completar la entrega.");
    } finally { setSending(false); setFileDeliveryAction(null); }
  };
  const sendQuote = async (target: EmailTarget, email: string) => {
    const draftQuote = buildQuote(); if (!draftQuote) return;
    setSending(true); setSendingTarget(target); setSendError("");
    let persisted = false;
    try {
      const recipient = await onPrepareRecipient(target, email, draftQuote.customer.id);
      const quote = target === "customer" ? buildQuote({ ...draftQuote.customer, email: recipient }) : draftQuote;
      if (!quote) return;
      await onSave(quote);
      if (mode === "create") clearNewQuoteDraft(localStorage);
      persisted = true;
      await sendQuoteEmail(quote, business, recipient);
      const sentAt = new Date().toISOString();
      const sentQuote: Quote = target === "customer"
        ? { ...quote, deliveryStatus: "enviada_cliente", deliveryUpdatedAt: sentAt }
        : { ...quote, deliveryStatus: "enviada_encargado", deliveryUpdatedAt: sentAt, ownerCopySentAt: sentAt };
      try { await onSave(sentQuote); }
      catch (error) {
        console.error("[sync] El correo salió, pero no se pudo registrar el envío", error);
        setSentWarning("El correo fue enviado, pero no pudimos registrar la fecha de envío. La cotización sí quedó guardada.");
      }
      setCompletedQuote(sentQuote); setSentTarget(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible enviar el correo.";
      setSendError(persisted ? `La cotización quedó guardada, pero no se pudo enviar: ${message}` : `No se envió porque primero debemos guardar la cotización: ${message}`);
    }
    finally { setSending(false); setSendingTarget(null); }
  };
  if (mode !== "create" && !initialQuote) return <section className="panel narrow"><button className="back-link" onClick={onCancel}>← Volver</button><div className="empty"><strong>No encontramos la cotización que quieres {mode === "edit" ? "editar" : "duplicar"}.</strong><p>Puede haber sido eliminada o el enlace ya no es válido.</p></div></section>;
  if (sentTarget) return <section className="success-card"><span className="success-icon"><Icon name="check" size={42}/></span><h2>{sentTarget === "customer" ? "¡Cotización enviada al cliente!" : "¡Cotización enviada a tu correo!"}</h2><p>{sentTarget === "customer" ? <>La cotización de <strong>{business.name}</strong> para <strong>{customer?.name}</strong> ya está registrada como enviada y pendiente de respuesta.</> : <>El PDF ya está en tu correo y quedó registrado como enviado al encargado. Después puedes confirmar su subida a Mercado Público desde el detalle.</>}</p>{sentWarning && <div className="send-error">{sentWarning}</div>}<div className="success-actions"><button className="secondary" onClick={downloadPdfOnly}><Icon name="download"/> Descargar PDF</button><button className="primary" onClick={() => { const quote = completedQuote || buildQuote(); if (quote) onDone(quote); }}>Terminar</button></div><small>El PDF incluye automáticamente el logo cargado en Mi negocio.</small></section>;
  return <section className="wizard">
    {draftRestored && <div className="sync-notice sync-notice-success" role="status"><div><strong>Borrador recuperado</strong><span>Restauramos la cotización que estabas preparando antes de cerrar la app.</span></div><button className="secondary" type="button" onClick={discardDraft}>Descartar borrador</button></div>}
    <div className="wizard-head"><button className="back-link" onClick={onCancel}>← Salir</button><div className="steps">{["Cliente", "Productos", "Revisar"].map((label, index) => <div className={`step ${step >= index + 1 ? "done" : ""}`} key={label}><span>{step > index + 1 ? <Icon name="check" size={15}/> : index + 1}</span><b>{label}</b></div>)}</div></div>
    {step === 1 && <div className="wizard-card"><div className="wizard-title quote-customer-title"><span className="number">1</span><div><h2>¿Para quién es la cotización?</h2><p>Selecciona un cliente o créalo aquí mismo.</p></div><button className="secondary new-customer-button" onClick={() => setCreatingCustomer(!creatingCustomer)}><Icon name="plus"/> {creatingCustomer ? "Cerrar formulario" : "Crear cliente nuevo"}</button></div>
      {creatingCustomer && <CustomerForm onSave={createCustomer} onCancel={() => setCreatingCustomer(false)} submitLabel="Guardar y seleccionar" autoFocusName/>}
      {!creatingCustomer && <div className="choice-list">{availableCustomers.map((client) => <button className={`choice ${customerId === client.id ? "selected" : ""}`} key={client.id} onClick={() => setCustomerId(client.id)}><span className="avatar">{customerInitials(client.name)}</span><span><strong>{client.name}</strong><small>{client.rut || "Sin RUT"} · {client.contact || "Sin contacto"}</small></span><span className="radio">{customerId === client.id && <Icon name="check" size={15}/>}</span></button>)}</div>}
      <div className="wizard-footer"><button className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={!customerId || creatingCustomer} onClick={() => setStep(2)}>Continuar <Icon name="arrow"/></button></div></div>}
    {step === 2 && <div className="quote-layout">
      <div className="wizard-footer span-all product-step-actions">
        <button className="secondary" onClick={() => setStep(1)}>Volver</button>
        <div className="product-step-action-summary"><span>{items.length ? `${items.length} producto${items.length === 1 ? "" : "s"} · ${formatCLP(totals.total)}` : "Agrega al menos un producto"}</span><button className="primary" disabled={items.length === 0} onClick={() => setStep(3)}>Revisar cotización <Icon name="arrow"/></button></div>
      </div>
      <div className="wizard-card products-step"><div className="wizard-title"><span className="number">2</span><div><h2>Agrega productos</h2><p>Busca y presiona Agregar.</p></div></div><Search value={search} onChange={setSearch} placeholder="Buscar café, tapaditos, packs..."/><div className="catalog-list">{visibleProducts.map((product) => {
      const justAdded = addFeedback?.productId === product.id;
      return <div className={`catalog-row${justAdded ? " just-added" : ""}`} key={product.id}><span className="product-symbol"><Icon name="coffee"/></span><div><strong>{product.name}</strong><small>{product.category} · por {product.unit}</small>{justAdded && <span className="add-confirmation" role="status"><Icon name="check" size={13}/> Agregado</span>}</div><b>{formatCLP(product.price)}</b><button key={justAdded ? `${product.id}-${addFeedback?.sequence || 0}` : `${product.id}-idle`} className={`add-button${justAdded ? " added" : ""}`} onClick={() => addItem(product)}><Icon name={justAdded ? "check" : "plus"} size={17}/> {justAdded ? "Agregado" : "Agregar"}</button></div>;
    })}</div></div><QuoteSummary items={items} totals={totals} updateItem={updateItem} removeItem={(id) => setItems(items.filter((item) => item.productId !== id))}/>
    </div>}
    {step === 3 && customer && <div className="review-layout">
      <div className="document-preview"><div className="doc-head"><div className="brand">{business.logoDataUrl ? <Image className="quote-logo" src={business.logoDataUrl} alt={`Logo de ${business.name}`} width={62} height={52} unoptimized/> : <span className="brand-mark"><Icon name="coffee"/></span>}<span><strong>{business.name}</strong><small>Comida rápida y coffee break</small></span></div><div><span>COTIZACIÓN</span><strong>{quoteNumber}</strong><small>{formatDate(mode === "edit" && initialQuote ? initialQuote.date : hoyLocal())}</small></div></div><div className="doc-parties"><div><small>DE</small><strong>{business.name}</strong><span>{business.rut}</span><span>{business.address}</span></div><div><small>PARA</small><strong>{customer.name}</strong><span>{customer.rut}</span><span>{customer.contact}</span></div></div><table className="doc-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{items.map((item) => <tr key={item.productId}><td>{item.name}<small>por {item.unit}</small></td><td>{item.quantity}</td><td>{formatCLP(item.unitPrice)}</td><td>{formatCLP(lineSubtotal(item))}</td></tr>)}</tbody></table><div className="doc-bottom"><label>Observaciones<textarea value={notes} onChange={(e) => setNotes(e.target.value)}/></label><div className="doc-totals"><span>Neto <b>{formatCLP(totals.net)}</b></span><span>IVA 19% <b>{formatCLP(totals.tax)}</b></span><span className="grand">Total <b>{formatCLP(totals.total)}</b></span></div></div></div>
      <aside className="review-actions"><span className="review-check"><Icon name="check" size={25}/></span><h3>{mode === "edit" ? "Revisa y guarda los cambios" : "Elige cómo entregarla"}</h3><p>{customer.compraPorMercadoPublico ? "Este cliente compra por Mercado Público." : "Este cliente usa envío directo."} Puedes revisar el correo antes de cada envío.</p><ProfitabilitySummary items={items}/>{sendError && <div className="send-error">{sendError}</div>}<QuoteEmailActions key={customer.id} business={business} customer={customer} busyTarget={sendingTarget} disabled={sending} onSend={(target, recipient) => void sendQuote(target, recipient)}/><button className="secondary full" disabled={sending} onClick={() => void completeWithFileDelivery("download")}><Icon name="download"/> {fileDeliveryAction === "download" ? "Descargando…" : "Descargar y terminar"}</button><button className="secondary full" disabled={sending} onClick={() => void completeWithFileDelivery("share")}><Icon name="share"/> {fileDeliveryAction === "share" ? "Compartiendo…" : "Compartir y terminar"}</button><button className="secondary full" disabled={sending} onClick={() => void finish()}><Icon name="check"/> {sending && !fileDeliveryAction ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Guardar como borrador"}</button><button className="back-link centered" onClick={() => setStep(2)}>← Volver y corregir</button></aside>
    </div>}
  </section>;
}

function IntegerInput({ value, minimum, onChange }: { value: number; minimum: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const commit = () => {
    const parsed = Number(draft);
    const normalized = Number.isFinite(parsed) ? Math.max(minimum, Math.trunc(parsed)) : minimum;
    setDraft(String(normalized)); setEditing(false); onChange(normalized);
  };
  return <input type="number" min={minimum} step="1" inputMode="numeric" value={editing ? draft : String(value)} onFocus={() => { setDraft(String(value)); setEditing(true); }} onChange={(event) => { const next = event.target.value; setDraft(next); if (next !== "" && Number.isFinite(Number(next))) onChange(Number(next)); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}/>;
}

function QuoteSummary({ items, totals, updateItem, removeItem }: { items: QuoteItem[]; totals: ReturnType<typeof quoteTotals>; updateItem: (id: string, field: "quantity" | "unitPrice", value: number) => void; removeItem: (id: string) => void }) {
  return <aside className="quote-summary"><h3>Tu cotización</h3><p>{items.length ? `${items.length} producto${items.length > 1 ? "s" : ""} agregado${items.length > 1 ? "s" : ""}` : "Aún no agregas productos"}</p><div className="summary-items">{items.map((item) => <div className="summary-item" key={item.productId}><div><strong>{item.name}</strong><button onClick={() => removeItem(item.productId)} aria-label={`Quitar ${item.name}`}><Icon name="trash" size={17}/></button></div><div className="item-fields"><label>Cantidad<IntegerInput value={item.quantity} minimum={1} onChange={(value) => updateItem(item.productId, "quantity", value)}/></label><label>Precio neto<IntegerInput value={item.unitPrice} minimum={0} onChange={(value) => updateItem(item.productId, "unitPrice", value)}/></label></div><b>{formatCLP(lineSubtotal(item))}</b></div>)}</div><div className="totals"><span>Neto <b>{formatCLP(totals.net)}</b></span><span>IVA 19% <b>{formatCLP(totals.tax)}</b></span><span className="total">Total <b>{formatCLP(totals.total)}</b></span></div></aside>;
}
