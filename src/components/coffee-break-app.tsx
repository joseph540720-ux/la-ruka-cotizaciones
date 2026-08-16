"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { DEFAULT_QUOTE_RECIPIENT, seedBusiness, seedCustomers, seedProducts, seedQuotes } from "@/lib/seed";
import { formatCLP, formatDate, lineSubtotal, needsWeeklyFollowUp, normalizeQuote, quoteTotals, type BusinessSettings, type Customer, type Product, type Quote, type QuoteItem, type QuoteStatus } from "@/lib/quote";
import { downloadQuotePdf, quotePdfAttachment, shareQuotePdf } from "@/lib/pdf";
import { getSupabase, isCloudConfigured } from "@/lib/supabase";

type View = "home" | "quotes" | "products" | "customers" | "settings" | "new-quote";
type IconName = "home" | "file" | "box" | "users" | "settings" | "plus" | "search" | "arrow" | "check" | "trash" | "coffee" | "mail" | "download" | "share" | "edit" | "chevron";

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

function withQuoteStatus(quote: Quote, status: QuoteStatus): Quote {
  const today = new Date().toISOString().slice(0, 10);
  return { ...quote, status, statusUpdatedAt: today, lastFollowUpAt: status === "Pendiente" ? undefined : quote.lastFollowUpAt };
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search"><Icon name="search"/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/></label>;
}

