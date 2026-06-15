"use client";

import { useEffect, useRef, useState } from "react";

const WHATSAPP_GROUP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ||
  "https://chat.whatsapp.com/SEU-LINK-AQUI";

// Evento personalizado — idêntico ao usado na CAPI (route.ts).
const EVENT_NAME = process.env.NEXT_PUBLIC_META_EVENT_NAME || "ImportaCF";

const REDIRECT_SECONDS = 5;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function ThankYouPage() {
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  // Garante que o evento Lead seja disparado apenas uma vez (StrictMode/re-render).
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    // event_id compartilhado entre Pixel (navegador) e CAPI (servidor) => deduplicação.
    const eventId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    // Dados do lead repassados pelo Typeform via querystring (?email=&phone=&name=).
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email") || params.get("e") || "";
    const phone = params.get("phone") || params.get("telefone") || params.get("p") || "";
    const name = params.get("name") || params.get("nome") || "";
    // fbclid vindo do clique no anúncio — usado para reconstruir o _fbc (melhora o match).
    const fbclid = params.get("fbclid") || "";

    // 1) Evento personalizado no navegador (Pixel) com o mesmo eventID.
    //    Eventos personalizados usam "trackCustom" (não "track").
    if (typeof window.fbq === "function") {
      window.fbq(
        "trackCustom",
        EVENT_NAME,
        { content_name: "Inscrição confirmada", currency: "BRL", value: 0 },
        { eventID: eventId }
      );
    }

    // 2) Evento server-side (Conversions API) com o mesmo event_id.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        email,
        phone,
        name,
        fbclid,
        eventSourceUrl: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {
      /* Falha de tracking não deve impactar o usuário. */
    });
  }, []);

  // Contagem regressiva + redirecionamento automático.
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          window.location.href = WHATSAPP_GROUP_URL;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="card">
      <div className="check">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h1>
        Obrigado por <span className="accent">se inscrever!</span>
      </h1>

      <p className="lead">
        Você será redirecionado automaticamente em instantes para o{" "}
        <strong>grupo do WhatsApp</strong>.
      </p>

      <div className="countdown">
        <span>Redirecionando em</span>
        <span className="timer">{seconds}</span>
        <span>segundos…</span>
      </div>

      <div>
        <a
          className="btn"
          href={WHATSAPP_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.821 11.821 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
          Entrar no grupo agora
        </a>
      </div>

      <p className="hint">Clique no botão caso não seja redirecionado.</p>
    </main>
  );
}
