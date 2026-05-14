// ============================================================================
// Stevo Manager V2 adapter
// ============================================================================
// Manager V2 (Go/whatsmeow) is a different backend than Evolution API. Each
// instance has its OWN URL (e.g. https://sm-tucano.stevo.chat) and its OWN
// API key (per-instance). There is NO global "list all instances" endpoint.
//
// Endpoints (no version prefix, just direct paths):
//   POST  /send/text                { number, text, delay? }
//   POST  /send/media               { number, media, mediatype, caption?, fileName? }
//   GET   /instance/status
//   GET   /instance/qr
//   POST  /instance/connect         { webhookUrl, subscribe[], immediate? }
//   POST  /instance/disconnect
//   DELETE /instance/logout
//   GET   /instance/profile
//   POST  /user/check               { number: [string] }
//   GET   /group/list
//
// Auth: header `apikey: <instance-api-key>`
// ============================================================================

const MGR_TIMEOUT_MS = 25000;

export function isManagerV2Url(input?: string | null): boolean {
  try {
    const cleaned = String(input || '').replace(/\/+$/g, '');
    const hostname = new URL(cleaned).hostname.toLowerCase();
    // Patterns: sm-tucano.stevo.chat, smv2-1.stevo.chat, sm-anything.stevo.chat
    return /^sm[v0-9-]/.test(hostname) && hostname.endsWith('.stevo.chat');
  } catch {
    return false;
  }
}

export function buildManagerV2Headers(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
  };
}

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/manager\/?$/i, '').replace(/\/+$/g, '');
}

async function callManagerV2(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: any,
): Promise<{ status: number; ok: boolean; data: any }> {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MGR_TIMEOUT_MS);

  console.log(`[manager-v2] ${method} ${url}`);

  try {
    const res = await fetch(url, {
      method,
      headers: buildManagerV2Headers(apiKey),
      signal: controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    console.log(`[manager-v2] response status=${res.status}`);
    return { status: res.status, ok: res.ok, data };
  } catch (err: any) {
    console.error('[manager-v2] network error:', err);
    return {
      status: 503,
      ok: false,
      data: {
        error: 'Manager V2 offline',
        details: String(err),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public adapter: traduz ações genéricas para endpoints do Manager V2
// ---------------------------------------------------------------------------
export interface MgrAction {
  baseUrl: string;
  apiKey: string;
}

export const ManagerV2 = {
  async sendText(target: MgrAction, payload: { number: string; text: string; delay?: number; mentioned?: string[] }) {
    // Manager V2 expects raw number (no @s.whatsapp.net for users; group JIDs end with @g.us)
    const body: any = {
      number: payload.number,
      text: payload.text,
      delay: payload.delay ?? 0,
    };
    if (payload.mentioned && payload.mentioned.length > 0) body.mentioned = payload.mentioned;
    return callManagerV2(target.baseUrl, target.apiKey, 'POST', '/send/text', body);
  },

  async sendMedia(target: MgrAction, payload: { number: string; media: string; mediatype: string; caption?: string; fileName?: string }) {
    return callManagerV2(target.baseUrl, target.apiKey, 'POST', '/send/media', {
      number: payload.number,
      media: payload.media,
      mediatype: payload.mediatype,
      caption: payload.caption ?? '',
      fileName: payload.fileName ?? '',
    });
  },

  async status(target: MgrAction) {
    return callManagerV2(target.baseUrl, target.apiKey, 'GET', '/instance/status');
  },

  async qr(target: MgrAction) {
    return callManagerV2(target.baseUrl, target.apiKey, 'GET', '/instance/qr');
  },

  async connect(target: MgrAction, payload: { webhookUrl?: string; subscribe?: string[]; immediate?: boolean; phone?: string }) {
    return callManagerV2(target.baseUrl, target.apiKey, 'POST', '/instance/connect', {
      webhookUrl: payload.webhookUrl ?? '',
      subscribe: payload.subscribe ?? ['Message', 'Connected', 'Disconnected', 'QR'],
      immediate: payload.immediate ?? true,
      phone: payload.phone ?? '',
      rabbitmqEnable: '',
      websocketEnable: '',
      natsEnable: '',
    });
  },

  async disconnect(target: MgrAction) {
    return callManagerV2(target.baseUrl, target.apiKey, 'POST', '/instance/disconnect', {});
  },

  async logout(target: MgrAction) {
    return callManagerV2(target.baseUrl, target.apiKey, 'DELETE', '/instance/logout');
  },

  async profile(target: MgrAction) {
    return callManagerV2(target.baseUrl, target.apiKey, 'GET', '/instance/profile');
  },

  async checkNumbers(target: MgrAction, numbers: string[]) {
    return callManagerV2(target.baseUrl, target.apiKey, 'POST', '/user/check', {
      number: numbers,
      formatJid: false,
    });
  },

  async listGroups(target: MgrAction) {
    return callManagerV2(target.baseUrl, target.apiKey, 'GET', '/group/list');
  },
};

// ---------------------------------------------------------------------------
// Normaliza resposta de status para o formato que o frontend espera
// (Evolution v2 retorna { instance: { state: 'open'|'close'|'connecting' } })
// ---------------------------------------------------------------------------
export function normalizeManagerV2Status(raw: any): any {
  // Manager V2 status payload variations:
  //   { data: { Connected: true, LoggedIn: true, Name: '...' }, message: 'success' }
  //   { connected: true, loggedIn: true, ... }
  //   { status: 'connected' }
  //   { state: 'open' }
  const payload = raw?.data ?? raw?.instance ?? raw ?? {};
  const connectedFlag = payload?.connected ?? payload?.Connected ?? raw?.connected ?? raw?.Connected;
  const loggedInFlag = payload?.loggedIn ?? payload?.LoggedIn ?? raw?.loggedIn ?? raw?.LoggedIn;
  const stateValue = String(
    payload?.state ?? payload?.State ?? payload?.status ?? payload?.Status ?? raw?.state ?? raw?.status ?? ''
  ).toLowerCase();
  const connected =
    connectedFlag === true ||
    loggedInFlag === true ||
    ['open', 'connected', 'online', 'loggedin', 'logged_in'].includes(stateValue);
  const phoneNumber = payload?.phoneNumber ?? payload?.PhoneNumber ?? payload?.phone ?? payload?.Phone ?? null;
  const profileName = payload?.profileName ?? payload?.ProfileName ?? payload?.name ?? payload?.Name ?? null;

  return {
    ...raw,
    data: payload,
    instance: {
      ...(raw?.instance ?? {}),
      state: connected ? 'open' : stateValue || 'close',
      phoneNumber,
      profileName,
    },
  };
}

// ---------------------------------------------------------------------------
// Normaliza resposta de QR para o formato que o frontend espera
// ---------------------------------------------------------------------------
export function normalizeManagerV2Qr(raw: any): any {
  // Possible shapes returned by Manager V2:
  //   { qrCode: "data:image/png;base64,..." }
  //   { qr: "...", base64: "..." }
  //   { code: "...." } pairing code
  const payload = raw?.data ?? raw ?? {};
  const base64 = payload?.qrCode ?? payload?.QRCode ?? payload?.base64 ?? payload?.qr?.base64 ?? payload?.image ?? payload?.Image ?? null;
  const code = payload?.code ?? payload?.Code ?? payload?.pairingCode ?? payload?.PairingCode ?? payload?.qr?.code ?? null;

  return {
    ...raw,
    data: payload,
    base64,
    code,
    qrcode: {
      base64,
      code,
      ...(raw?.qrcode ?? {}),
    },
  };
}
