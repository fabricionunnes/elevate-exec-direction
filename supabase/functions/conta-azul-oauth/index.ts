import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTA_AZUL_AUTH_URL = "https://auth.contaazul.com/login";
const CONTA_AZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("CONTA_AZUL_CLIENT_ID");
    const clientSecret = Deno.env.get("CONTA_AZUL_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Conta Azul credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    let action = url.searchParams.get("action");
    let returnUrl = "";
    
    // Also check request body for action and returnUrl
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.action) action = body.action;
        if (body?.returnUrl) returnUrl = body.returnUrl;
      } catch {
        // No valid JSON body
      }
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    // ACTION: Get OAuth authorization URL
    if (action === "get-auth-url") {
      // Use returnUrl from body (already extracted above), fallback to headers
      if (!returnUrl) {
        returnUrl = req.headers.get("origin") || req.headers.get("referer") || "";
      }
      
      // Clean up return URL
      if (returnUrl) {
        try {
          const urlObj = new URL(returnUrl);
          returnUrl = urlObj.origin;
        } catch {
          returnUrl = "";
        }
      }
      
      const redirectUri = `${supabaseUrl}/functions/v1/conta-azul-callback`;
      const state = crypto.randomUUID();
      
      // Store state and return URL for callback
      await supabase.from("financial_integrations").upsert({
        integration_type: "conta_azul",
        config: { oauth_state: state, return_url: returnUrl },
        sync_status: "pending_auth",
        is_active: false
      }, { onConflict: "integration_type" });

      const scope = "openid+profile+aws.cognito.signin.user.admin";
      const authUrl = `${CONTA_AZUL_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;
      
      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: Check connection status
    if (action === "status") {
      const { data: integration } = await supabase
        .from("financial_integrations")
        .select("*")
        .eq("integration_type", "conta_azul")
        .single();

      return new Response(
        JSON.stringify({ 
          connected: integration?.is_active || false,
          lastSync: integration?.last_sync_at,
          status: integration?.sync_status
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: Disconnect
    if (action === "disconnect") {
      await supabase
        .from("financial_integrations")
        .update({ 
          is_active: false, 
          config: {},
          sync_status: "disconnected"
        })
        .eq("integration_type", "conta_azul");

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: Sync data from Conta Azul
    if (action === "sync") {
      const { data: integration } = await supabase
        .from("financial_integrations")
        .select("*")
        .eq("integration_type", "conta_azul")
        .eq("is_active", true)
        .single();

      if (!integration) {
        return new Response(
          JSON.stringify({ error: "Conta Azul not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const config = integration.config as any;
      let accessToken = config?.access_token;

      // Check if token needs refresh
      if (config?.expires_at && new Date(config.expires_at) < new Date()) {
        console.log("Token expired, refreshing...");
        const refreshResult = await refreshToken(clientId, clientSecret, config.refresh_token);
        if (refreshResult.error) {
          await supabase
            .from("financial_integrations")
            .update({ 
              sync_status: "error",
              sync_error: "Token refresh failed"
            })
            .eq("integration_type", "conta_azul");
          
          return new Response(
            JSON.stringify({ error: "Token refresh failed" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessToken = refreshResult.access_token;
        
        await supabase
          .from("financial_integrations")
          .update({
            config: {
              ...config,
              access_token: refreshResult.access_token,
              refresh_token: refreshResult.refresh_token || config.refresh_token,
              expires_at: new Date(Date.now() + refreshResult.expires_in * 1000).toISOString()
            }
          })
          .eq("integration_type", "conta_azul");
      }

      // Update sync status
      await supabase
        .from("financial_integrations")
        .update({ sync_status: "syncing" })
        .eq("integration_type", "conta_azul");

      try {
        // Sync pessoas (customers)
        const pessoasResult = await syncCustomers(supabase, accessToken);
        console.log("Pessoas synced:", pessoasResult);

        // Sync receivables (contas a receber)
        const receivablesResult = await syncReceivables(supabase, accessToken);
        console.log("Receivables synced:", receivablesResult);

        // Sync payables (contas a pagar)
        const payablesResult = await syncPayables(supabase, accessToken);
        console.log("Payables synced:", payablesResult);

        await supabase
          .from("financial_integrations")
          .update({ 
            sync_status: "synced",
            last_sync_at: new Date().toISOString(),
            sync_error: null
          })
          .eq("integration_type", "conta_azul");

        return new Response(
          JSON.stringify({ 
            success: true, 
            pessoas: pessoasResult,
            receivables: receivablesResult,
            payables: payablesResult
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (syncError: any) {
        console.error("Sync error:", syncError);
        
        await supabase
          .from("financial_integrations")
          .update({ 
            sync_status: "error",
            sync_error: syncError.message
          })
          .eq("integration_type", "conta_azul");

        return new Response(
          JSON.stringify({ error: syncError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function refreshToken(clientId: string, clientSecret: string, refreshToken: string) {
  const response = await fetch(CONTA_AZUL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    return { error: true };
  }

  return await response.json();
}

async function syncCustomers(supabase: any, accessToken: string) {
  console.log("Fetching pessoas from Conta Azul API v2...");
  const response = await fetch("https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=100", {
    headers: { 
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  console.log("Pessoas response status:", response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Pessoas error:", errorText);
    // Don't throw, just log - pessoas might not have data
    console.log("Pessoas API returned error, skipping...");
    return { total: 0, synced: 0 };
  }

  const data = await response.json();
  const pessoas = data.itens || [];
  let synced = 0;

  for (const pessoa of pessoas) {
    console.log("Pessoa:", pessoa.nome);
    synced++;
  }

  return { total: pessoas.length, synced };
}

async function syncReceivables(supabase: any, accessToken: string) {
  console.log("Fetching contas a receber from Conta Azul API v2...");
  
  // Get dates for a very wide range (5 years ago to 5 years ahead)
  const today = new Date();
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const fiveYearsAhead = new Date();
  fiveYearsAhead.setFullYear(fiveYearsAhead.getFullYear() + 5);
  
  const dateFrom = fiveYearsAgo.toISOString().split('T')[0];
  const dateTo = fiveYearsAhead.toISOString().split('T')[0];
  
  const url = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?pagina=1&tamanho_pagina=100&data_vencimento_de=${dateFrom}&data_vencimento_ate=${dateTo}`;
  
  console.log("Receivables URL:", url);
  
  const response = await fetch(url, {
    headers: { 
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  console.log("Receivables response status:", response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Receivables error:", errorText);
    console.log("Receivables API returned error, skipping...");
    return { total: 0, synced: 0 };
  }

  const data = await response.json();
  console.log("Receivables raw response keys:", Object.keys(data));
  console.log("Receivables itens_totais:", data.itens_totais);
  
  // API returns 'itens' not 'items'
  const receivables = data.itens || data.items || [];
  let synced = 0;

  console.log("Found receivables:", receivables.length);
  if (receivables.length > 0) {
    console.log("First receivable sample:", JSON.stringify(receivables[0]).substring(0, 500));
  }

  for (const item of receivables) {
    // Map status from Conta Azul to our system
    let status = "pending";
    if (item.status === "RECEBIDO" || item.status === "RECEBIDO_PARCIAL") {
      status = "paid";
    } else if (item.status === "ATRASADO") {
      status = "overdue";
    } else if (item.status === "PERDIDO" || item.status === "RENEGOCIADO") {
      status = "cancelled";
    } else if (item.status === "EM_ABERTO") {
      status = "pending";
    }

    const result = await supabase.from("financial_receivables").upsert({
      conta_azul_id: item.id || item.id_parcela,
      description: item.descricao || item.observacao || `Recebível Conta Azul`,
      amount: item.valor_bruto || item.valor || 0,
      due_date: item.data_vencimento || new Date().toISOString().split('T')[0],
      status: status,
      paid_amount: item.valor_pago || null,
      paid_date: item.data_pagamento || null,
      company_id: null,
      is_recurring: false
    }, { onConflict: "conta_azul_id" });
    
    if (result.error) {
      console.error("Error upserting receivable:", result.error);
    } else {
      synced++;
    }
  }

  return { total: receivables.length, synced };
}

async function syncPayables(supabase: any, accessToken: string) {
  console.log("Fetching contas a pagar from Conta Azul API v2...");
  
  // Get dates for a very wide range (5 years ago to 5 years ahead)
  const today = new Date();
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const fiveYearsAhead = new Date();
  fiveYearsAhead.setFullYear(fiveYearsAhead.getFullYear() + 5);
  
  const dateFrom = fiveYearsAgo.toISOString().split('T')[0];
  const dateTo = fiveYearsAhead.toISOString().split('T')[0];
  
  const url = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?pagina=1&tamanho_pagina=100&data_vencimento_de=${dateFrom}&data_vencimento_ate=${dateTo}`;
  
  console.log("Payables URL:", url);
  
  const response = await fetch(url, {
    headers: { 
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  console.log("Payables response status:", response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log("Payables API returned error:", errorText);
    return { total: 0, synced: 0 };
  }

  const data = await response.json();
  console.log("Payables raw response keys:", Object.keys(data));
  console.log("Payables itens_totais:", data.itens_totais);
  
  // API returns 'itens' not 'items'
  const payables = data.itens || data.items || [];
  let synced = 0;

  console.log("Found payables:", payables.length);
  if (payables.length > 0) {
    console.log("First payable sample:", JSON.stringify(payables[0]).substring(0, 500));
  }

  for (const item of payables) {
    // Map status from Conta Azul to our system
    let status = "pending";
    if (item.status === "RECEBIDO" || item.status === "PAGO" || item.status === "RECEBIDO_PARCIAL") {
      status = "paid";
    } else if (item.status === "ATRASADO") {
      status = "overdue";
    } else if (item.status === "PERDIDO" || item.status === "RENEGOCIADO") {
      status = "cancelled";
    } else if (item.status === "EM_ABERTO") {
      status = "pending";
    }

    const result = await supabase.from("financial_payables").upsert({
      conta_azul_id: item.id || item.id_parcela,
      description: item.descricao || item.observacao || `Pagável Conta Azul`,
      supplier_name: item.contato_nome || item.contato?.nome || "Fornecedor",
      amount: item.valor_bruto || item.valor || 0,
      due_date: item.data_vencimento || new Date().toISOString().split('T')[0],
      status: status,
      paid_amount: item.valor_pago || null,
      paid_date: item.data_pagamento || null
    }, { onConflict: "conta_azul_id" });
    
    if (result.error) {
      console.error("Error upserting payable:", result.error);
    } else {
      synced++;
    }
  }

  return { total: payables.length, synced };
}
