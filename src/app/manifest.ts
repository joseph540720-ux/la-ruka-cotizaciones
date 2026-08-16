import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Ruka · Gestión gastronómica",
    short_name: "La Ruka",
    description: "Cotizaciones y gestión de servicios de La Ruka",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ef",
    theme_color: "#e56d36",
    orientation: "portrait-primary",
    icons: [{ src: "/la-ruka-logo.png", sizes: "1024x1024", type: "image/png", purpose: "any" }],
  };
}
