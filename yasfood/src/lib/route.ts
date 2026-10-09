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

export interface GeoHit extends LatLng { label: string }

/** Tira "casa 7", "apto 301", "bloco B"… que confundem o mapa. */
export function cleanAddress(a: string) {
  return a
    .replace(/\bcep:?\s*[\d.\-]+/gi, "")
    .replace(/\b(apartamento|apto|apt|ap|casa|cs|bloco|bl|torre|lote|lt|quadra|qd|unidade|un)\.?\s*[\w-]+/gi, "")
    .replace(/[·|]/g, ",")
    .replace(/\s*,\s*(,\s*)+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^,|,$/g, "")
    .trim();
}

/** Partes do endereço: rua + número, CEP e cidade (padrão Nova Lima, onde a loja entrega). */
export function parseAddress(a: string, defaultCity = "Nova Lima") {
  const cep = a.match(/(\d{2})\.?(\d{3})-?(\d{3})/);
  const parts = cleanAddress(a).split(",").map((x) => x.trim()).filter(Boolean);
  let street = parts[0] ?? "";
  if (parts[1] && /^\d+\s*[a-z]?$/i.test(parts[1])) street = `${street} ${parts[1]}`;
  const cityMatch = a.match(/nova lima|belo horizonte|brumadinho|rio acima|sabar[aá]/i);
  const city = cityMatch ? cityMatch[0].replace(/\b\w/g, (c) => c.toUpperCase()) : defaultCity;
  return { street, cep: cep ? `${cep[1]}${cep[2]}-${cep[3]}` : null, city };
}

let lastCall = 0;
async function throttle() {
  // Nominatim pede no máximo 1 chamada por segundo.
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

interface NomRow { lat: string; lon: string; display_name: string; address?: Record<string, string>; type?: string; addresstype?: string }

// Resultado grosso demais (centro da cidade, município, estado) não serve pra rota.
const COARSE = new Set(["city", "town", "municipality", "administrative", "county", "state", "region", "country", "village", "city_district"]);

/** Resultado só vale se for mais fino que "cidade" e estiver na cidade esperada ou a menos de 25 km da referência. */
function accepted(row: NomRow, city: string, bias: LatLng | null) {
  if (COARSE.has(row.type ?? "") || COARSE.has(row.addresstype ?? "")) return false;
  const a = row.address ?? {};
  const where = [a.city, a.town, a.municipality, a.village, a.county, row.display_name].filter(Boolean).join(" | ").toLowerCase();
  if (where.includes(city.toLowerCase())) return true;
  if (bias) return haversineKm(bias, { lat: Number(row.lat), lng: Number(row.lon) }) < 25;
  return false;
}

async function nominatim(params: Record<string, string>, city: string, bias: LatLng | null): Promise<GeoHit | null> {
  await throttle();
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "5");
  u.searchParams.set("countrycodes", "br");
  u.searchParams.set("addressdetails", "1");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (bias) u.searchParams.set("viewbox", `${bias.lng - 0.15},${bias.lat + 0.15},${bias.lng + 0.15},${bias.lat - 0.15}`);
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const rows = (await r.json()) as NomRow[];
  const ok = rows.find((row) => accepted(row, city, bias));
  if (!ok) return null;
  const p = { lat: Number(ok.lat), lng: Number(ok.lon) };
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { ...p, label: ok.display_name } : null;
}

/** Photon (komoot), também OpenStreetMap, com viés pela localização. Segunda opinião. */
async function photon(q: string, city: string, bias: LatLng | null): Promise<GeoHit | null> {
  const u = new URL("https://photon.komoot.io/api/");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "5");
  u.searchParams.set("lang", "default");
  if (bias) { u.searchParams.set("lat", String(bias.lat)); u.searchParams.set("lon", String(bias.lng)); }
  const r = await fetch(u.toString());
  if (!r.ok) return null;
  const j = (await r.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
  for (const f of j.features ?? []) {
    const pr = f.properties;
    const row: NomRow = { lat: String(f.geometry.coordinates[1]), lon: String(f.geometry.coordinates[0]), display_name: [pr.name, pr.street, pr.housenumber, pr.district, pr.city, pr.state].filter(Boolean).join(", "), address: { city: pr.city ?? "", county: pr.county ?? "" }, type: pr.type };
    if (accepted(row, city, bias)) return { lat: Number(row.lat), lng: Number(row.lon), label: row.display_name };
  }
  return null;
}

/** BrasilAPI devolve a coordenada do CEP quando existe no OpenStreetMap. */
async function cepLookup(cep: string, bias: LatLng | null): Promise<GeoHit | null> {
  const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep.replace(/\D/g, "")}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { street?: string; neighborhood?: string; city?: string; location?: { coordinates?: { latitude?: string; longitude?: string } } };
  const lat = Number(j.location?.coordinates?.latitude);
  const lng = Number(j.location?.coordinates?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (bias && haversineKm(bias, { lat, lng }) > 25) return null;
  return { lat, lng, label: [j.street, j.neighborhood, j.city].filter(Boolean).join(", ") + " (pelo CEP)" };
}

const safe = <T,>(p: Promise<T | null>) => p.catch(() => null);

/**
 * Localiza um endereço de entrega. Ordem: CEP → busca estruturada (rua, número, cidade, CEP)
 * → texto livre com o condomínio → Photon. Só aceita resultado na cidade certa ou perto da casa.
 */
export async function geocodeAddress(address: string, zoneName: string | null, bias: LatLng | null): Promise<GeoHit | null> {
  const { street, cep, city } = parseAddress(address);
  if (!street && !cep) return null;
  const zone = zoneName && !/outros|fora|combinar|meu condom/i.test(zoneName) ? zoneName : null;
  const steps: (() => Promise<GeoHit | null>)[] = [];
  if (cep) steps.push(() => safe(cepLookup(cep, bias)));
  if (street) {
    steps.push(() => safe(nominatim({ street, city, state: "Minas Gerais", country: "Brasil", ...(cep ? { postalcode: cep } : {}) }, city, bias)));
    if (zone) steps.push(() => safe(nominatim({ q: `${street}, ${zone}, ${city}, MG` }, city, bias)));
    steps.push(() => safe(nominatim({ q: `${street}, ${city}, MG` }, city, bias)));
    steps.push(() => safe(photon(`${street}, ${zone ?? ""} ${city} MG`, city, bias)));
    // sem número: ao menos a rua
    const noNumber = street.replace(/\s+\d+\s*[a-z]?$/i, "");
    if (noNumber !== street) steps.push(() => safe(nominatim({ street: noNumber, city, state: "Minas Gerais", country: "Brasil" }, city, bias)));
  }
  for (const step of steps) {
    const hit = await step();
    if (hit) return hit;
  }
  return null;
}

/** Localiza um lugar (condomínio, bairro, endereço da casa). Mesmas regras de aceitação. */
export async function geocodePlace(q: string, bias: LatLng | null): Promise<GeoHit | null> {
  const { city } = parseAddress(q);
  const byAddress = await geocodeAddress(q, null, bias);
  if (byAddress) return byAddress;
  const text = /nova lima|mg\b/i.test(q) ? cleanAddress(q) : `${cleanAddress(q)}, ${city}, MG`;
  return safe(nominatim({ q: text }, city, bias));
}

/** Posição atual pelo GPS do aparelho (precisa de HTTPS e da permissão do navegador). */
export function currentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Este navegador não tem localização."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(err.code === 1 ? "Permissão de localização negada. Libere nas configurações do navegador." : "Não consegui pegar a localização agora. Tente de novo ao ar livre.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export const mapsPin = (p: LatLng) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);