export function CoffeeBreakApp() {
  const [view, setView] = useState<View>("home");
  const [mobileNav, setMobileNav] = useState(false);
  const [products, setProducts] = useState(seedProducts);
  const [customers, setCustomers] = useState(seedCustomers);
  const [quotes, setQuotes] = useState(seedQuotes);
  const [business, setBusiness] = useState(seedBusiness);
  const [quoteToDuplicate, setQuoteToDuplicate] = useState<Quote | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (supabase) {
      let active = true;
      supabase.auth.getUser().then(async ({ data }) => {
        if (!active || !data.user) return;
        const { data: stored } = await supabase.from("coffee_break_state").select("business,products,customers,quotes").eq("user_id", data.user.id).maybeSingle();
        if (!active) return;
        if (stored) {
          const storedBusiness = stored.business as BusinessSettings;
          const storedQuotes = stored.quotes as Array<Omit<Quote, "status"> & { status: string }>;
          setBusiness({ ...storedBusiness, logoDataUrl: storedBusiness.logoDataUrl || "/la-ruka-logo.png", defaultRecipient: !storedBusiness.defaultRecipient || ["ventas@laruka.cl", "Joseph540720@gmail.com"].includes(storedBusiness.defaultRecipient) ? DEFAULT_QUOTE_RECIPIENT : storedBusiness.defaultRecipient }); setProducts(stored.products as Product[]); setCustomers(stored.customers as Customer[]); setQuotes(storedQuotes.filter((quote) => !["q1", "q2"].includes(quote.id)).map(normalizeQuote));
        }
        setCloudUserId(data.user.id); setStorageReady(true);
      });
      return () => { active = false; };
    }
    const savedQuotes = localStorage.getItem("coffee-break-quotes");
    const savedCustomers = localStorage.getItem("coffee-break-customers");
    const savedProducts = localStorage.getItem("coffee-break-products");
    const savedBusiness = localStorage.getItem("coffee-break-business");
    const frame = requestAnimationFrame(() => {
      if (savedQuotes) setQuotes((JSON.parse(savedQuotes) as Array<Omit<Quote, "status"> & { status: string }>).filter((quote) => !["q1", "q2"].includes(quote.id)).map(normalizeQuote));
      if (savedCustomers) setCustomers(JSON.parse(savedCustomers) as Customer[]);
      if (savedProducts) setProducts(JSON.parse(savedProducts) as Product[]);
      if (savedBusiness) { const storedBusiness = JSON.parse(savedBusiness) as BusinessSettings; setBusiness({ ...storedBusiness, logoDataUrl: storedBusiness.logoDataUrl || "/la-ruka-logo.png", defaultRecipient: !storedBusiness.defaultRecipient || ["ventas@laruka.cl", "Joseph540720@gmail.com"].includes(storedBusiness.defaultRecipient) ? DEFAULT_QUOTE_RECIPIENT : storedBusiness.defaultRecipient }); }
      setStorageReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const supabase = getSupabase();
    if (supabase && cloudUserId) {
      const timer = window.setTimeout(() => { void supabase.from("coffee_break_state").upsert({ user_id: cloudUserId, business, products, customers, quotes, updated_at: new Date().toISOString() }); }, 75);
      return () => window.clearTimeout(timer);
    }
    localStorage.setItem("coffee-break-quotes", JSON.stringify(quotes));
    localStorage.setItem("coffee-break-customers", JSON.stringify(customers));
    localStorage.setItem("coffee-break-products", JSON.stringify(products));
    localStorage.setItem("coffee-break-business", JSON.stringify(business));
  }, [quotes, customers, products, business, storageReady, cloudUserId]);

  const navigate = (next: View) => { setView(next); setMobileNav(false); };
  const startQuote = (source?: Quote) => { setQuoteToDuplicate(source || null); navigate("new-quote"); };
  const updateQuote = (updated: Quote) => setQuotes((current) => current.map((quote) => quote.id === updated.id ? updated : quote));
  const deleteQuote = (deleted: Quote) => {
    const nextQuotes = quotes.filter((quote) => quote.id !== deleted.id);
    setQuotes(nextQuotes);
    const supabase = getSupabase();
    if (supabase && cloudUserId) {
      void supabase.from("coffee_break_state").update({ quotes: nextQuotes, updated_at: new Date().toISOString() }).eq("user_id", cloudUserId);
    } else {
      localStorage.setItem("coffee-break-quotes", JSON.stringify(nextQuotes));
    }
  };
  const titles: Record<View, string> = { home: "Buenos días", quotes: "Cotizaciones", products: "Productos", customers: "Clientes", settings: "Mi negocio", "new-quote": "Nueva cotización" };

  if (!storageReady) return <main className="auth-page"><div className="auth-card"><Image className="auth-logo-image" src="/la-ruka-logo.png" alt="Logo de La Ruka" width={92} height={92} priority/><h1>La Ruka</h1><p>Cargando tus cotizaciones guardadas…</p></div></main>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><Image className="sidebar-logo" src="/la-ruka-logo.png" alt="Logo de La Ruka" width={48} height={48} priority/><span><strong>La Ruka</strong><small>Food truck · Coffee break</small></span></div>
      <nav>
        <NavButton icon="home" label="Inicio" active={view === "home"} onClick={() => navigate("home")}/>
        <NavButton icon="file" label="Cotizaciones" active={view === "quotes" || view === "new-quote"} onClick={() => navigate("quotes")}/>
        <NavButton icon="box" label="Productos" active={view === "products"} onClick={() => navigate("products")}/>
        <NavButton icon="users" label="Clientes" active={view === "customers"} onClick={() => navigate("customers")}/>
      </nav>
      <div className="sidebar-bottom">
        <NavButton icon="settings" label="Mi negocio" active={view === "settings"} onClick={() => navigate("settings")}/>
        <div className="profile"><span>LR</span><div><strong>La Ruka</strong><small>{isCloudConfigured ? "Datos sincronizados" : "Modo local"}</small>{isCloudConfigured && <button className="sign-out" onClick={() => getSupabase()?.auth.signOut()}>Cerrar sesión</button>}</div></div>
      </div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)}/>} 
    <main className="main">
      <header className="topbar">
        <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menú">☰</button>
        <div><h1>{titles[view]}</h1>{view === "home" && <p>Todo listo para una nueva jornada.</p>}</div>
        {view !== "new-quote" && <button className="primary compact" onClick={() => startQuote()}><Icon name="plus"/> Crear cotización</button>}
      </header>
      <div className="content">
        {view === "home" && <Dashboard quotes={quotes} onNew={() => startQuote()} onQuotes={() => navigate("quotes")} onUpdate={updateQuote}/>} 
        {view === "quotes" && <Quotes business={business} quotes={quotes} onNew={() => startQuote()} onDuplicate={startQuote} onUpdate={updateQuote} onDelete={deleteQuote}/>} 
        {view === "products" && <Products products={products} setProducts={setProducts}/>} 
        {view === "customers" && <Customers customers={customers} setCustomers={setCustomers}/>} 
        {view === "settings" && <Settings business={business} onChange={setBusiness}/>} 
        {view === "new-quote" && <QuoteWizard business={business} products={products} customers={customers} initialQuote={quoteToDuplicate} onAddCustomer={(customer) => setCustomers((current) => [...current, customer])} onCancel={() => navigate("home")} onFinish={(quote) => { setQuotes((current) => [quote, ...current]); setQuoteToDuplicate(null); navigate("quotes"); }}/>} 
      </div>
    </main>
  </div>;
}

