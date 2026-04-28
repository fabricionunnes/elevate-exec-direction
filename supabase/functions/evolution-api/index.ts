import { createClient } from "@supabase/supabase-js";

// Version tag for debugging deployments
const EVOLUTION_API_FUNC_VERSION = "2026-03-16-v10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Route prefixes to try (Evolution API v2.x sometimes uses different base paths)
const ROUTE_PREFIXES = ['', '/api/v1', '/api/v2', '/v1', '/v2'];

function buildHandledEvolutionError(message: string, status: number | undefined, details: any, extra: Record<string, unknown> = {}) {
  const detailsText = JSON.stringify(details || {}).toLowerCase();
  const isUnauthorized = status === 401 || detailsText.includes('unauthorized');
  return {
    success: false,
    error: message,
    errorType: isUnauthorized ? 'STEVO_UNAUTHORIZED' : 'STEVO_API_ERROR',
    userMessage: isUnauthorized
      ? 'A API da STEVO recusou essa chave. Use a API Key/Hash da instância no servidor Evolution, não a chave do Manager V2.'
      : 'Não foi possível completar a chamada na API da STEVO. Confira URL, chave e permissões da instância.',
    status,
    details,
    handled: true,
    _version: EVOLUTION_API_FUNC_VERSION,
    ...extra,
  };
}

function normalizeBaseUrl(input: string) {
  const cleaned = input.replace(/\/manager\/?$/i, '').replace(/\/+$/g, '');
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.toLowerCase() === 'sm-tucano.stevo.chat') {
      return 'https://evo07.stevo.chat';
    }
  } catch {
    // Keep the original value so callers can return their existing validation errors.
  }
  return cleaned;
}

function getStevoManagerUrlError(input: string) {
  try {
    const parsed = new URL(input.replace(/\/manager\/?$/i, '').replace(/\/+$/g, ''));
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'sm-tucano.stevo.chat') return null;
    if (hostname.startsWith('sm-') && hostname.endsWith('.stevo.chat')) {
      return {
        error: 'URL do Manager V2 informada no lugar da URL da API Evolution',
        hint: 'Essa URL abre o painel da Stevo, mas não responde aos endpoints da Evolution API. Use a URL do servidor/API, geralmente no formato https://evoXX.stevo.chat.',
        receivedHost: hostname,
        expectedFormat: 'https://evo07.stevo.chat',
        _version: EVOLUTION_API_FUNC_VERSION,
      };
    }
  } catch {
    return null;
  }
  return null;
}

// Build headers that work across different Evolution/STEVO installs.
// Some expect "apikey", others expect "Authorization: Bearer <key>".
function buildEvolutionHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
  };
}

function normalizeInstanceKey(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeGroupPhone(groupId?: string | null) {
  return String(groupId || '').replace(/@g\.us$/i, '').trim();
}

function mapFetchedGroups(data: any) {
  const rawGroups = Array.isArray(data)
    ? data
    : Array.isArray(data?.groups)
      ? data.groups
      : [];

  return rawGroups
    .map((group: any) => ({
      id: group.id || group.jid || group.groupId,
      subject: group.subject || group.name || group.groupName || 'Grupo sem nome',
      creation: group.creation,
    }))
    .filter((group: any) => group.id);
}

async function fetchGroupsFromInstance(apiBaseUrl: string, apiHeaders: HeadersInit, instanceName: string) {
  const endpoints = [
    `/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`,
    `/group/list/${encodeURIComponent(instanceName)}`,
    `/chat/fetchGroups/${encodeURIComponent(instanceName)}`,
  ];

  let lastRes: Response | null = null;
  let lastData: any = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'GET',
        headers: apiHeaders,
      });

      lastRes = response;
      lastData = await response.json();

      if (response.ok) {
        console.log(`[evolution-api] fetchGroups succeeded with endpoint: ${endpoint}`);
        break;
      }

      console.log(`[evolution-api] fetchGroups failed with endpoint ${endpoint}: ${response.status}`, lastData);
    } catch (err) {
      console.error(`[evolution-api] fetchGroups network error for ${endpoint}:`, err);
    }
  }

  return { lastRes, lastData };
}

