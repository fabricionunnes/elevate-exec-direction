// Web Push sem dependências: criptografia aes128gcm (RFC 8291) e assinatura VAPID (RFC 8292)
// só com Web Crypto. Roda no Deno (Edge Function) e no Node 20+ (testes).

const te = new TextEncoder();
// TS 5.7+ tipa Uint8Array com ArrayBufferLike; a Web Crypto quer BufferSource. Em runtime é o mesmo objeto.
const bs = (u: Uint8Array) => u as unknown as BufferSource;

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", bs(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, bs(data)));
}

/** Par de chaves VAPID novo: público em base64url (65 bytes, não comprimido) e privado em JWK. */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateJwk: JsonWebKey }> {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", kp.privateKey) as JsonWebKey;
  return { publicKey: b64url(raw), privateJwk };
}

/** JWT ES256 do VAPID pro "aud" (origem do serviço de push). Assinatura crua r||s, como o JWS pede. */
export async function vapidJwt(audience: string, subject: string, privateJwk: JsonWebKey, ttlSec = 12 * 3600): Promise<string> {
  const header = b64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(te.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + ttlSec, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bs(te.encode(`${header}.${payload}`))));
  return `${header}.${payload}.${b64url(sig)}`;
}

/** Cifra a mensagem pra uma inscrição (p256dh + auth do navegador), formato aes128gcm de um registro só. */
export async function encryptPayload(plaintext: Uint8Array, p256dhB64: string, authB64: string, salt?: Uint8Array): Promise<Uint8Array> {
  const uaPublic = fromB64url(p256dhB64);
  const authSecret = fromB64url(authB64);
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));

  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", bs(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));

  // IKM = HKDF(auth, ecdh, "WebPush: info" || 0 || ua || as)
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(te.encode("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = (await hmac(prkKey, concat(keyInfo, new Uint8Array([1])))).slice(0, 32);

  const prk = await hmac(s, ikm);
  const cek = (await hmac(prk, concat(te.encode("Content-Encoding: aes128gcm"), new Uint8Array([0, 1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(te.encode("Content-Encoding: nonce"), new Uint8Array([0, 1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", bs(cek), { name: "AES-GCM" }, false, ["encrypt"]);
  const padded = concat(plaintext, new Uint8Array([2])); // 0x02 = último registro
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(nonce) }, aes, bs(padded)));

  const rs = 4096;
  const header = concat(s, new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]), new Uint8Array([asPublic.length]), asPublic);
  return concat(header, cipher);
}

export interface PushSub { endpoint: string; p256dh: string; auth: string }

/** Envia uma notificação. Devolve o status HTTP do serviço de push (201 = ok; 404/410 = inscrição morta). */
export async function sendPush(sub: PushSub, payload: unknown, vapid: { publicKey: string; privateJwk: JsonWebKey; subject: string }, opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string } = {}): Promise<{ status: number; body: string }> {
  const body = await encryptPayload(te.encode(JSON.stringify(payload)), sub.p256dh, sub.auth);
  const aud = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(aud, vapid.subject, vapid.privateJwk);
  const headers: Record<string, string> = {
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(opts.ttl ?? 86400),
    Urgency: opts.urgency ?? "high",
    Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
  };
  if (opts.topic) headers.Topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  const r = await fetch(sub.endpoint, { method: "POST", headers, body: body as unknown as BodyInit });
  return { status: r.status, body: await r.text().catch(() => "") };
}