function NavButton({ icon, label, active, onClick }: { icon: IconName; label: string; active: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon name={icon}/><span>{label}</span></button>;
}

function Dashboard({ quotes, onNew, onQuotes, onUpdate }: { quotes: Quote[]; onNew: () => void; onQuotes: () => void; onUpdate: (quote: Quote) => void }) {
  const acceptedQuotes = quotes.filter((quote) => quote.status === "Aceptada");
  const pendingQuotes = quotes.filter((quote) => quote.status === "Pendiente");
  const rejectedQuotes = quotes.filter((quote) => quote.status === "Rechazada");
  const acceptedTotal = acceptedQuotes.reduce((sum, quote) => sum + quoteTotals(quote.items).total, 0);
  const invoicedTotal = quotes.reduce((sum, quote) => sum + (quote.invoicedAmount || 0), 0);
  const followUps = pendingQuotes.filter((quote) => needsWeeklyFollowUp(quote));
  const followUpDone = (quote: Quote) => onUpdate({ ...quote, lastFollowUpAt: new Date().toISOString().slice(0, 10) });
  return <>
    <section className="hero-card">
      <div><span className="eyebrow">La forma más simple de cotizar</span><h2>¿Creamos una cotización?</h2><p>Elige un cliente, agrega productos y nosotros hacemos el resto.</p><button className="primary hero-button" onClick={onNew}><Icon name="plus" size={23}/> Crear nueva cotización <Icon name="arrow"/></button></div>
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

function QuoteTable({ quotes, onOpen }: { quotes: Quote[]; onOpen?: (quote: Quote) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Facturación</th><th/></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id}><td><strong>{quote.number}</strong></td><td>{quote.customer.name}</td><td>{formatDate(quote.date)}</td><td><strong>{formatCLP(quoteTotals(quote.items).total)}</strong></td><td><Badge status={quote.status}/></td><td>{quote.invoicedAmount ? <span className="billing-badge">Facturada · {formatCLP(quote.invoicedAmount)}</span> : <span className="billing-pending">Pendiente</span>}</td><td><button className="icon-button" aria-label={`Abrir ${quote.number}`} onClick={() => onOpen?.(quote)}><Icon name="chevron"/></button></td></tr>)}</tbody></table></div>;
}