async function getStaffByUserId(supabaseService: any, userId: string) {
  const { data: staff } = await supabaseService
    .from('onboarding_staff')
    .select('id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  return staff;
}

async function userCanViewWhatsAppInstance(supabaseService: any, userId: string, instanceId: string) {
  const staff = await getStaffByUserId(supabaseService, userId);

  if (!staff) return false;
  if (String(staff.role || '').toLowerCase() === 'master') return true;

  const { data: access } = await supabaseService
    .from('whatsapp_instance_access')
    .select('id')
    .eq('staff_id', staff.id)
    .eq('instance_id', instanceId)
    .eq('can_view', true)
    .maybeSingle();

  return !!access;
}

async function syncGroupsToConversations(supabaseService: any, instanceId: string, groupsPayload: any) {
  const groups = mapFetchedGroups(groupsPayload)
    .map((group: any) => ({
      instanceId,
      phone: normalizeGroupPhone(group.id),
      name: group.subject,
      createdAt: group.creation
        ? new Date(group.creation * 1000).toISOString()
        : new Date().toISOString(),
    }))
    .filter((group: any) => group.phone);

  if (groups.length === 0) {
    return {
      groupsFound: 0,
      contactsInserted: 0,
      contactsUpdated: 0,
      conversationsInserted: 0,
    };
  }

  const uniquePhones = Array.from(new Set(groups.map((group: any) => group.phone)));
  const { data: existingContacts, error: contactsError } = await supabaseService
    .from('crm_whatsapp_contacts')
    .select('id, phone, name')
    .in('phone', uniquePhones);

  if (contactsError) throw contactsError;

  const contactMap = new Map((existingContacts || []).map((contact: any) => [contact.phone, contact]));

  const contactsToInsert = groups
    .filter((group: any) => !contactMap.has(group.phone))
    .map((group: any) => ({
      phone: group.phone,
      name: group.name,
    }));

  let contactsInserted = 0;
  if (contactsToInsert.length > 0) {
    const { data: insertedContacts, error: insertContactsError } = await supabaseService
      .from('crm_whatsapp_contacts')
      .insert(contactsToInsert)
      .select('id, phone, name');

    if (insertContactsError) throw insertContactsError;

    contactsInserted = (insertedContacts || []).length;
    (insertedContacts || []).forEach((contact: any) => contactMap.set(contact.phone, contact));
  }

  const contactsToRename = groups.filter((group: any) => {
    const existingContact = contactMap.get(group.phone);
    return existingContact && (!existingContact.name || existingContact.name === existingContact.phone) && group.name;
  });

  if (contactsToRename.length > 0) {
    await Promise.all(
      contactsToRename.map((group: any) =>
        supabaseService
          .from('crm_whatsapp_contacts')
          .update({ name: group.name })
          .eq('id', contactMap.get(group.phone)?.id)
      )
    );
  }

  const contactIds = Array.from(new Set(groups.map((group: any) => contactMap.get(group.phone)?.id).filter(Boolean)));
  if (contactIds.length === 0) {
    return {
      groupsFound: groups.length,
      contactsInserted,
      contactsUpdated: contactsToRename.length,
      conversationsInserted: 0,
    };
  }

  const { data: existingConversations, error: conversationsError } = await supabaseService
    .from('crm_whatsapp_conversations')
    .select('id, instance_id, contact_id')
    .eq('instance_id', instanceId)
    .in('contact_id', contactIds);

  if (conversationsError) throw conversationsError;

  const existingConversationKeys = new Set(
    (existingConversations || []).map((conversation: any) => `${conversation.instance_id}:${conversation.contact_id}`)
  );

  const conversationsToInsert = groups
    .map((group: any) => ({
      instance_id: group.instanceId,
      contact_id: contactMap.get(group.phone)?.id,
      status: 'open',
      last_message: '[Grupo sincronizado]',
      last_message_at: group.createdAt,
    }))
    .filter(
      (conversation: any) =>
        conversation.contact_id &&
        !existingConversationKeys.has(`${conversation.instance_id}:${conversation.contact_id}`)
    );

  let conversationsInserted = 0;
  if (conversationsToInsert.length > 0) {
    const { error: insertConversationsError } = await supabaseService
      .from('crm_whatsapp_conversations')
      .insert(conversationsToInsert);

    if (insertConversationsError) throw insertConversationsError;
    conversationsInserted = conversationsToInsert.length;
  }

  return {
    groupsFound: groups.length,
    contactsInserted,
    contactsUpdated: contactsToRename.length,
    conversationsInserted,
  };
}

Deno.serve(async (req) => {
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
    const evolutionBaseUrl = normalizeBaseUrl(EVOLUTION_API_URL);

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

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Try getClaims first (fast, no network call), fallback to getUser
    let userId: string | undefined;
    try {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims?.sub) {
        userId = claimsData.claims.sub as string;
      }
    } catch (e) {
      console.warn('[evolution-api] getClaims failed, trying getUser fallback:', e);
    }

    if (!userId) {
      // Fallback to getUser (handles token refresh edge cases)
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        console.error('[evolution-api] Auth failed (both getClaims and getUser):', userError?.message);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = userData.user.id;
    }

    const user = { id: userId };

    const url = new URL(req.url);
    // Action can come from query param OR from body (frontend sends in body)
    let action = url.searchParams.get('action');

    const evolutionHeaders = buildEvolutionHeaders(EVOLUTION_API_KEY);
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const resolveEvolutionCredentials = async (instanceName?: string) => {
      const defaultTarget = {
        baseUrl: evolutionBaseUrl,
        headers: evolutionHeaders,
        source: 'global-env',
      };

      try {
        const { data: configuredInstances, error: configuredInstancesError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name, api_url, api_key')
          .not('api_url', 'is', null)
          .not('api_key', 'is', null);

        if (configuredInstancesError) {
          console.error('[evolution-api] Failed to load whatsapp_instances credentials:', configuredInstancesError.message);
        }

        const normalizedTarget = normalizeInstanceKey(instanceName);
        const matchedInstance = normalizedTarget
          ? (configuredInstances || []).find((item: any) => normalizeInstanceKey(item.instance_name) === normalizedTarget)
          : null;

        if (matchedInstance?.api_url && matchedInstance?.api_key) {
          return {
            baseUrl: normalizeBaseUrl(matchedInstance.api_url),
            headers: buildEvolutionHeaders(matchedInstance.api_key),
            source: `whatsapp_instances:${matchedInstance.instance_name}`,
          };
        }

        const { data: defaultConfig } = await supabaseService
          .from('whatsapp_default_config')
          .select('setting_value')
          .eq('setting_key', 'default_instance')
          .maybeSingle();

        const defaultInstance = (configuredInstances || []).find(
          (item: any) => item.instance_name === defaultConfig?.setting_value
        );

        if (defaultInstance?.api_url && defaultInstance?.api_key) {
          return {
            baseUrl: normalizeBaseUrl(defaultInstance.api_url),
            headers: buildEvolutionHeaders(defaultInstance.api_key),
            source: `default-instance:${defaultInstance.instance_name}`,
          };
        }

        const { data: clientConfig, error: clientConfigError } = await supabaseService
          .from('client_crm_whatsapp_config')
          .select('server_url, api_key')
          .limit(1)
          .maybeSingle();

        if (clientConfigError) {
          console.error('[evolution-api] Failed to load client_crm_whatsapp_config:', clientConfigError.message);
        }

        if (clientConfig?.server_url && clientConfig?.api_key) {
          return {
            baseUrl: normalizeBaseUrl(clientConfig.server_url),
            headers: buildEvolutionHeaders(clientConfig.api_key),
            source: 'client-crm-config',
          };
        }
      } catch (error) {
        console.error('[evolution-api] Failed to resolve custom Evolution credentials:', error);
      }

      return defaultTarget;
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

    // Custom API helpers (user-provided baseUrl/apiKey) ----------------------
    const fetchCustomWithPrefixes = async (
      baseUrl: string,
      path: string,
      apiKey: string,
      init?: RequestInit
    ): Promise<{ res: Response; json: any; prefix: string; tried: Array<{ url: string; method: string; status?: number }> }> => {
      const cleanBaseUrl = normalizeBaseUrl(baseUrl);
      const customHeaders = buildEvolutionHeaders(apiKey);
      const tried: Array<{ url: string; method: string; status?: number }> = [];

      for (const prefix of ROUTE_PREFIXES) {
        const endpoint = `${prefix}${path}`;
        const fullUrl = `${cleanBaseUrl}${endpoint}`;
        const method = (init?.method || 'GET').toUpperCase();

        console.log(`[evolution-api] [custom] Calling: ${method} ${fullUrl}`);
        try {
          const res = await fetch(fullUrl, {
            ...init,
            headers: { ...customHeaders, ...(init?.headers || {}) },
          });

          const text = await res.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { raw: text };
          }

          tried.push({ url: fullUrl, method, status: res.status });
          // For prefix discovery: stop on success or on non-(404/405) so we can surface auth errors (401) quickly.
          if (res.ok || (res.status !== 404 && res.status !== 405)) {
            return { res, json, prefix, tried };
          }
        } catch (err) {
          console.error('[evolution-api] [custom] Network error calling Evolution API:', err);
          tried.push({ url: fullUrl, method });
        }
      }

      // If all prefixes were 404/405, return a synthetic 404 with tried list
      const res = new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      return { res, json: { error: 'Not Found' }, prefix: '', tried };
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

        const createTarget = await resolveEvolutionCredentials(instanceName);
        const createWithPrefixes = async (path: string, init?: RequestInit): Promise<{ res: Response; json: any; prefix: string }> => {
          for (const prefix of ROUTE_PREFIXES) {
            const endpoint = `${prefix}${path}`;
            const fullUrl = `${createTarget.baseUrl}${endpoint}`;
            const { res, json } = await fetchEvolutionRaw(fullUrl, {
              ...init,
              headers: { ...createTarget.headers, ...(init?.headers || {}) },
            });
            if (res.ok || (res.status !== 404 && res.status !== 405)) {
              return { res, json, prefix };
            }
          }
          const endpoint = `${ROUTE_PREFIXES[0]}${path}`;
          const fullUrl = `${createTarget.baseUrl}${endpoint}`;
          const { res, json } = await fetchEvolutionRaw(fullUrl, {
            ...init,
            headers: { ...createTarget.headers, ...(init?.headers || {}) },
          });
          return { res, json, prefix: '' };
        };

        // Evolution API route can vary by install/version; try common prefixes
        const { res, json, prefix } = await createWithPrefixes('/instance/create', {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });

        console.log(`[evolution-api] create-instance used prefix: "${prefix}" via ${createTarget.source}`);

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
        // Evolution API v2.x expects the webhook config nested inside a "webhook" property
        const { instanceName, webhookUrl, events } = body;

        if (!instanceName || !webhookUrl) {
          return new Response(
            JSON.stringify({ error: 'instanceName and webhookUrl are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Evolution API v2.x format - webhook config wrapped in "webhook" object
        const webhookPayload = {
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: true,
            webhookBase64: false,
            events: events || [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE',
              'QRCODE_UPDATED',
            ],
          },
        };

        // Try multiple endpoint formats for different Evolution API versions
        const endpoints = [
          `/webhook/set/${encodeURIComponent(instanceName)}`,
          `/instance/update/${encodeURIComponent(instanceName)}`,
        ];

        let lastRes: Response | null = null;
        let lastJson: any = null;

        for (const endpoint of endpoints) {
          const { res, json } = await fetchEvolutionJson(endpoint, {
            method: 'POST',
            body: JSON.stringify(webhookPayload),
          });
          
          lastRes = res;
          lastJson = json;

          if (res.ok) {
            console.log(`[evolution-api] Set webhook succeeded with endpoint: ${endpoint}`);
            break;
          }
          console.log(`[evolution-api] Set webhook failed with endpoint ${endpoint}: ${res.status}`, json);
        }

        console.log('[evolution-api] Set webhook final response:', lastJson);

        return new Response(
          JSON.stringify({ ...lastJson, _version: EVOLUTION_API_FUNC_VERSION }),
          { status: lastRes?.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sendText': {
        // Send text message (alias for send-text, used by frontend)
        const { instanceId, phone, message } = body;
        const digitsOnlyPhone = String(phone || '').replace(/\D/g, '');
        
        // Detect group JIDs (LID format starts with 120363 and is long)
        const isGroup = digitsOnlyPhone.startsWith('120363') && digitsOnlyPhone.length > 15;
        const numberToSend = isGroup ? `${digitsOnlyPhone}@g.us` : digitsOnlyPhone;
        
        // Get instance name AND custom API credentials from database
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: instance, error: instanceError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name, api_url, api_key')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use instance-specific API credentials if available, otherwise fall back to global
        const apiBaseUrl = instance.api_url ? normalizeBaseUrl(instance.api_url) : evolutionBaseUrl;
        const apiHeaders = instance.api_key ? buildEvolutionHeaders(instance.api_key) : evolutionHeaders;

        console.log(`[evolution-api] sendText using ${instance.api_url ? 'custom' : 'global'} credentials for instance ${instance.instance_name}, isGroup=${isGroup}`);

        const response = await fetch(`${apiBaseUrl}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            number: numberToSend,
            text: message,
          }),
        });

        const data = await response.json();
        console.log('[evolution-api] SendText response:', data);

        // Detect "Connection Closed" — instance disconnected on STEVO
        const dataStr = JSON.stringify(data);
        if (!response.ok && dataStr.toLowerCase().includes('connection closed')) {
          console.error('[evolution-api] WhatsApp instance connection closed');
          return new Response(
            JSON.stringify({
              error: 'Instância WhatsApp desconectada no servidor. Reconecte a instância antes de enviar mensagens.',
              connection_closed: true,
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If the number doesn't exist on WhatsApp, return a friendly error (200 with error field)
        if (!response.ok) {
          if (dataStr.includes('"exists":false') || dataStr.includes('"exists": false')) {
            return new Response(
              JSON.stringify({
                error: 'Este número não possui WhatsApp. Verifique se o telefone está correto.',
                number_not_found: true,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({ error: data?.message || 'Erro ao enviar mensagem', details: data }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sendMedia': {
        // Send media message (image, video, audio, document) - uses instance-specific credentials
        const { instanceId, phone, mediaType, mediaUrl, caption, fileName } = body;
        
        if (!instanceId || !phone || !mediaType || !mediaUrl) {
          return new Response(
            JSON.stringify({ error: 'instanceId, phone, mediaType, and mediaUrl are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance name AND custom API credentials from database
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: instance, error: instanceError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name, api_url, api_key')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use instance-specific API credentials if available
        const apiBaseUrl = instance.api_url ? normalizeBaseUrl(instance.api_url) : evolutionBaseUrl;
        const apiHeaders = instance.api_key ? buildEvolutionHeaders(instance.api_key) : evolutionHeaders;

        console.log(`[evolution-api] sendMedia using ${instance.api_url ? 'custom' : 'global'} credentials for instance ${instance.instance_name}`);

        // Map mediaType to Evolution API mediatype
        const mediatypeMap: Record<string, string> = {
          image: 'image',
          video: 'video',
          audio: 'audio',
          document: 'document',
        };

        // Detect group JIDs
        const phoneDigits = String(phone || '').replace(/\D/g, '');
        const isGroup = phoneDigits.startsWith('120363') && phoneDigits.length > 15;
        const numberToSend = isGroup 
          ? `${phoneDigits}@g.us` 
          : (phone.includes('@') ? phone : `${phoneDigits}@s.whatsapp.net`);

        const response = await fetch(`${apiBaseUrl}/message/sendMedia/${instance.instance_name}`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            number: numberToSend,
            mediatype: mediatypeMap[mediaType] || 'document',
            media: mediaUrl,
            caption: caption || '',
            fileName: fileName || '',
          }),
        });

        const data = await response.json();
        console.log('[evolution-api] sendMedia response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sendGroupText': {
        // Send text message to a WhatsApp group
        const { instanceId, groupId, message } = body;
        
        if (!instanceId || !groupId || !message) {
          return new Response(
            JSON.stringify({ error: 'instanceId, groupId, and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance name AND custom API credentials from database
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: instance, error: instanceError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name, api_url, api_key')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use instance-specific API credentials if available
        const apiBaseUrl = instance.api_url ? normalizeBaseUrl(instance.api_url) : evolutionBaseUrl;
        const apiHeaders = instance.api_key ? buildEvolutionHeaders(instance.api_key) : evolutionHeaders;

        console.log(`[evolution-api] sendGroupText using ${instance.api_url ? 'custom' : 'global'} credentials for instance ${instance.instance_name}`);
        console.log(`[evolution-api] sendGroupText to group: ${groupId}`);

        // Ensure groupId has the correct format (should end with @g.us)
        const formattedGroupId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;

        const response = await fetch(`${apiBaseUrl}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            number: formattedGroupId,
            text: message,
          }),
        });

        const data = await response.json();
        console.log('[evolution-api] sendGroupText response:', JSON.stringify(data).substring(0, 500));

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

        const statusTarget = await resolveEvolutionCredentials(instanceName);
        const { res, json } = await fetchEvolutionRaw(
          `${statusTarget.baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
          { method: 'GET', headers: statusTarget.headers }
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

      case 'list-instances-custom': {
        const { apiUrl, apiKey } = body;
        if (!apiUrl || !apiKey) {
          return new Response(
            JSON.stringify({ error: 'apiUrl and apiKey are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const managerUrlError = getStevoManagerUrlError(apiUrl);
        if (managerUrlError) {
          return new Response(
            JSON.stringify(managerUrlError),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { res, json, prefix, tried } = await fetchCustomWithPrefixes(
          apiUrl,
          '/instance/fetchInstances',
          apiKey,
          { method: 'GET' }
        );

        if (!res.ok) {
          return new Response(
            JSON.stringify(buildHandledEvolutionError(
              'Unable to list instances on custom Evolution API',
              res.status,
              json,
              { tried, prefix }
            )),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Some installs return { instances: [...] }
        const instances = Array.isArray(json) ? json : (Array.isArray(json?.instances) ? json.instances : []);
        return new Response(
          JSON.stringify({ instances, prefix, _version: EVOLUTION_API_FUNC_VERSION }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set-webhook-custom': {
        const { apiUrl, apiKey, instanceName, webhookUrl, events } = body;
        if (!apiUrl || !apiKey || !instanceName || !webhookUrl) {
          return new Response(
            JSON.stringify({ error: 'apiUrl, apiKey, instanceName and webhookUrl are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const managerUrlError = getStevoManagerUrlError(apiUrl);
        if (managerUrlError) {
          return new Response(
            JSON.stringify(managerUrlError),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const webhookPayload = {
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: true,
            webhookBase64: false,
            events: events || [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE',
              'QRCODE_UPDATED',
            ],
          },
        };

        const encName = encodeURIComponent(instanceName);

        // Different installs expose different endpoints; try a small, safe set.
        // NOTE: We keep POST as default and fallback to PUT for v2 installs.
        const attempts: Array<{ path: string; method: 'POST' | 'PUT' }> = [
          { path: `/webhook/set/${encName}`, method: 'POST' },
          { path: `/webhook/set/${encName}`, method: 'PUT' },
          { path: `/instance/update/${encName}`, method: 'POST' },
          { path: `/instance/update/${encName}`, method: 'PUT' },
        ];

        let last: { res: Response; json: any; prefix: string; tried: any[] } | null = null;
        for (const a of attempts) {
          const result = await fetchCustomWithPrefixes(apiUrl, a.path, apiKey, {
            method: a.method,
            body: JSON.stringify(webhookPayload),
          });

          last = result;
          if (result.res.ok) {
            return new Response(
              JSON.stringify({ success: true, prefix: result.prefix, _version: EVOLUTION_API_FUNC_VERSION }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify(buildHandledEvolutionError(
            'Unable to set webhook on custom Evolution API',
            last?.res.status,
            last?.json,
            { tried: last?.tried, prefix: last?.prefix }
          )),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'diagnose': {
        // Diagnose Evolution API configuration by testing multiple endpoints and prefixes
        const diagBaseUrl = body.customApiUrl ? normalizeBaseUrl(body.customApiUrl) : evolutionBaseUrl;
        const diagApiKey = body.customApiKey || EVOLUTION_API_KEY;
        console.log(`[evolution-api] Running diagnostics on ${diagBaseUrl}`);
        console.log(`[evolution-api] Using key prefix: ${diagApiKey?.substring(0, 6)}... (len=${diagApiKey?.length})`);
        
        const diagnostics: any = {
          baseUrl: diagBaseUrl,
          version: EVOLUTION_API_FUNC_VERSION,
          apiKeyPresent: !!diagApiKey,
          apiKeyPrefix: diagApiKey?.substring(0, 6),
          apiKeyLength: diagApiKey?.length,
          tests: [],
          authTests: [],
        };

        // Test root endpoint (no auth needed typically)
        try {
          const rootRes = await fetch(diagBaseUrl, { headers: { 'Content-Type': 'application/json' } });
          diagnostics.tests.push({
            endpoint: '/',
            status: rootRes.status,
            ok: rootRes.ok,
          });
          await rootRes.text();
        } catch (e) {
          diagnostics.tests.push({ endpoint: '/', error: String(e) });
        }

        // Test different auth header formats individually
        const authFormats = [
          { name: 'apikey-only', headers: { 'Content-Type': 'application/json', apikey: diagApiKey! } },
          { name: 'bearer-only', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${diagApiKey}` } },
          { name: 'x-api-key-only', headers: { 'Content-Type': 'application/json', 'x-api-key': diagApiKey! } },
          { name: 'all-combined', headers: buildEvolutionHeaders(diagApiKey!) },
        ];

        for (const fmt of authFormats) {
          const testUrl = `${diagBaseUrl}/instance/fetchInstances`;
          try {
            const res = await fetch(testUrl, { method: 'GET', headers: fmt.headers });
            const text = await res.text();
            let parsed: any = null;
            try { parsed = JSON.parse(text); } catch { parsed = text.substring(0, 200); }
            diagnostics.authTests.push({
              format: fmt.name,
              status: res.status,
              ok: res.ok,
              isArray: Array.isArray(parsed),
              preview: typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 300) : String(parsed).substring(0, 300),
            });
          } catch (e) {
            diagnostics.authTests.push({ format: fmt.name, error: String(e) });
          }
        }

        // Test different route prefixes with fetchInstances
        const diagHeaders = buildEvolutionHeaders(diagApiKey!);
        for (const prefix of ROUTE_PREFIXES) {
          const testEndpoint = `${diagBaseUrl}${prefix}/instance/fetchInstances`;
          try {
            const res = await fetch(testEndpoint, { method: 'GET', headers: diagHeaders });
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
          const testEndpoint = `${diagBaseUrl}${prefix}/instance/list`;
          try {
            const res = await fetch(testEndpoint, { method: 'GET', headers: diagHeaders });
            diagnostics.tests.push({
              endpoint: `${prefix}/instance/list`,
              status: res.status,
              ok: res.ok,
            });
            if (res.ok && !diagnostics.workingPrefix) {
              diagnostics.workingPrefix = prefix;
            }
            await res.text();
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
        const { instanceName, text, delay } = body;
        // Normalize BR phone: ensure 55 prefix
        const rawNumber = String(body.number || '').replace(/\D/g, '');
        const number = rawNumber.startsWith('55') ? rawNumber : `55${rawNumber}`;
        
        if (!instanceName || !rawNumber || !text) {
          return new Response(
            JSON.stringify({ error: 'instanceName, number, and text are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sendTextTarget = await resolveEvolutionCredentials(instanceName);
        const sendTextBaseUrl = sendTextTarget.baseUrl;
        const sendTextHeaders = sendTextTarget.headers;

        console.log(`[evolution-api] send-text using ${sendTextTarget.source} credentials for instance ${instanceName}`);

        const sendTextController = new AbortController();
        const sendTextTimeout = setTimeout(() => sendTextController.abort(), 25000);
        let response: Response;
        try {
          response = await fetch(`${sendTextBaseUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: sendTextHeaders,
            signal: sendTextController.signal,
            body: JSON.stringify({
              number,
              text,
              delay: delay || 0,
            }),
          });
        } catch (fetchErr: any) {
          clearTimeout(sendTextTimeout);
          if (fetchErr.name === 'AbortError') {
            console.error('[evolution-api] send-text timed out after 25s');
            return new Response(
              JSON.stringify({
                accepted: true,
                pending: true,
                timed_out: true,
                instanceName,
                number,
                message: 'Timeout: o servidor WhatsApp não respondeu a tempo. A mensagem pode ter sido enviada.',
              }),
              { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw fetchErr;
        }
        clearTimeout(sendTextTimeout);

        const data = await response.json();
        console.log('[evolution-api] Send text response:', data);

        // Detect "Connection Closed" from Evolution API — means instance is disconnected
        const dataStr = JSON.stringify(data);
        if (!response.ok && dataStr.toLowerCase().includes('connection closed')) {
          console.error('[evolution-api] WhatsApp instance connection closed');
          return new Response(
            JSON.stringify({
              error: 'Instância WhatsApp desconectada no servidor. Reconecte a instância antes de enviar mensagens.',
              connection_closed: true,
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: response.ok ? 200 : response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

        const sendMediaTarget = await resolveEvolutionCredentials(instanceName);
        const response = await fetch(`${sendMediaTarget.baseUrl}/message/sendMedia/${instanceName}`, {
          method: 'POST',
          headers: sendMediaTarget.headers,
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

        const deleteTarget = await resolveEvolutionCredentials(instanceName);
        const deleteBaseUrl = deleteTarget.baseUrl;
        const deleteHeaders = deleteTarget.headers;

        const response = await fetch(`${deleteBaseUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: deleteHeaders,
        });

        const data = await response.json();
        console.log('[evolution-api] Delete instance response:', data);

        // If instance doesn't exist in Evolution API (404) or auth fails (401/403), still return success
        // This allows cleaning up stale DB records when credentials are invalid
        if (response.status === 404 || response.status === 401 || response.status === 403) {
          console.log(`[evolution-api] Instance returned ${response.status}, returning success for DB cleanup`);
          return new Response(
            JSON.stringify({ 
              status: 'SUCCESS', 
              message: `Evolution API returned ${response.status}. Instance can be deleted from DB.`,
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

      case 'fetchGroups': {
        // Fetch all groups from a WhatsApp instance
        const { instanceId } = body;
        
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'instanceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance credentials from database
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: instance, error: instanceError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name, api_url, api_key')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use instance-specific API credentials if available
        const apiBaseUrl = instance.api_url ? normalizeBaseUrl(instance.api_url) : evolutionBaseUrl;
        const apiHeaders = instance.api_key ? buildEvolutionHeaders(instance.api_key) : evolutionHeaders;

        console.log(`[evolution-api] fetchGroups using ${instance.api_url ? 'custom' : 'global'} credentials for instance ${instance.instance_name}`);

        const { lastRes, lastData } = await fetchGroupsFromInstance(apiBaseUrl, apiHeaders, instance.instance_name);

        console.log('[evolution-api] fetchGroups response:', JSON.stringify(lastData).substring(0, 500));

        return new Response(
          JSON.stringify(lastData || { error: 'Failed to fetch groups' }),
          { status: lastRes?.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'syncGroups': {
        const { instanceId } = body;

        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'instanceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const canView = await userCanViewWhatsAppInstance(supabaseService, user.id, instanceId);
        if (!canView) {
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: instance, error: instanceError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name, api_url, api_key')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const apiBaseUrl = instance.api_url ? normalizeBaseUrl(instance.api_url) : evolutionBaseUrl;
        const apiHeaders = instance.api_key ? buildEvolutionHeaders(instance.api_key) : evolutionHeaders;
        const { lastRes, lastData } = await fetchGroupsFromInstance(apiBaseUrl, apiHeaders, instance.instance_name);

        if (!lastRes?.ok) {
          return new Response(
            JSON.stringify(lastData || { error: 'Failed to fetch groups' }),
            { status: lastRes?.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const syncResult = await syncGroupsToConversations(supabaseService, instanceId, lastData);

        return new Response(
          JSON.stringify({ success: true, ...syncResult }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sendGroupText': {
        // Send text message to a WhatsApp group
        const { instanceId, groupJid, message } = body;
        
        if (!instanceId || !groupJid || !message) {
          return new Response(
            JSON.stringify({ error: 'instanceId, groupJid, and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance credentials from database
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: instance, error: instanceError } = await supabaseService
          .from('whatsapp_instances')
          .select('instance_name, api_url, api_key')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use instance-specific API credentials if available
        const apiBaseUrl = instance.api_url ? normalizeBaseUrl(instance.api_url) : evolutionBaseUrl;
        const apiHeaders = instance.api_key ? buildEvolutionHeaders(instance.api_key) : evolutionHeaders;

        console.log(`[evolution-api] sendGroupText to ${groupJid} using ${instance.api_url ? 'custom' : 'global'} credentials`);

        // Format groupJid - ensure it has @g.us suffix
        const formattedJid = groupJid.includes('@') ? groupJid : `${groupJid}@g.us`;

        const response = await fetch(`${apiBaseUrl}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            number: formattedJid,
            text: message,
          }),
        });

        const data = await response.json();
        console.log('[evolution-api] sendGroupText response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
              'list-instances-custom',
              'set-webhook-custom',
              'send-text',
              'sendText',
              'send-media',
              'set-webhook',
              'delete-instance',
              'logout',
              'restart',
              'diagnose',
              'fetchGroups',
              'syncGroups',
              'sendGroupText'
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
