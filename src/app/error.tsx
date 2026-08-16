"use client";

import { useEffect } from "react";
import Image from "next/image";
import { clearLocalAppState } from "@/lib/storage";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] Error inesperado", error);
  }, [error]);

  const resetLocalData = () => {
    clearLocalAppState(window.localStorage);
    window.location.reload();
  };

  return <main className="auth-page"><div className="auth-card error-card" role="alert"><Image className="auth-logo-image" src="/la-ruka-logo.png" alt="Logo de La Ruka" width={92} height={92} priority/><h1>No pudimos abrir tus datos</h1><p>La aplicación encontró información dañada o un problema inesperado. Puedes reintentar sin borrar nada o restablecer únicamente los datos guardados en este dispositivo.</p><button className="primary full" onClick={reset}>Intentar nuevamente</button><button className="secondary full" onClick={resetLocalData}>Restablecer datos locales</button></div></main>;
}