function Quotes({ business, quotes, onNew, onDuplicate, onUpdate, onDelete }: { business: BusinessSettings; quotes: Quote[]; onNew: () => void; onDuplicate: (quote: Quote) => void; onUpdate: (quote: Quote) => void; onDelete: (quote: Quote) => void }) {
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState<Quote | null>(null); const [billing, setBilling] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false);
  const filtered = quotes.filter((q) => `${q.number} ${q.customer.name}`.toLowerCase().includes(search.toLowerCase()));
  if (selected) {
    const totals = quoteTotals(selected.items);
    const setStatus = (status: QuoteStatus) => { const updated = withQuoteStatus(selected, status); onUpdate(updated); setSelected(updated); };
    const saveInvoice = (data: FormData) => { const updated = withQuoteStatus({ ...selected, invoiceNumber: String(data.get("invoiceNumber") || ""), invoicedAt: String(data.get("invoicedAt") || ""), invoicedAmount: Number(data.get("invoicedAmount") || 0) }, "Aceptada"); onUpdate(updated); setSelected(updated); setBilling(false); };
    return <section className="panel quote-detail">
      <button className="back-link" onClick={() => setSelected(null)}>← Volver al historial</button>
      <div className="section-head detail-head"><div><h2>{selected.number}</h2><p>{formatDate(selected.date)} · {selected.customer.name}</p></div><div className="detail-status"><Badge status={selected.status}/><button className="danger-text" onClick={() => setConfirmDelete(true)}><Icon name="trash"/> Borrar</button></div></div>
      <div className="status-controls"><div><strong>Situación de la cotización</strong><span>Actualízala cuando el cliente responda.</span></div><button className={selected.status === "Pendiente" ? "primary" : "secondary"} onClick={() => setStatus("Pendiente")}>Pendiente</button><button className={selected.status === "Aceptada" ? "primary" : "secondary"} onClick={() => setStatus("Aceptada")}>Aceptada</button><button className={selected.status === "Rechazada" ? "danger-button" : "secondary"} onClick={() => setStatus("Rechazada")}>Rechazada</button></div>
      <div className="detail-grid"><div><small>CLIENTE</small><strong>{selected.customer.name}</strong><span>{selected.customer.rut}</span><span>{selected.customer.contact}</span><span>{selected.customer.email}</span></div><div className="detail-actions"><button className="secondary" onClick={() => downloadQuotePdf(selected, business)}><Icon name="download"/> Descargar PDF</button><button className="secondary" onClick={() => void shareQuotePdf(selected, business)}><Icon name="share"/> Compartir por WhatsApp</button><button className="secondary" onClick={() => setBilling(!billing)}><Icon name="file"/> {selected.invoicedAmount ? "Editar factura" : "Registrar factura"}</button><button className="primary" onClick={() => onDuplicate(selected)}><Icon name="plus"/> Duplicar cotización</button></div></div>
      {billing && <form className="invoice-form" action={saveInvoice}><div><h3>Registrar facturación</h3><p>Puede ser el total completo o un monto parcial.</p></div><label>Número de factura<input name="invoiceNumber" required defaultValue={selected.invoiceNumber}/></label><label>Fecha<input name="invoicedAt" type="date" required defaultValue={selected.invoicedAt || new Date().toISOString().slice(0, 10)}/></label><label>Monto facturado<input name="invoicedAmount" type="number" min="0" required defaultValue={selected.invoicedAmount || totals.total}/></label><button className="primary" type="submit">Guardar factura</button></form>}
      {selected.invoicedAmount ? <div className="invoice-summary"><span className="stat-icon green"><Icon name="check"/></span><div><small>FACTURADA {selected.invoicedAt ? `EL ${formatDate(selected.invoicedAt)}` : ""}</small><strong>{formatCLP(selected.invoicedAmount)}</strong><span>{selected.invoiceNumber || "Sin número de factura"}</span></div></div> : <div className="invoice-pending-note">Esta cotización todavía no registra facturación.</div>}
      <table className="doc-table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{selected.items.map((item) => <tr key={item.productId}><td>{item.name}</td><td>{item.quantity}</td><td>{formatCLP(item.unitPrice)}</td><td>{formatCLP(lineSubtotal(item))}</td></tr>)}</tbody></table>
      <div className="detail-totals"><span>Neto <b>{formatCLP(totals.net)}</b></span><span>IVA 19% <b>{formatCLP(totals.tax)}</b></span><span>Total <b>{formatCLP(totals.total)}</b></span></div>{selected.notes && <div className="detail-notes"><small>OBSERVACIONES</small><p>{selected.notes}</p></div>}
      {confirmDelete && <div className="modal-scrim" role="presentation" onMouseDown={() => setConfirmDelete(false)}><div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(event) => event.stopPropagation()}><span className="delete-icon"><Icon name="trash" size={27}/></span><h3 id="delete-title">¿Borrar esta cotización?</h3><p>Se eliminará <strong>{selected.number}</strong> de {selected.customer.name}. Esta acción no se puede deshacer.</p><div className="confirm-actions"><button className="secondary" onClick={() => setConfirmDelete(false)}>No, mantenerla</button><button className="danger-button" onClick={() => { onDelete(selected); setConfirmDelete(false); setSelected(null); }}>Sí, borrar cotización</button></div></div></div>}
    </section>;
  }
  return <section className="panel"><div className="section-head responsive"><div><h2>Historial de cotizaciones</h2><p>{quotes.length} cotizaciones guardadas</p></div><button className="primary" onClick={onNew}><Icon name="plus"/> Nueva cotización</button></div><Search value={search} onChange={setSearch} placeholder="Buscar por número o cliente..."/><QuoteTable quotes={filtered} onOpen={setSelected}/>{filtered.length === 0 && <div className="empty">No encontramos cotizaciones con esa búsqueda.</div>}</section>;
}

