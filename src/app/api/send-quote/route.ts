import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_QUOTE_RECIPIENT, emailSubjectValue, escapeHtml, isQuoteRecipientAllowed, resolveQuoteRecipient } from "@/lib/email";

type EmailRequest = { to?: string; quoteNumber?: string; customerName?: string; content?: string; filename?: string };

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "No se pudo verificar el acceso a los datos de La Ruka." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión para enviar una cotización." }, { status: 401 });
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "La sesión expiró. Vuelve a ingresar." }, { status: 401 });

  let body: EmailRequest;
  try { body = await request.json() as EmailRequest; }
  catch { return NextResponse.json({ error: "La solicitud de correo no tiene un formato válido." }, { status: 400 }); }

  const configuredRecipient = process.env.QUOTE_RECIPIENT_EMAIL || DEFAULT_QUOTE_RECIPIENT;
  const recipient = resolveQuoteRecipient(body.to, configuredRecipient);
  const quoteNumber = emailSubjectValue(body.quoteNumber);
  if (!recipient || !body.content || !body.filename || !quoteNumber) return NextResponse.json({ error: "Faltan datos necesarios para enviar la cotización." }, { status: 400 });

  const businessResult = await supabase.from("negocios").select("default_recipient").eq("user_id", data.user.id).maybeSingle();
  const customersResult = await supabase.from("clientes").select("email").eq("user_id", data.user.id);
  if (businessResult.error || customersResult.error) {
    console.error("[email] No se pudo comprobar el destinatario", businessResult.error || customersResult.error);
    return NextResponse.json({ error: "No pudimos comprobar que el destinatario pertenezca a tus datos." }, { status: 503 });
  }
  const stored = {
    business: { defaultRecipient: businessResult.data?.default_recipient || DEFAULT_QUOTE_RECIPIENT },
    customers: [...(customersResult.data || []), { email: configuredRecipient }],
  };
  if (!isQuoteRecipientAllowed(recipient, stored)) {
    return NextResponse.json({ error: "El destinatario no pertenece al negocio ni a uno de tus clientes." }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: "El correo aún no está configurado. Agrega RESEND_API_KEY y RESEND_FROM_EMAIL." }, { status: 503 });

  const customerName = escapeHtml(body.customerName) || "su organización";
  const safeQuoteNumber = escapeHtml(quoteNumber);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Cotización ${quoteNumber} · La Ruka`,
      html: `<p>Hola,</p><p>Adjuntamos la cotización <strong>${safeQuoteNumber}</strong> preparada por La Ruka para ${customerName}.</p><p>Saludos,<br>La Ruka</p>`,
      attachments: [{ content: body.content, filename: body.filename }],
    }),
  });
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) return NextResponse.json({ error: result.message || "El proveedor de correo rechazó el envío." }, { status: response.status });
  return NextResponse.json({ id: result.id });
}
