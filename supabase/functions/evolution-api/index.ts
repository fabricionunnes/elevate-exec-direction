import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version tag for debugging deployments
const EVOLUTION_API_FUNC_VERSION = "2026-01-12-v4-connect-variants";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const action = url.searchParams.get('action');

    const evolutionHeaders = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    const fetchEvolutionJson = async (endpoint: string, init?: RequestInit) => {
      const fullUrl = `${evolutionBaseUrl}${endpoint}`;
      console.log(`[evolution-api] Calling: ${init?.method || 'GET'} ${fullUrl}`);
      
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
    };

    // Helper to fetch all instances from Evolution
    const fetchEvolutionInstances = async () => {
      const { res, json } = await fetchEvolutionJson('/instance/fetchInstances', { method: 'GET' });
      if (res.ok && Array.isArray(json)) {
        return json;
      }
      return [];
    };

    let body: any = {};
    if (req.method === 'POST') {
      body = await req.json();
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
        } = body;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { res, json } = await fetchEvolutionJson('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName,
            token: instanceToken,
            number,
            qrcode,
            integration,
          }),
        });

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

        const hasQrPayload = (payload: any) => !!(
          payload?.code ||
          payload?.pairingCode ||
          payload?.base64 ||
          payload?.qrcode?.base64 ||
          payload?.qrcode?.code ||
          payload?.qrCode?.base64 ||
          payload?.qr?.base64
        );

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
        // List all instances
        const { res, json } = await fetchEvolutionJson('/instance/fetchInstances', { method: 'GET' });

        return new Response(
          JSON.stringify(json),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
              'send-media',
              'delete-instance',
              'logout',
              'restart'
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
