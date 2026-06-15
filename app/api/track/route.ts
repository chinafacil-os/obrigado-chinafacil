import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;
const EVENT_NAME = process.env.NEXT_PUBLIC_META_EVENT_NAME || "ImportaCF";
const GRAPH_VERSION = "v21.0";

/** SHA-256 conforme exigido pela Conversions API (dados já normalizados). */
function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Normaliza e hasheia o e-mail (minúsculo, sem espaços). */
function hashEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return sha256(normalized);
}

/** Normaliza e hasheia o telefone (apenas dígitos, com DDI). */
function hashPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Sem DDI e com tamanho de número BR? Prefixa 55.
  if (digits.length <= 11) digits = `55${digits}`;
  return sha256(digits);
}

/** Separa nome completo em primeiro/último e hasheia cada parte. */
function hashNameParts(name: string): { fn?: string; ln?: string } {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  const fn = sha256(parts[0]);
  if (parts.length === 1) return { fn };
  return { fn, ln: sha256(parts[parts.length - 1]) };
}

function getClientIp(req: NextRequest): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { eventId, email, phone, name, fbclid, eventSourceUrl } = body as {
      eventId?: string;
      email?: string;
      phone?: string;
      name?: string;
      fbclid?: string;
      eventSourceUrl?: string;
    };

    // Sem credenciais completas, pula a CAPI sem erro (só o Pixel do navegador fica ativo).
    if (!PIXEL_ID || !CAPI_TOKEN) {
      return NextResponse.json({ ok: true, capi: "skipped:no-credentials" });
    }

    // Dados de identificação do usuário (hasheados).
    const userData: Record<string, unknown> = {};
    const em = email ? hashEmail(email) : null;
    const ph = phone ? hashPhone(phone) : null;
    const { fn, ln } = name ? hashNameParts(name) : {};
    if (em) {
      userData.em = [em];
      // external_id estável derivado do e-mail — reforça o match.
      userData.external_id = [em];
    }
    if (ph) userData.ph = [ph];
    if (fn) userData.fn = [fn];
    if (ln) userData.ln = [ln];

    // Sinais do navegador para melhorar o match.
    const cookies = req.cookies;
    const fbp = cookies.get("_fbp")?.value;
    let fbc = cookies.get("_fbc")?.value;
    // Sem cookie _fbc mas com fbclid na URL? Reconstrói no formato fb.1.<ts>.<fbclid>.
    if (!fbc && fbclid) {
      fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;
    }
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
    const ip = getClientIp(req);
    if (ip) userData.client_ip_address = ip;
    const ua = req.headers.get("user-agent");
    if (ua) userData.client_user_agent = ua;

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: EVENT_NAME,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: eventSourceUrl,
          user_data: userData,
          custom_data: {
            content_name: "Inscrição confirmada",
            currency: "BRL",
            value: 0,
          },
        },
      ],
    };
    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[CAPI] erro:", result);
      return NextResponse.json(
        { ok: false, capi: "error", details: result },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, capi: "sent", result });
  } catch (err) {
    console.error("[CAPI] exceção:", err);
    return NextResponse.json({ ok: false, capi: "exception" }, { status: 500 });
  }
}