function Products({ products, setProducts }: { products: Product[]; setProducts: (products: Product[]) => void }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const filtered = products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  const categoryOrder = ["Bebestibles", "Dulces", "Salados"];
  const groupedCategories = [...new Set(filtered.map((product) => product.category))].sort((a, b) => {
    const positionA = categoryOrder.indexOf(a); const positionB = categoryOrder.indexOf(b);
    if (positionA === -1 && positionB === -1) return a.localeCompare(b, "es");
    if (positionA === -1) return 1; if (positionB === -1) return -1;
    return positionA - positionB;
  });
  const saveProduct = (data: FormData) => {
    const name = String(data.get("name") || "").trim(); if (!name) return;
    const product: Product = { id: editing?.id || crypto.randomUUID(), name, category: String(data.get("category")), unit: String(data.get("unit")), price: Number(data.get("price")), cost: Number(data.get("cost")) || undefined, active: editing?.active ?? true };
    setProducts(editing ? products.map((current) => current.id === editing.id ? product : current) : [...products, product]); setAdding(false); setEditing(null);
  };
  return <section className="panel"><div className="section-head responsive"><div><h2>Catálogo de productos</h2><p>{products.filter((p) => p.active).length} productos disponibles</p></div><button className="primary" onClick={() => { setEditing(null); setAdding(!adding); }}><Icon name="plus"/> Nuevo producto</button></div>
    {adding && <form className="inline-form" key={editing?.id || "new"} action={saveProduct}><label>Nombre<input name="name" required placeholder="Ej: Mini sándwich" defaultValue={editing?.name}/></label><label>Categoría<select name="category" defaultValue={editing?.category || "Salados"}><option>Salados</option><option>Dulces</option><option>Bebestibles</option><option>Saludable</option><option>Packs</option><option>Servicios</option></select></label><label>Unidad<input name="unit" defaultValue={editing?.unit || "unidad"}/></label><label>Precio neto<input name="price" type="number" min="0" required defaultValue={editing?.price}/></label><label>Costo<input name="cost" type="number" min="0" defaultValue={editing?.cost}/></label><button className="primary" type="submit">{editing ? "Actualizar" : "Guardar"}</button></form>}
    <Search value={search} onChange={setSearch} placeholder="Buscar producto o categoría..."/>
    <div className="catalog-groups">{groupedCategories.map((categoryName) => { const categoryProducts = filtered.filter((product) => product.category === categoryName); return <section className="catalog-section" key={categoryName}><div className="catalog-section-head"><h3>{categoryName}</h3><span>{categoryProducts.length} producto{categoryProducts.length === 1 ? "" : "s"}</span></div><div className="product-grid">{categoryProducts.map((product) => <article className={`product-card ${!product.active ? "inactive" : ""}`} key={product.id}><div className="product-top"><span className="product-symbol"><Icon name="coffee"/></span><span className="category">{product.category}</span></div><h3>{product.name}</h3><p>{formatCLP(product.price)} <small>/ {product.unit}</small></p><div className="product-actions"><span className={product.active ? "active-label" : "inactive-label"}>{product.active ? "Activo" : "Inactivo"}</span><span className="card-action-group"><button className="text-button" onClick={() => { setEditing(product); setAdding(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button><button className="text-button" onClick={() => setProducts(products.map((p) => p.id === product.id ? { ...p, active: !p.active } : p))}>{product.active ? "Desactivar" : "Activar"}</button></span></div></article>)}</div></section>; })}</div>
    {filtered.length === 0 && <div className="empty">No encontramos productos con esa búsqueda.</div>}
  </section>;
}

function Customers({ customers, setCustomers }: { customers: Customer[]; setCustomers: (customers: Customer[]) => void }) {
  const [search, setSearch] = useState(""); const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<Customer | null>(null);
  const filtered = customers.filter((c) => `${c.name} ${c.rut} ${c.contact}`.toLowerCase().includes(search.toLowerCase()));
  const saveCustomer = (data: FormData) => { const name = String(data.get("name") || "").trim(); if (!name) return; const customer: Customer = { id: editing?.id || crypto.randomUUID(), name, rut: String(data.get("rut") || ""), contact: String(data.get("contact") || ""), email: String(data.get("email") || ""), phone: editing?.phone, address: editing?.address }; setCustomers(editing ? customers.map((current) => current.id === editing.id ? customer : current) : [...customers, customer]); setAdding(false); setEditing(null); };
  return <section className="panel"><div className="section-head responsive"><div><h2>Clientes</h2><p>{customers.length} clientes guardados</p></div><button className="primary" onClick={() => { setEditing(null); setAdding(!adding); }}><Icon name="plus"/> Nuevo cliente</button></div>
    {adding && <form className="inline-form customer-form" key={editing?.id || "new"} action={saveCustomer}><label>Nombre o institución<input name="name" required defaultValue={editing?.name}/></label><label>RUT<input name="rut" defaultValue={editing?.rut}/></label><label>Contacto<input name="contact" defaultValue={editing?.contact}/></label><label>Correo<input name="email" type="email" defaultValue={editing?.email}/></label><button className="primary" type="submit">{editing ? "Actualizar" : "Guardar"}</button></form>}
    <Search value={search} onChange={setSearch} placeholder="Buscar por nombre, RUT o contacto..."/><div className="customer-list">{filtered.map((customer) => <article className="customer-card" key={customer.id}><span className="avatar">{customer.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><div className="customer-main"><h3>{customer.name}</h3><p>{customer.rut || "Sin RUT"}</p></div><div className="customer-contact"><span>{customer.contact || "Sin contacto"}</span><small>{customer.email || "Sin correo"}</small></div><button className="icon-button" aria-label={`Editar ${customer.name}`} onClick={() => { setEditing(customer); setAdding(true); }}><Icon name="edit"/></button></article>)}</div>
  </section>;
}

function Settings({ business, onChange }: { business: BusinessSettings; onChange: (business: BusinessSettings) => void }) {
  const [saved, setSaved] = useState(false);
  const saveBusiness = (data: FormData) => {
    onChange({ ...business, name: String(data.get("name") || "La Ruka"), legalName: String(data.get("legalName") || ""), rut: String(data.get("rut") || ""), phone: String(data.get("phone") || ""), email: String(data.get("email") || ""), address: String(data.get("address") || ""), defaultRecipient: String(data.get("defaultRecipient") || "") });
    setSaved(true); window.setTimeout(() => setSaved(false), 2500);
  };
  const loadLogo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2_000_000) { window.alert("Elige una imagen PNG o JPG de menos de 2 MB."); return; }
    const reader = new FileReader(); reader.onload = () => onChange({ ...business, logoDataUrl: String(reader.result) }); reader.readAsDataURL(file);
  };
  return <section className="panel narrow"><div className="section-head"><div><h2>Datos del negocio</h2><p>Esta información y el logo aparecerán en todas tus cotizaciones.</p></div></div><form className="settings-form" action={saveBusiness}><div className="logo-box">{business.logoDataUrl ? <Image className="business-logo" src={business.logoDataUrl} alt="Logo de La Ruka" width={72} height={72} unoptimized/> : <span className="brand-mark large"><Icon name="coffee" size={32}/></span>}<div><strong>Logo de La Ruka</strong><p>PNG o JPG, máximo 2 MB</p></div><label className="secondary upload-label">{business.logoDataUrl ? "Cambiar logo" : "Cargar logo"}<input type="file" accept="image/png,image/jpeg" onChange={(event) => loadLogo(event.target.files?.[0])}/></label></div><div className="form-grid"><label>Nombre comercial<input name="name" defaultValue={business.name}/></label><label>Razón social<input name="legalName" defaultValue={business.legalName} placeholder="Completar razón social"/></label><label>RUT<input name="rut" defaultValue={business.rut}/></label><label>Teléfono<input name="phone" defaultValue={business.phone}/></label><label>Correo<input name="email" defaultValue={business.email} type="email"/></label><label>IVA<input defaultValue="19%" disabled/></label><label className="wide">Dirección<input name="address" defaultValue={business.address}/></label><label className="wide">Correo destinatario predeterminado<input name="defaultRecipient" defaultValue={business.defaultRecipient} type="email"/></label></div><div className="form-footer"><span>{saved ? "✓ Datos guardados correctamente" : "El logo se incluirá automáticamente en el PDF."}</span><button className="primary" type="submit">Guardar cambios</button></div></form></section>;
}

function QuoteWizard({ business, products, customers, initialQuote, onAddCustomer, onCancel, onFinish }: { business: BusinessSettings; products: Product[]; customers: Customer[]; initialQuote: Quote | null; onAddCustomer: (customer: Customer) => void; onCancel: () => void; onFinish: (quote: Quote) => void }) {
  const [step, setStep] = useState(1); const [customerId, setCustomerId] = useState(initialQuote?.customer.id || ""); const [creatingCustomer, setCreatingCustomer] = useState(false); const [items, setItems] = useState<QuoteItem[]>(initialQuote?.items || []); const [search, setSearch] = useState(""); const [notes, setNotes] = useState(initialQuote?.notes || "Valores netos. Cotización válida por 10 días."); const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false); const [sendError, setSendError] = useState("");
  const [quoteNumber] = useState(() => `COT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
  const customer = customers.find((c) => c.id === customerId); const totals = quoteTotals(items);
  const visibleProducts = products.filter((p) => p.active && `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  const addItem = (product: Product) => setItems((current) => { const found = current.find((item) => item.productId === product.id); return found ? current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { productId: product.id, name: product.name, unit: product.unit, quantity: 1, unitPrice: product.price, unitCost: product.cost }]; });
  const updateItem = (id: string, field: "quantity" | "unitPrice", value: number) => setItems((current) => current.map((item) => item.productId === id ? { ...item, [field]: field === "quantity" ? Math.max(1, Math.trunc(value || 1)) : Math.max(0, Math.trunc(value || 0)) } : item));
  const createCustomer = (data: FormData) => {
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const newCustomer: Customer = { id: crypto.randomUUID(), name, rut: String(data.get("rut") || ""), contact: String(data.get("contact") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), address: String(data.get("address") || "") };
    onAddCustomer(newCustomer); setCustomerId(newCustomer.id); setCreatingCustomer(false);
  };
  const buildQuote = (): Quote | null => { const today = new Date().toISOString().slice(0, 10); return customer ? { id: crypto.randomUUID(), number: quoteNumber, date: today, customer, items, notes, status: "Pendiente", statusUpdatedAt: today } : null; };
  const finish = (_eventOrLegacyStatus?: unknown) => { void _eventOrLegacyStatus; const quote = buildQuote(); if (quote) onFinish(quote); };
  const downloadPdf = async () => { const quote = buildQuote(); if (quote) await downloadQuotePdf(quote, business); };
  const sharePdf = async () => { const quote = buildQuote(); if (quote) await shareQuotePdf(quote, business); };
  const sendQuote = async () => {
    const quote = buildQuote(); if (!quote) return;
    setSending(true); setSendError("");
    try {
      const attachment = await quotePdfAttachment(quote, business);
      const session = await getSupabase()?.auth.getSession(); const accessToken = session?.data.session?.access_token;
      const response = await fetch("/api/send-quote", { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ to: business.defaultRecipient, quoteNumber: quote.number, customerName: quote.customer.name, ...attachment }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible enviar el correo.");
      setSent(true);
    } catch (error) { setSendError(error instanceof Error ? error.message : "No fue posible enviar el correo."); }
    finally { setSending(false); }
  };
  if (sent) return <section className="success-card"><span className="success-icon"><Icon name="check" size={42}/></span><h2>¡Cotización preparada!</h2><p>La cotización de <strong>{business.name}</strong> está lista para <strong>{customer?.name}</strong> y quedará pendiente de respuesta.</p><div className="success-actions"><button className="secondary" onClick={downloadPdf}><Icon name="download"/> Descargar PDF</button><button className="primary" onClick={finish}>Guardar y terminar</button></div><small>El PDF incluye automáticamente el logo cargado en Mi negocio.</small></section>;
  return <section className="wizard">
    <div className="wizard-head"><button className="back-link" onClick={onCancel}>← Salir</button><div className="steps">{["Cliente", "Productos", "Revisar"].map((label, index) => <div className={`step ${step >= index + 1 ? "done" : ""}`} key={label}><span>{step > index + 1 ? <Icon name="check" size={15}/> : index + 1}</span><b>{label}</b></div>)}</div></div>
    {step === 1 && <div className="wizard-card"><div className="wizard-title quote-customer-title"><span className="number">1</span><div><h2>¿Para quién es la cotización?</h2><p>Selecciona un cliente o créalo aquí mismo.</p></div><button className="secondary new-customer-button" onClick={() => setCreatingCustomer(!creatingCustomer)}><Icon name="plus"/> {creatingCustomer ? "Cerrar formulario" : "Crear cliente nuevo"}</button></div>
      {creatingCustomer && <form className="quote-customer-form" action={createCustomer}><label>Nombre o institución *<input name="name" required autoFocus placeholder="Ej: Junta de vecinos Los Alerces"/></label><label>RUT<input name="rut" placeholder="12.345.678-9"/></label><label>Persona de contacto<input name="contact" placeholder="Nombre del contacto"/></label><label>Correo<input name="email" type="email" placeholder="correo@ejemplo.cl"/></label><label>Teléfono<input name="phone" placeholder="+56 9..."/></label><label>Dirección<input name="address" placeholder="Comuna o dirección"/></label><div className="quote-customer-form-actions"><button className="secondary" type="button" onClick={() => setCreatingCustomer(false)}>Cancelar</button><button className="primary" type="submit"><Icon name="check"/> Guardar y seleccionar</button></div></form>}
      {!creatingCustomer && <div className="choice-list">{customers.map((client) => <button className={`choice ${customerId === client.id ? "selected" : ""}`} key={client.id} onClick={() => setCustomerId(client.id)}><span className="avatar">{client.name.slice(0, 2).toUpperCase()}</span><span><strong>{client.name}</strong><small>{client.rut || "Sin RUT"} · {client.contact || "Sin contacto"}</small></span><span className="radio">{customerId === client.id && <Icon name="check" size={15}/>}</span></button>)}</div>}
      <div className="wizard-footer"><button className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={!customerId || creatingCustomer} onClick={() => setStep(2)}>Continuar <Icon name="arrow"/></button></div></div>}
    {step === 2 && <div className="quote-layout"><div className="wizard-card products-step"><div className="wizard-title"><span className="number">2</span><div><h2>Agrega productos</h2><p>Busca y presiona Agregar.</p></div></div><Search value={search} onChange={setSearch} placeholder="Buscar café, tapaditos, packs..."/><div className="catalog-list">{visibleProducts.map((product) => <div className="catalog-row" key={product.id}><span className="product-symbol"><Icon name="coffee"/></span><div><strong>{product.name}</strong><small>{product.category} · por {product.unit}</small></div><b>{formatCLP(product.price)}</b><button className="add-button" onClick={() => addItem(product)}><Icon name="plus" size={17}/> Agregar</button></div>)}</div></div><QuoteSummary items={items} totals={totals} updateItem={updateItem} removeItem={(id) => setItems(items.filter((item) => item.productId !== id))}/><div className="wizard-footer span-all"><button className="secondary" onClick={() => setStep(1)}>Volver</button><button className="primary" disabled={items.length === 0} onClick={() => setStep(3)}>Revisar cotización <Icon name="arrow"/></button></div></div>}
    {step === 3 && customer && <div className="review-layout"><div className="document-preview"><div className="doc-head"><div className="brand">{business.logoDataUrl ? <Image className="quote-logo" src={business.logoDataUrl} alt={`Logo de ${business.name}`} width={62} height={52} unoptimized/> : <span className="brand-mark"><Icon name="coffee"/></span>}<span><strong>{business.name}</strong><small>Comida rápida y coffee break</small></span></div><div><span>COTIZACIÓN</span><strong>{quoteNumber}</strong><small>{formatDate(new Date().toISOString().slice(0, 10))}</small></div></div><div className="doc-parties"><div><small>DE</small><strong>{business.name}</strong><span>{business.rut}</span><span>{business.address}</span></div><div><small>PARA</small><strong>{customer.name}</strong><span>{customer.rut}</span><span>{customer.contact}</span></div></div><table className="doc-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{items.map((item) => <tr key={item.productId}><td>{item.name}<small>por {item.unit}</small></td><td>{item.quantity}</td><td>{formatCLP(item.unitPrice)}</td><td>{formatCLP(lineSubtotal(item))}</td></tr>)}</tbody></table><div className="doc-bottom"><label>Observaciones<textarea value={notes} onChange={(e) => setNotes(e.target.value)}/></label><div className="doc-totals"><span>Neto <b>{formatCLP(totals.net)}</b></span><span>IVA 19% <b>{formatCLP(totals.tax)}</b></span><span className="grand">Total <b>{formatCLP(totals.total)}</b></span></div></div></div><aside className="review-actions"><span className="review-check"><Icon name="check" size={25}/></span><h3>Todo listo para enviar</h3><p>Se enviará a <strong>{business.defaultRecipient || "correo no configurado"}</strong>.</p><div className="profit-box"><small>Información interna</small><span>Venta neta <b>{formatCLP(totals.net)}</b></span><span>Costo estimado <b>{formatCLP(totals.cost)}</b></span><span>Utilidad estimada <b>{totals.profit == null ? "Incompleta" : formatCLP(totals.profit)}</b></span></div>{sendError && <div className="send-error">{sendError}</div>}<button className="secondary full" onClick={downloadPdf}><Icon name="download"/> Descargar PDF</button><button className="secondary full" onClick={sharePdf}><Icon name="share"/> Compartir por WhatsApp</button><button className="primary full" disabled={sending || !business.defaultRecipient} onClick={sendQuote}><Icon name="mail"/> {sending ? "Enviando..." : "Enviar cotización"}</button><button className="secondary full" onClick={() => finish("Lista")}><Icon name="check"/> Guardar sin enviar</button><button className="back-link centered" onClick={() => setStep(2)}>← Volver y corregir</button></aside></div>}
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
