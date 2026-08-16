import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Ruka · Cotizaciones",
  description: "Administración sencilla de cotizaciones de coffee break",
  applicationName: "La Ruka",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "La Ruka", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#b84b16", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><ServiceWorkerRegistration/>{children}</body>
    </html>
  );
}
