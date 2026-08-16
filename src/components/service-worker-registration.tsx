"use client";

import { useEffect } from "react";

const SHELL_CACHE = "la-ruka-shell-v1";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(async () => {
      if (!("caches" in window)) return;
      const assets = performance.getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((resource) => {
          const url = new URL(resource);
          return url.origin === window.location.origin && url.pathname.startsWith("/_next/static/");
        });
      if (assets.length) await (await caches.open(SHELL_CACHE)).addAll(assets);
    }).catch((error: unknown) => console.warn("[pwa] No se pudo registrar el modo sin conexión", error));
  }, []);
  return null;
}
