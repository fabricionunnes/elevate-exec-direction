import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version tag for debugging deployments
const EVOLUTION_API_FUNC_VERSION = "2026-01-14-v6-route-prefixes";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Route prefixes to try (Evolution API v2.x sometimes uses different base paths)
const ROUTE_PREFIXES = ['', '/api/v1', '/api/v2', '/v1', '/v2'];

serve(async (req) => {
  console.log(`[evolution-api] Version: ${EVOLUTION_API_FUNC_VERSION}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('Evolution API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMPORTANT:
    // Some installs expose the web UI under "/manager" (e.g. http://host:8080/manager),
    // but the HTTP API base should be http://host:8080.
    // To avoid misconfiguration breaking everything, normalize the base URL here.
    const evolutionBaseUrl = EVOLUTION_API_URL
      .replace(/\/manager\/?$/i, '')
      .replace(/\/+$/g, '');

    if (evolutionBaseUrl !== EVOLUTION_API_URL) {
      console.log(`[evolution-api] Normalized EVOLUTION_API_URL from "${EVOLUTION_API_URL}" to "${evolutionBaseUrl}"`);
    }

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    // Action can come from query param OR from body (frontend sends in body)
    let action = url.searchParams.get('action');

    const evolutionHeaders = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    // Make a raw fetch to any URL with Evolution headers
    const fetchEvolutionRaw = async (fullUrl: string, init?: RequestInit) => {
      console.log(`[evolution-api] Calling: ${init?.method || 'GET'} ${fullUrl}`);

      try {
        const res = await fetch(fullUrl, {
          ...init,
          headers: { ...evolutionHeaders, ...(init?.headers || {}) },
        });

        const text = await res.text();
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text };
        }

        console.log(`[evolution-api] Response status: ${res.status}`);
        console.log(`[evolution-api] Response body:`, JSON.stringify(json).substring(0, 500));

        return { res, json };
      } catch (err) {
        // When the VPS is offline / port blocked, fetch throws (ECONNREFUSED).
        // Return a controlled 503 instead of crashing the function (which causes blank screens in the app).
        console.error('[evolution-api] Network error calling Evolution API:', err);

        const json = {
          error: 'Evolution API offline',
          hint: 'O servidor do WhatsApp parece estar offline ou inacessível. Tente novamente mais tarde.',
          details: String(err),
          _version: EVOLUTION_API_FUNC_VERSION,
        };

        const res = new Response(JSON.stringify(json), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

        return { res, json };
      }
    };

    const fetchEvolutionJson = async (endpoint: string, init?: RequestInit) => {
      const fullUrl = `${evolutionBaseUrl}${endpoint}`;
      return fetchEvolutionRaw(fullUrl, init);
    };

    // Try multiple route prefixes to find the working one
    const fetchWithPrefixes = async (path: string, init?: RequestInit): Promise<{ res: Response; json: any; prefix: string }> => {
      for (const prefix of ROUTE_PREFIXES) {
        const endpoint = `${prefix}${path}`;
        const { res, json } = await fetchEvolutionJson(endpoint, init);
        if (res.ok || (res.status !== 404 && res.status !== 405)) {
          return { res, json, prefix };
        }
        console.log(`[evolution-api] Prefix "${prefix}" returned ${res.status}, trying next...`);
      }
      // Return last attempt result
      const endpoint = `${ROUTE_PREFIXES[0]}${path}`;
      const { res, json } = await fetchEvolutionJson(endpoint, init);
      return { res, json, prefix: '' };
    };

    // Helper to fetch all instances from Evolution (tries multiple prefixes)
    const fetchEvolutionInstances = async () => {
      const { res, json, prefix } = await fetchWithPrefixes('/instance/fetchInstances', { method: 'GET' });
      if (res.ok && Array.isArray(json)) {
        console.log(`[evolution-api] Found instances using prefix: "${prefix}"`);
        return json;
      }
      return [];
    };

    let body: any = {};
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      // If action not in query params, check body
      if (!action && body.action) {
        action = body.action;
      }
    }

    console.log(`[evolution-api] Action: ${action}`, JSON.stringify(body).substring(0, 200));

    switch (action) {
      case 'create-instance': {
        // Create a new WhatsApp instance
        const {
          instanceName,
          token: instanceToken,
          number,
          qrcode = true,
          integration = 'WHATSAPP-BAILEYS',
          webhookUrl,
        } = body;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prepare instance creation payload
        const createPayload: any = {
          instanceName,
          token: instanceToken,
          number,
          qrcode,
          integration,
        };

        // If webhook URL is provided, include webhook configuration
        if (webhookUrl) {
          createPayload.webhook = {
            url: webhookUrl,
            webhook_by_events: true,
            webhook_base64: false,
            events: [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE', 
              'CONNECTION_UPDATE',
              'QRCODE_UPDATED',
            ],
          };
        }

        // Evolution API route can vary by install/version; try common prefixes
        const { res, json, prefix } = await fetchWithPrefixes('/instance/create', {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });

        console.log(`[evolution-api] create-instance used prefix: "${prefix}"`);

        if (!res.ok) {
          return new Response(
            JSON.stringify({ error: 'Evolution create-instance failed', status: res.status, details: json }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(json),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set-webhook': {
        // Set webhook for an existing instance
        const { instanceName, webhookUrl, events } = body;

        if (!instanceName || !webhookUrl) {
          return new Response(
            JSON.stringify({ error: 'instanceName and webhookUrl are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const webhookPayload = {
          url: webhookUrl,
          webhook_by_events: true,
          webhook_base64: false,
          events: events || [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED',
          ],
        };

        const { res, json } = await fetchEvolutionJson(`/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          body: JSON.stringify(webhookPayload),
        });

        console.log('[evolution-api] Set webhook response:', json);

        return new Response(
          JSON.stringify({ ...json, _version: EVOLUTION_API_FUNC_VERSION }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sendText': {
        // Send text message (alias for send-text, used by frontend)
        const { instanceId, phone, message } = body;
        
        // Get instance name from database
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: instance, error: instanceError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${evolutionBaseUrl}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            number: phone.includes('@') ? phone : `${phone}@s.whatsapp.net`,
            text: message,
          }),
        });

        const data = await response.json();
        console.log('[evolution-api] SendText response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'connect':
      case 'qr-code': {
        // Generate and return QR/pairing payload for WhatsApp connection.
        // Evolution API endpoints vary by version; we try multiple variants.
        // IMPORTANT: We ONLY use instanceName (string), NEVER UUID
        const instanceName = url.searchParams.get('instanceName') || body.instanceName;
        const number = url.searchParams.get('number') || body.number;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required (query param or body)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[evolution-api] Connect request - instanceName: "${instanceName}", number: "${number}"`);

        const looksLikePhone = typeof number === 'string' && number.replace(/\D/g, '').length >= 10;
        const phoneDigits = typeof number === 'string' ? number.replace(/\D/g, '') : undefined;

        const hasQrPayload = (payload: any) => {
          if (!payload) return false;

          const directString = (v: any) => typeof v === 'string' && v.trim().length > 0;

          return !!(
            // most common
            payload?.code ||
            payload?.pairingCode ||

            // base64 wrappers
            payload?.base64 ||
            payload?.qrcode?.base64 ||
            payload?.qrcode?.code ||
            payload?.qrCode?.base64 ||
            payload?.qr?.base64 ||

            // some installs return QR directly as string
            directString(payload?.qr) ||
            directString(payload?.qrCode) ||
            directString(payload?.qrcode) ||

            // nested variants we already saw in the wild
            directString(payload?.qrcode?.qr) ||
            directString(payload?.qrcode?.image) ||
            directString(payload?.qr?.image)
          );
        };

        const qrCountFrom = (payload: any) => payload?.qrcode?.count ?? payload?.count ?? null;

        // Helper to rank responses for "best" selection
        // Priority: hasQr > higher qrCount > uses number param (when provided)
        const rankResponse = (json: any, attemptName: string): number => {
          let score = 0;
          if (hasQrPayload(json)) score += 1000;
          const count = qrCountFrom(json);
          if (typeof count === 'number') score += count * 10;
          // Prefer attempts with number when number was provided
          if (looksLikePhone && attemptName.includes('number')) score += 5;
          return score;
        };

        // Some versions respond with { instance: { state }, qrcode: { base64/code } }
        // Others respond with { base64 } / { code } / { pairingCode } directly.
        const attempts: Array<{ name: string; endpoint: string; init?: RequestInit }> = [];

        // Some installs use root connect endpoints (no instanceName in path)
        // Docs usually: GET /instance/connect/{instanceName}?number=... but we add fallbacks.
        if (looksLikePhone && phoneDigits) {
          attempts.push({
            name: 'connect_root_post_body_instance_number',
            endpoint: `/instance/connect`,
            init: { method: 'POST', body: JSON.stringify({ instanceName, number: phoneDigits }) },
          });
          attempts.push({
            name: 'connect_root_get_query_instance_number',
            endpoint: `/instance/connect?instanceName=${encodeURIComponent(instanceName)}&number=${encodeURIComponent(phoneDigits)}`,
            init: { method: 'GET' },
          });
        }
        attempts.push({
          name: 'connect_root_get_query_instance',
          endpoint: `/instance/connect?instanceName=${encodeURIComponent(instanceName)}`,
          init: { method: 'GET' },
        });

        // Connect variants (GET/POST, number in query/body)
        if (looksLikePhone && phoneDigits) {
          attempts.push({
            name: 'connect_get_query_number',
            endpoint: `/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(phoneDigits)}`,
            init: { method: 'GET' },
          });
          attempts.push({
            name: 'connect_post_body_number',
            endpoint: `/instance/connect/${encodeURIComponent(instanceName)}`,
            init: { method: 'POST', body: JSON.stringify({ number: phoneDigits }) },
          });
        }

        attempts.push({
          name: 'connect_get_no_number',
          endpoint: `/instance/connect/${encodeURIComponent(instanceName)}`,
          init: { method: 'GET' },
        });
        attempts.push({
          name: 'connect_post_empty',
          endpoint: `/instance/connect/${encodeURIComponent(instanceName)}`,
          init: { method: 'POST', body: JSON.stringify({}) },
        });

        // QR-only variants that some Evolution setups expose
        attempts.push({
          name: 'qr_instance_qr',
          endpoint: `/instance/qr/${encodeURIComponent(instanceName)}`,
          init: { method: 'GET' },
        });
        attempts.push({
          name: 'qr_instance_qrcode',
          endpoint: `/instance/qrcode/${encodeURIComponent(instanceName)}`,
          init: { method: 'GET' },
        });
        attempts.push({
          name: 'qr_instance_qrCode',
          endpoint: `/instance/qrCode/${encodeURIComponent(instanceName)}`,
          init: { method: 'GET' },
        });

        let last: { res: Response; json: any; attemptName: string } | null = null;
        let bestOk: { json: any; attemptName: string; score: number } | null = null;

        for (const a of attempts) {
          const { res, json } = await fetchEvolutionJson(a.endpoint, a.init);
          last = { res, json, attemptName: a.name };

          // if instance not found, try resolving instanceName
          if (res.status === 404 && a.name.startsWith('connect_')) {
            console.log('[evolution-api] Connect returned 404, fetching all instances...');
            const allInstances = await fetchEvolutionInstances();
            const instanceNames = allInstances.map((x: any) => x?.name || x?.instanceName);
            console.log('[evolution-api] Available instances:', instanceNames);

            const match = allInstances.find((x: any) => x?.name === instanceName || x?.instanceName === instanceName);
            if (!match) {
              return new Response(
                JSON.stringify({
                  error: `Instância "${instanceName}" não encontrada na Evolution API. Apague e recrie a instância.`,
                  availableInstances: instanceNames,
                  tip: 'Verifique se o nome da instância está correto ou crie uma nova instância.'
                }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const matchName = match.name || match.instanceName;
            console.log(`[evolution-api] Found instance, retrying with name: "${matchName}"`);

            // Re-run the same attempt but with the resolved name
            const rerunEndpoint = a.endpoint.replace(
              `/instance/connect/${encodeURIComponent(instanceName)}`,
              `/instance/connect/${encodeURIComponent(matchName)}`
            );
            const rerun = await fetchEvolutionJson(rerunEndpoint, a.init);
            last = { res: rerun.res, json: rerun.json, attemptName: `${a.name}_resolved` };
          }

          const okish = last?.res.ok;
          const hasQr = hasQrPayload(last?.json);
          const qrCount = qrCountFrom(last?.json);
          const score = rankResponse(last!.json, last!.attemptName);

          console.log(`[evolution-api] Attempt ${last?.attemptName} -> ok: ${okish}, hasQr: ${hasQr}, count: ${qrCount}, score: ${score}`);

          // Success conditions:
          // - hasQr payload
          // - or Evolution returns count=1 meaning QR ready (even if fields are nested differently)
          if (okish && (hasQr || qrCount === 1)) {
            return new Response(
              JSON.stringify({
                ...last!.json,
                _source: last!.attemptName,
                _version: EVOLUTION_API_FUNC_VERSION,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Track best OK response by score (not just overwrite)
          if (okish && (!bestOk || score > bestOk.score)) {
            bestOk = { json: last!.json, attemptName: last!.attemptName, score };
          }
        }

        // If we never got a QR payload, fetch connectionState for diagnostics and return best OK
        if (bestOk) {
          // Fetch current connectionState to help frontend diagnose
          let connectionState: any = null;
          try {
            const stateResult = await fetchEvolutionJson(
              `/instance/connectionState/${encodeURIComponent(instanceName)}`,
              { method: 'GET' }
            );
            if (stateResult.res.ok) {
              connectionState = stateResult.json?.instance ?? stateResult.json;
            }
          } catch (e) {
            console.log('[evolution-api] Failed to fetch connectionState:', e);
          }

          return new Response(
            JSON.stringify({
              ...bestOk.json,
              _source: bestOk.attemptName,
              _connectionState: connectionState,
              _version: EVOLUTION_API_FUNC_VERSION,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Otherwise return last error
        const status = last?.res.status ?? 502;
        return new Response(
          JSON.stringify({
            ...(last?.json ?? { error: 'No response' }),
            _source: last?.attemptName ?? 'none',
            _version: EVOLUTION_API_FUNC_VERSION,
          }),
          { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        // Check instance status
        const instanceName = url.searchParams.get('instanceName') || body.instanceName;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required (query param or body)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { res, json } = await fetchEvolutionJson(
          `/instance/connectionState/${encodeURIComponent(instanceName)}`,
          { method: 'GET' }
        );

        return new Response(
          JSON.stringify({ ...json, _version: EVOLUTION_API_FUNC_VERSION }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-instances': {
        // List all instances (tries multiple prefixes)
        const instances = await fetchEvolutionInstances();
        return new Response(
          JSON.stringify(instances),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'diagnose': {
        // Diagnose Evolution API configuration by testing multiple endpoints and prefixes
        console.log(`[evolution-api] Running diagnostics on ${evolutionBaseUrl}`);
        
        const diagnostics: any = {
          baseUrl: evolutionBaseUrl,
          version: EVOLUTION_API_FUNC_VERSION,
          apiKeyPresent: !!EVOLUTION_API_KEY,
          tests: [],
        };

        // Test root endpoint
        try {
          const rootRes = await fetch(evolutionBaseUrl, { headers: evolutionHeaders });
          diagnostics.tests.push({
            endpoint: '/',
            status: rootRes.status,
            ok: rootRes.ok,
          });
        } catch (e) {
          diagnostics.tests.push({ endpoint: '/', error: String(e) });
        }

        // Test different route prefixes with fetchInstances
        for (const prefix of ROUTE_PREFIXES) {
          const testEndpoint = `${evolutionBaseUrl}${prefix}/instance/fetchInstances`;
          try {
            const res = await fetch(testEndpoint, { method: 'GET', headers: evolutionHeaders });
            const text = await res.text();
            let parsed: any = null;
            try { parsed = JSON.parse(text); } catch { parsed = text.substring(0, 200); }
            
            diagnostics.tests.push({
              endpoint: `${prefix}/instance/fetchInstances`,
              status: res.status,
              ok: res.ok,
              isArray: Array.isArray(parsed),
              preview: typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 200) : parsed,
            });
            
            if (res.ok && Array.isArray(parsed)) {
              diagnostics.workingPrefix = prefix;
              diagnostics.instances = parsed.map((i: any) => ({
                name: i.name || i.instanceName,
                state: i.connectionStatus || i.state,
              }));
            }
          } catch (e) {
            diagnostics.tests.push({ endpoint: `${prefix}/instance/fetchInstances`, error: String(e) });
          }
        }

        // Also try /instance/list endpoint
        for (const prefix of ROUTE_PREFIXES) {
          const testEndpoint = `${evolutionBaseUrl}${prefix}/instance/list`;
          try {
            const res = await fetch(testEndpoint, { method: 'GET', headers: evolutionHeaders });
            diagnostics.tests.push({
              endpoint: `${prefix}/instance/list`,
              status: res.status,
              ok: res.ok,
            });
            if (res.ok && !diagnostics.workingPrefix) {
              diagnostics.workingPrefix = prefix;
            }
          } catch (e) {
            diagnostics.tests.push({ endpoint: `${prefix}/instance/list`, error: String(e) });
          }
        }

        return new Response(
          JSON.stringify(diagnostics),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-text': {
        // Send text message
        const { instanceName, number, text, delay } = body;
        
        if (!instanceName || !number || !text) {
          return new Response(
            JSON.stringify({ error: 'instanceName, number, and text are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${evolutionBaseUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            number,
            text,
            delay: delay || 0,
          }),
        });

        const data = await response.json();
        console.log('[evolution-api] Send text response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-media': {
        // Send media (image, document, etc.)
        const { instanceName, number, mediatype, media, caption, fileName } = body;
        
        if (!instanceName || !number || !mediatype || !media) {
          return new Response(
            JSON.stringify({ error: 'instanceName, number, mediatype, and media are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${evolutionBaseUrl}/message/sendMedia/${instanceName}`, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            number,
            mediatype,
            media,
            caption: caption || '',
            fileName: fileName || '',
          }),
        });

        const data = await response.json();
        console.log('[evolution-api] Send media response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete-instance': {
        // Delete an instance
        const { instanceName } = body;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${evolutionBaseUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('[evolution-api] Delete instance response:', data);

        // If instance doesn't exist in Evolution API (404), still return success
        // This allows cleaning up stale DB records
        if (response.status === 404) {
          console.log('[evolution-api] Instance not found in Evolution API, returning success for DB cleanup');
          return new Response(
            JSON.stringify({ 
              status: 'SUCCESS', 
              message: 'Instance not found in Evolution API (already deleted or never existed)',
              canDeleteFromDB: true 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logout': {
        // Logout from an instance (endpoint varies by Evolution version)
        const { instanceName } = body;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Try common variants
        const attempts: Array<{ endpoint: string; init: RequestInit }> = [
          { endpoint: `/instance/logout/${encodeURIComponent(instanceName)}`, init: { method: 'DELETE' } },
          { endpoint: `/instance/logout/${encodeURIComponent(instanceName)}`, init: { method: 'POST' } },
          { endpoint: `/instance/logout`, init: { method: 'POST', body: JSON.stringify({ instanceName }) } },
        ];

        let last: { res: Response; json: any } | null = null;
        for (const a of attempts) {
          last = await fetchEvolutionJson(a.endpoint, a.init);
          if (last.res.ok) break;
        }

        const status = last?.res.status ?? 502;
        const data = last?.json ?? { error: 'No response' };
        console.log('[evolution-api] Logout response:', data);

        return new Response(
          JSON.stringify({ ...data, _version: EVOLUTION_API_FUNC_VERSION }),
          { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'restart': {
        // Restart an instance (endpoint varies by Evolution version)
        const { instanceName } = body;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const attempts: Array<{ endpoint: string; init: RequestInit }> = [
          { endpoint: `/instance/restart/${encodeURIComponent(instanceName)}`, init: { method: 'PUT' } },
          { endpoint: `/instance/restart/${encodeURIComponent(instanceName)}`, init: { method: 'POST' } },
          { endpoint: `/instance/restart`, init: { method: 'POST', body: JSON.stringify({ instanceName }) } },
        ];

        let last: { res: Response; json: any } | null = null;
        for (const a of attempts) {
          last = await fetchEvolutionJson(a.endpoint, a.init);
          if (last.res.ok) break;
        }

        const status = last?.res.status ?? 502;
        const data = last?.json ?? { error: 'No response' };
        console.log('[evolution-api] Restart response:', data);

        return new Response(
          JSON.stringify({ ...data, _version: EVOLUTION_API_FUNC_VERSION }),
          { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action',
            availableActions: [
              'create-instance',
              'connect',
              'qr-code',
              'status',
              'list-instances',
              'send-text',
              'sendText',
              'send-media',
              'set-webhook',
              'delete-instance',
              'logout',
              'restart',
              'diagnose'
            ],
            _version: EVOLUTION_API_FUNC_VERSION
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[evolution-api] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        _version: EVOLUTION_API_FUNC_VERSION
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
