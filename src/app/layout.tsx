import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Ruka · Cotizaciones",
  description: "Administración sencilla de cotizaciones de coffee break",
  applicationName: "La Ruka",
  icons: { icon: "/la-ruka-logo.png", apple: "/la-ruka-logo.png" },
  appleWebApp: { capable: true, title: "La Ruka", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#e56d36", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
