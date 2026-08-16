import type { BusinessSettings, Quote } from "./quote.ts";
import { formatCLP, formatDate, lineSubtotal, quoteTotals } from "./quote.ts";

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function resolveLogoDataUrl(source?: string) {
  const logoSource = source || "/la-ruka-logo.png";
  if (logoSource.startsWith("data:")) return logoSource;
  if (typeof window === "undefined") return undefined;
  const response = await fetch(logoSource);
  if (!response.ok) return undefined;
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
}

export async function createQuotePdf(quote: Quote, business: BusinessSettings) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 18;
  const orange = [229, 109, 54] as const;
  const ink = [41, 36, 31] as const;
  const muted = [108, 101, 94] as const;
  let y = 18;

  const logoDataUrl = await resolveLogoDataUrl(business.logoDataUrl);
  if (logoDataUrl) {
    try {
      const format = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      pdf.addImage(logoDataUrl, format, margin, y, 27, 27, undefined, "FAST");
    } catch {
      // Si el archivo no es compatible, se mantiene el nombre textual de respaldo.
    }
  }

  const brandX = logoDataUrl ? 50 : margin;
  pdf.setTextColor(...ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(20);
  pdf.text(business.name || "La Ruka", brandX, y + 8);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(...muted);
  pdf.text("Comida rápida y coffee break", brandX, y + 14);

  pdf.setTextColor(...orange); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
  pdf.text("COTIZACIÓN", pageWidth - margin, y + 5, { align: "right" });
  pdf.setTextColor(...ink); pdf.setFontSize(11); pdf.text(quote.number, pageWidth - margin, y + 12, { align: "right" });
  pdf.setTextColor(...muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
  pdf.text(formatDate(quote.date), pageWidth - margin, y + 18, { align: "right" });
  y += 31;
  pdf.setDrawColor(...orange); pdf.setLineWidth(1); pdf.line(margin, y, pageWidth - margin, y); y += 10;

  const party = (title: string, lines: Array<string | undefined>, x: number) => {
    pdf.setTextColor(...orange); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text(title, x, y);
    pdf.setTextColor(...ink); pdf.setFontSize(11); pdf.text(lines[0] || "", x, y + 6);
    pdf.setTextColor(...muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
    lines.slice(1).filter(Boolean).forEach((line, index) => pdf.text(String(line), x, y + 11 + index * 4.5));
  };
  party("DE", [business.name, business.legalName, business.rut, business.address, business.phone, business.email], margin);
  party("PARA", [quote.customer.name, quote.customer.rut, quote.customer.contact, quote.customer.address, quote.customer.email], 112);
  y += 38;

  const drawTableHeader = () => {
    pdf.setFillColor(247, 243, 239); pdf.rect(margin, y, pageWidth - margin * 2, 9, "F");
    pdf.setTextColor(...muted); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
    pdf.text("PRODUCTO", margin + 3, y + 6); pdf.text("CANT.", 119, y + 6, { align: "right" });
    pdf.text("PRECIO", 150, y + 6, { align: "right" }); pdf.text("SUBTOTAL", pageWidth - margin - 3, y + 6, { align: "right" }); y += 9;
  };
  drawTableHeader();
  for (const item of quote.items) {
    if (y > 250) { pdf.addPage(); y = 18; drawTableHeader(); }
    pdf.setTextColor(...ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const itemName = pdf.splitTextToSize(item.name, 75) as string[];
    pdf.text(itemName, margin + 3, y + 6); pdf.setTextColor(...muted); pdf.setFontSize(7.5);
    pdf.text(`por ${item.unit}`, margin + 3, y + 10 + Math.max(0, itemName.length - 1) * 3.5);
    pdf.setTextColor(...ink); pdf.setFontSize(9); pdf.text(String(item.quantity), 119, y + 6, { align: "right" });
    pdf.text(formatCLP(item.unitPrice), 150, y + 6, { align: "right" }); pdf.text(formatCLP(lineSubtotal(item)), pageWidth - margin - 3, y + 6, { align: "right" });
    const rowHeight = Math.max(14, 10 + itemName.length * 3.5); pdf.setDrawColor(235, 229, 223); pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight); y += rowHeight;
  }

  const totals = quoteTotals(quote.items); y += 7;
  if (y > 235) { pdf.addPage(); y = 22; }
  const totalsX = 135;
  pdf.setFontSize(9); pdf.setTextColor(...muted); pdf.text("Neto", totalsX, y); pdf.text(formatCLP(totals.net), pageWidth - margin, y, { align: "right" }); y += 7;
  pdf.text("IVA 19%", totalsX, y); pdf.text(formatCLP(totals.tax), pageWidth - margin, y, { align: "right" }); y += 4;
  pdf.setDrawColor(...orange); pdf.setLineWidth(.7); pdf.line(totalsX, y, pageWidth - margin, y); y += 8;
  pdf.setTextColor(...orange); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.text("TOTAL", totalsX, y); pdf.text(formatCLP(totals.total), pageWidth - margin, y, { align: "right" });

  if (quote.notes) {
    y += 17; pdf.setTextColor(...ink); pdf.setFontSize(8); pdf.text("OBSERVACIONES", margin, y); y += 5;
    pdf.setTextColor(...muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.text(pdf.splitTextToSize(quote.notes, 105), margin, y);
  }
  pdf.setFontSize(7.5); pdf.setTextColor(...muted); pdf.text(`${business.name} · ${business.phone} · ${business.email}`, pageWidth / 2, 288, { align: "center" });
  return pdf;
}

export async function downloadQuotePdf(quote: Quote, business: BusinessSettings) {
  const pdf = await createQuotePdf(quote, business);
  pdf.save(`${safeFileName(quote.number)}-${safeFileName(quote.customer.name)}.pdf`);
}

export async function quotePdfAttachment(quote: Quote, business: BusinessSettings) {
  const pdf = await createQuotePdf(quote, business);
  const dataUri = pdf.output("datauristring");
  return { content: dataUri.slice(dataUri.indexOf(",") + 1), filename: `${safeFileName(quote.number)}-${safeFileName(quote.customer.name)}.pdf` };
}

export async function shareQuotePdf(quote: Quote, business: BusinessSettings) {
  const pdf = await createQuotePdf(quote, business);
  const filename = `${safeFileName(quote.number)}-${safeFileName(quote.customer.name)}.pdf`;
  const file = new File([pdf.output("blob")], filename, { type: "application/pdf" });
  const text = `Cotización ${quote.number} de ${business.name} para ${quote.customer.name}.`;

  if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ title: `${quote.number} · ${business.name}`, text, files: [file] });
    return "shared" as const;
  }

  pdf.save(filename);
  window.location.href = `https://wa.me/?text=${encodeURIComponent(`${text} El PDF se descargó en el dispositivo para que puedas adjuntarlo en este chat.`)}`;
  return "whatsapp" as const;
}
