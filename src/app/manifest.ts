import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Ruka · Gestión gastronómica",
    short_name: "La Ruka",
    description: "Cotizaciones y gestión de servicios de La Ruka",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ef",
    theme_color: "#b84b16",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
