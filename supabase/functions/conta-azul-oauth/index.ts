import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTA_AZUL_AUTH_URL = "https://api.contaazul.com/auth/authorize";
const CONTA_AZUL_TOKEN_URL = "https://api.contaazul.com/oauth2/token";

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
    const action = url.searchParams.get("action");

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
      // Get return URL from request body or headers
      let returnUrl = "";
      try {
        const body = await req.json();
        returnUrl = body?.returnUrl || "";
      } catch {
        // No body, try headers
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

      const authUrl = `${CONTA_AZUL_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=sales&state=${state}`;
      
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
        // Sync customers
        const customersResult = await syncCustomers(supabase, accessToken);
        console.log("Customers synced:", customersResult);

        // Sync sales/receivables
        const salesResult = await syncSales(supabase, accessToken);
        console.log("Sales synced:", salesResult);

        // Sync purchases/payables  
        const purchasesResult = await syncPurchases(supabase, accessToken);
        console.log("Purchases synced:", purchasesResult);

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
            customers: customersResult,
            sales: salesResult,
            purchases: purchasesResult
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
  const response = await fetch("https://api.contaazul.com/v1/customers", {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch customers: ${response.status}`);
  }

  const customers = await response.json();
  let synced = 0;

  for (const customer of customers) {
    // Map to our companies table or a separate sync table
    console.log("Customer:", customer.name);
    synced++;
  }

  return { total: customers.length, synced };
}

async function syncSales(supabase: any, accessToken: string) {
  const response = await fetch("https://api.contaazul.com/v1/sales", {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sales: ${response.status}`);
  }

  const sales = await response.json();
  let synced = 0;

  for (const sale of sales) {
    // Create receivable from sale
    await supabase.from("financial_receivables").upsert({
      conta_azul_id: sale.id,
      description: sale.notes || `Venda #${sale.number}`,
      amount: sale.total,
      due_date: sale.due_date || sale.emission,
      status: sale.status === "COMMITTED" ? "pending" : "paid",
      company_id: null, // Could map via customer
      is_recurring: false
    }, { onConflict: "conta_azul_id" });
    synced++;
  }

  return { total: sales.length, synced };
}

async function syncPurchases(supabase: any, accessToken: string) {
  const response = await fetch("https://api.contaazul.com/v1/purchases", {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    // Purchases API might not be available in all plans
    console.log("Purchases API not available or error");
    return { total: 0, synced: 0 };
  }

  const purchases = await response.json();
  let synced = 0;

  for (const purchase of purchases) {
    await supabase.from("financial_payables").upsert({
      conta_azul_id: purchase.id,
      description: purchase.notes || `Compra #${purchase.number}`,
      supplier_name: purchase.supplier?.name || "Fornecedor",
      amount: purchase.total,
      due_date: purchase.due_date || purchase.emission,
      status: purchase.status === "COMMITTED" ? "pending" : "paid"
    }, { onConflict: "conta_azul_id" });
    synced++;
  }

  return { total: purchases.length, synced };
}
