"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { getSupabase, isCloudConfigured } from "@/lib/supabase";

export function AuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isCloudConfigured);
  const [signedIn, setSignedIn] = useState(!isCloudConfigured);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getSupabase(); if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSignedIn(Boolean(data.session)); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setSignedIn(Boolean(session)); setLoading(false); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const submit = async (formData: FormData) => {
    const email = String(formData.get("email") || ""); const password = String(formData.get("password") || "");
    const supabase = getSupabase(); if (!supabase) return;
    setLoading(true); setMessage("");
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setMessage(result.error.message);
    setLoading(false);
  };

  if (loading && !signedIn) return <main className="auth-page"><div className="auth-card"><Image className="auth-logo-image" src="/la-ruka-logo.png" alt="Logo de La Ruka" width={92} height={92} priority/><h1>La Ruka</h1><p>Conectando con tus datos…</p></div></main>;
  if (!signedIn) return <main className="auth-page"><form className="auth-card" action={submit}><Image className="auth-logo-image" src="/la-ruka-logo.png" alt="Logo de La Ruka" width={92} height={92} priority/><h1>Bienvenida a La Ruka</h1><p>Ingresa para administrar cotizaciones y clientes.</p><label>Correo<input name="email" type="email" required autoComplete="email"/></label><label>Contraseña<input name="password" type="password" minLength={8} required autoComplete="current-password"/></label>{message && <div className="auth-message">{message}</div>}<button className="primary full" disabled={loading}>{loading ? "Espera…" : "Ingresar"}</button><small className="private-access-note">El acceso es privado y lo administra La Ruka.</small></form></main>;
  return children;
}
