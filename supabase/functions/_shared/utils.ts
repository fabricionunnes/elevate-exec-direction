export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function createSuccessResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashString(input: string): Promise<string> {
  return hashBuffer(new TextEncoder().encode(input).buffer);
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function getGeoFromIp(ip: string): Promise<{ country: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null; }> {
  const fallback = { country: null, region: null, city: null, latitude: null, longitude: null };
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("192.168.")) return fallback;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return fallback;
    const d = await res.json() as { country_name?: string; region?: string; city?: string; latitude?: number; longitude?: number };
    return { country: d.country_name ?? null, region: d.region ?? null, city: d.city ?? null, latitude: d.latitude ?? null, longitude: d.longitude ?? null };
  } catch { return fallback; }
}
