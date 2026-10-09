// Prioridade automática dos pedidos do dia e rota de entrega (mais perto primeiro).
import type { DeliveryWindow, DeliveryZone, Order } from "./types";

export interface LatLng { lat: number; lng: number }

export interface RouteCtx {
  origin: LatLng | null;                 // casa da Yasmim (configurações)
  windows: Pick<DeliveryWindow, "id" | "start_time">[];
  zones: Pick<DeliveryZone, "id" | "lat" | "lng" | "sort_order">[];
}

export interface Prioritized {
  order: Order;
  rank: number;            // 1 = primeiro
  legKm: number | null;    // distância desde a parada anterior (só entregas localizadas)
  located: boolean;        // tem coordenada (própria ou da zona)
  approx: boolean;         // usou a coordenada da zona, não do endereço
  windowKey: string;       // "14:00" | "" (sem horário)
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Distância em linha reta (km). Suficiente pra ordenar dentro do Alphaville. */
export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const hasCoords = (o: { lat: number | null; lng: number | null }): o is { lat: number; lng: number } =>
  typeof o.lat === "number" && typeof o.lng === "number" && Number.isFinite(o.lat) && Number.isFinite(o.lng);

function windowStart(o: Order, windows: RouteCtx["windows"]) {
  const w = o.window_id ? windows.find((x) => x.id === o.window_id) : undefined;
  if (w) return w.start_time.slice(0, 5);
  const m = o.window_label?.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

function pointOf(o: Order, ctx: RouteCtx): { p: LatLng | null; approx: boolean } {
  if (o.fulfillment === "retirada") return { p: ctx.origin, approx: false };
  if (hasCoords(o)) return { p: { lat: o.lat, lng: o.lng }, approx: false };
  const z = o.zone_id ? ctx.zones.find((x) => x.id === o.zone_id) : undefined;
  if (z && hasCoords(z)) return { p: { lat: z.lat, lng: z.lng }, approx: true };
  return { p: null, approx: false };
}

const DONE = new Set(["entregue", "cancelado"]);

/**
 * Ordem sugerida pro dia:
 * 1. horário mais cedo primeiro (sem horário vai pro fim);
 * 2. dentro do horário, retiradas primeiro (estão em casa) e entregas na rota
 *    do vizinho mais próximo partindo da casa da Yasmim;
 * 3. pedidos sem localização entram depois, na ordem das zonas;
 * 4. entregues e cancelados ficam por último.
 */
export function prioritize(orders: Order[], ctx: RouteCtx): Prioritized[] {
  const active = orders.filter((o) => !DONE.has(o.status));
  const done = orders.filter((o) => DONE.has(o.status));

  const groups = new Map<string, Order[]>();
  for (const o of active) {
    const k = windowStart(o, ctx.windows);
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  const out: Prioritized[] = [];
  for (const k of keys) {
    const g = groups.get(k)!;
    // cada horário é uma saída nova a partir de casa
    let cursor: LatLng | null = ctx.origin;
    const pickups = g.filter((o) => o.fulfillment === "retirada");
    const deliveries = g.filter((o) => o.fulfillment === "entrega");
    for (const o of pickups) out.push({ order: o, rank: 0, legKm: null, located: true, approx: false, windowKey: k });

    const located = deliveries.map((o) => ({ o, ...pointOf(o, ctx) })).filter((x): x is { o: Order; p: LatLng; approx: boolean } => x.p !== null);
    const unlocated = deliveries.filter((o) => pointOf(o, ctx).p === null);

    // vizinho mais próximo a partir da parada atual
    const pool = [...located];
    while (pool.length) {
      let bi = 0;
      if (cursor) {
        let best = Infinity;
        pool.forEach((x, i) => { const d = haversineKm(cursor!, x.p); if (d < best) { best = d; bi = i; } });
      } else {
        // sem origem: começa pela zona de menor ordem
        pool.sort((a, b) => zoneOrder(a.o, ctx) - zoneOrder(b.o, ctx));
      }
      const [next] = pool.splice(bi, 1);
      out.push({ order: next.o, rank: 0, legKm: cursor ? haversineKm(cursor, next.p) : null, located: true, approx: next.approx, windowKey: k });
      cursor = next.p;
    }

    unlocated.sort((a, b) => zoneOrder(a, ctx) - zoneOrder(b, ctx) || a.address.localeCompare(b.address));
    for (const o of unlocated) out.push({ order: o, rank: 0, legKm: null, located: false, approx: false, windowKey: k });
  }
  for (const o of done) out.push({ order: o, rank: 0, legKm: null, located: false, approx: false, windowKey: "" });
  return out.map((p, i) => ({ ...p, rank: i + 1 }));
}

function zoneOrder(o: Order, ctx: RouteCtx) {
  const z = o.zone_id ? ctx.zones.find((x) => x.id === o.zone_id) : undefined;
  return z?.sort_order ?? 999;
}

/** Link do Google Maps com a rota na ordem sugerida (até 10 paradas). */
export function gmapsRouteUrl(stops: Prioritized[], ctx: RouteCtx, originText: string) {
  const route = stops.filter((s) => s.order.fulfillment === "entrega" && !DONE.has(s.order.status)).slice(0, 10);
  if (!route.length) return null;
  const pt = (s: Prioritized) => {
    const { p } = pointOf(s.order, ctx);
    return p && !s.approx ? `${p.lat},${p.lng}` : `${s.order.address}, ${s.order.zone_name ?? ""}, Nova Lima - MG`;
  };
  const origin = ctx.origin ? `${ctx.origin.lat},${ctx.origin.lng}` : originText;
  const dest = pt(route[route.length - 1]);
  const way = route.slice(0, -1).map(pt).join("|");
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("travelmode", "driving");
  if (origin) u.searchParams.set("origin", origin);
  u.searchParams.set("destination", dest);
  if (way) u.searchParams.set("waypoints", way);
  return u.toString();
}

/* ------------------------------ Geocodificação ------------------------------ */

/** Tira "casa 7", "apto 301", "bloco B"… que confundem o mapa. */
export function cleanAddress(a: string) {
  return a
    .replace(/\b(apartamento|apto|apt|ap|casa|cs|bloco|bl|torre|lote|lt|quadra|qd|unidade|un)\.?\s*[\w-]+/gi, "")
    .replace(/[·|]/g, ",")
    .replace(/\s*,\s*(,\s*)+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^,|,$/g, "")
    .trim();
}

let lastCall = 0;
async function nominatim(q: string, bias: LatLng | null): Promise<LatLng | null> {
  // Nominatim pede no máximo 1 chamada por segundo.
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "br");
  u.searchParams.set("q", q);
  if (bias) u.searchParams.set("viewbox", `${bias.lng - 0.15},${bias.lat + 0.15},${bias.lng + 0.15},${bias.lat - 0.15}`);
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = (await r.json()) as { lat: string; lon: string }[];
  if (!j.length) return null;
  const p = { lat: Number(j[0].lat), lng: Number(j[0].lon) };
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
}

/**
 * Localiza um endereço. Tenta com o nome da zona (condomínio) e depois só com a cidade.
 * `bias` puxa o resultado pra perto da casa da Yasmim.
 */
export async function geocodeAddress(address: string, zoneName: string | null, bias: LatLng | null): Promise<LatLng | null> {
  const base = cleanAddress(address);
  if (!base) return null;
  const tries = [
    zoneName && !/outros|fora|combinar|meu condom/i.test(zoneName) ? `${base}, ${zoneName}, Nova Lima, MG` : null,
    `${base}, Nova Lima, MG`,
    /alphaville/i.test(base) ? null : `${base}, Alphaville Lagoa dos Ingleses, Nova Lima, MG`,
  ].filter((x): x is string => !!x);
  for (const q of tries) {
    const p = await nominatim(q, bias);
    if (p) return p;
  }
  return null;
}

export const geocodePlace = (q: string, bias: LatLng | null) => nominatim(q, bias);

export const mapsPin = (p: LatLng) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);
