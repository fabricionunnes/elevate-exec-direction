import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version tag for debugging deployments
const EVOLUTION_API_FUNC_VERSION = "2026-01-12-v3-connect-fallback";

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
      const fullUrl = `${EVOLUTION_API_URL}${endpoint}`;
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
        // Generate and return pairingCode/code for WhatsApp connection.
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

        const qs = number ? `?number=${encodeURIComponent(number)}` : '';

        // 1) Try connect by instanceName (NEVER use UUID)
        let { res: connectRes, json: connectJson } = await fetchEvolutionJson(
          `/instance/connect/${encodeURIComponent(instanceName)}${qs}`,
          { method: 'GET' }
        );

        // 2) If 404, verify if instance exists in Evolution
        if (connectRes.status === 404) {
          console.log('[evolution-api] Connect returned 404, fetching all instances...');
          const allInstances = await fetchEvolutionInstances();
          const instanceNames = allInstances.map((x: any) => x?.name || x?.instanceName);
          console.log('[evolution-api] Available instances:', instanceNames);

          const match = allInstances.find((x: any) => 
            x?.name === instanceName || x?.instanceName === instanceName
          );

          if (!match) {
            // Instance truly doesn't exist in Evolution
            return new Response(
              JSON.stringify({ 
                error: `Instância "${instanceName}" não encontrada na Evolution API. Apague e recrie a instância.`,
                availableInstances: instanceNames,
                tip: 'Verifique se o nome da instância está correto ou crie uma nova instância.'
              }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Found the instance, retry connect with the correct name
          const matchName = match.name || match.instanceName;
          console.log(`[evolution-api] Found instance, retrying with name: "${matchName}"`);
          
          ({ res: connectRes, json: connectJson } = await fetchEvolutionJson(
            `/instance/connect/${encodeURIComponent(matchName)}${qs}`,
            { method: 'GET' }
          ));
        }

        // 3) Check for QR code in response
        const hasQrCode = !!(
          connectJson?.code || 
          connectJson?.pairingCode || 
          connectJson?.base64 || 
          connectJson?.qrcode?.base64 ||
          connectJson?.qrcode?.code
        );
        const qrCount = connectJson?.qrcode?.count ?? connectJson?.count ?? null;

        console.log(`[evolution-api] Connect result - hasQrCode: ${hasQrCode}, qrCount: ${qrCount}`);

        // 4) If count is 0 and we passed a phone number, some Evolution setups only return the
        // QR/pairing payload when calling /instance/connect/{instance} WITHOUT the `number` param.
        // So we retry once without number before giving up.
        if (!hasQrCode && qrCount === 0 && number) {
          console.log('[evolution-api] No QR in connect response (with number). Retrying /instance/connect without number...');

          const { res: connectNoNumRes, json: connectNoNumJson } = await fetchEvolutionJson(
            `/instance/connect/${encodeURIComponent(instanceName)}`,
            { method: 'GET' }
          );

          const noNumHasQr = !!(
            connectNoNumJson?.code ||
            connectNoNumJson?.pairingCode ||
            connectNoNumJson?.base64 ||
            connectNoNumJson?.qrcode?.base64 ||
            connectNoNumJson?.qrcode?.code
          );
          const noNumCount = connectNoNumJson?.qrcode?.count ?? connectNoNumJson?.count ?? null;

          console.log(`[evolution-api] Connect(no number) result - hasQrCode: ${noNumHasQr}, qrCount: ${noNumCount}`);

          if (connectNoNumRes.ok && (noNumHasQr || noNumCount === 1)) {
            return new Response(
              JSON.stringify({
                ...connectNoNumJson,
                _source: 'connect-endpoint-without-number',
                _version: EVOLUTION_API_FUNC_VERSION,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // 5) Return whatever we got, with version info
        return new Response(
          JSON.stringify({ 
            ...connectJson, 
            _source: 'connect-endpoint',
            _version: EVOLUTION_API_FUNC_VERSION 
          }),
          { status: connectRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
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

        const response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
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

        const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
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
