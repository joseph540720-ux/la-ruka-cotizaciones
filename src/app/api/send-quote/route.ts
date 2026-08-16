import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EmailRequest = { to?: string; quoteNumber?: string; customerName?: string; content?: string; filename?: string };

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Debes iniciar sesión para enviar una cotización." }, { status: 401 });
    const { data, error } = await createClient(supabaseUrl, supabaseKey).auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "La sesión expiró. Vuelve a ingresar." }, { status: 401 });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const configuredRecipient = process.env.QUOTE_RECIPIENT_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: "El correo aún no está configurado. Agrega RESEND_API_KEY y RESEND_FROM_EMAIL." }, { status: 503 });

  const body = await request.json() as EmailRequest;
  const recipient = configuredRecipient || body.to;
  if (!recipient || !body.content || !body.filename || !body.quoteNumber) return NextResponse.json({ error: "Faltan datos necesarios para enviar la cotización." }, { status: 400 });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Cotización ${body.quoteNumber} · La Ruka`,
      html: `<p>Hola,</p><p>Adjuntamos la cotización <strong>${body.quoteNumber}</strong> preparada por La Ruka para ${body.customerName || "su organización"}.</p><p>Saludos,<br>La Ruka</p>`,
      attachments: [{ content: body.content, filename: body.filename }],
    }),
  });
  const result = await response.json();
  if (!response.ok) return NextResponse.json({ error: result.message || "El proveedor de correo rechazó el envío." }, { status: response.status });
  return NextResponse.json({ id: result.id });
}
