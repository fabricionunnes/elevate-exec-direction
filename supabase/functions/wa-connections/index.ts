import { createClient } from "npm:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const WA_URL = (Deno.env.get("WA_SERVER_URL") || "https://187-77-49-228.sslip.io").replace(/\/+$/, "");
const WA_KEY = Deno.env.get("WA_SERVER_KEY") || "";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (payload, status = 200)=>new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
const isStevo = (u)=>(u || "").includes("stevo");
async function evo(path, init) {
  return await fetch(`${WA_URL}${path}`, {
    ...init,
    headers: {
      apikey: WA_KEY,
      "Content-Type": "application/json",
      ...init?.headers || {}
    }
  });
}
// Estado de uma instância no servidor onde ela mora (dialeto por URL).
async function liveState(apiUrl, apiKey, name) {
  try {
    // Sem timeout, um servidor pendurado (Stevo em migração, VPS lenta) trava a
    // tela de Conexões inteira — o fetch fica aberto pra sempre.
    if (isStevo(apiUrl)) {
      const r = await fetch(`${apiUrl}/instance/status`, {
        headers: {
          apikey: apiKey
        },
        signal: AbortSignal.timeout(6000)
      });
      if (!r.ok) return "unknown";
      const d = await r.json().catch(()=>({}));
      const st = d?.data ?? d;
      return st?.Connected === true || st?.connected === true || st?.state === "open" ? "open" : "close";
    }
    const r = await fetch(`${apiUrl}/instance/connectionState/${name}`, {
      headers: {
        apikey: apiKey
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!r.ok) return "unknown";
    const d = await r.json().catch(()=>({}));
    return d?.instance?.state || "unknown";
  } catch  {
    return "unreachable";
  }
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: CORS
  });
  if (req.method !== "POST") return json({
    error: "método inválido"
  }, 405);
  // ── Autenticação: JWT do usuário → staff ativo master/admin ──
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({
    error: "não autenticado"
  }, 401);
  const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!ur.ok) return json({
    error: "sessão inválida"
  }, 401);
  const user = await ur.json();
  const { data: staff } = await supabase.from("onboarding_staff").select("id, role, is_active").eq("user_id", user.id).maybeSingle();
  if (!staff?.is_active) return json({
    error: "acesso restrito"
  }, 403);
  // Regra do Fabrício (04/08/2026): SÓ o master enxerga todas as instâncias.
  // Admin também fica restrito ao que estiver liberado pra ele em Acessos —
  // ele administra (cria/exclui/dá acesso), mas só do que já enxerga.
  const isMaster = staff.role === "master";
  const isAdmin = [
    "master",
    "admin"
  ].includes(staff.role);
  const body = await req.json().catch(()=>({}));
  const action = String(body.action || "");
  const name = String(body.instance_name || "").trim();
  // Não-admin (self-service no CRM): só enxerga/conecta as instâncias liberadas
  // em Acessos (whatsapp_instance_access.can_view). Criar/excluir segue só admin.
  let allowedIds = null;
  if (!isMaster) {
    if ([
      "create",
      "delete"
    ].includes(action) && !isAdmin) {
      return json({
        error: "acesso restrito a administradores"
      }, 403);
    }
    const { data: acc } = await supabase.from("whatsapp_instance_access").select("instance_id").eq("staff_id", staff.id).eq("can_view", true);
    allowedIds = new Set((acc || []).map((a)=>a.instance_id));
  }
  const canTouch = (rowId)=>!allowedIds || (rowId ? allowedIds.has(rowId) : false);
  try {
    // ── status-all: estado ao vivo de todas as instâncias + sincroniza rows ──
    if (action === "status-all") {
      const { data: rows } = await supabase.from("whatsapp_instances").select("id, instance_name, display_name, phone_number, status, api_url, api_key, is_default").order("instance_name");
      // ownerJid das instâncias do servidor próprio (preenche o número)
      let owners = new Map();
      try {
        const fr = await evo(`/instance/fetchInstances`);
        if (fr.ok) {
          const list = await fr.json();
          owners = new Map((Array.isArray(list) ? list : []).map((i)=>[
              i.name || "",
              (i.ownerJid || "").split("@")[0]
            ]));
        }
      } catch  {}
      // consultas em paralelo: sequencial, 10 instâncias x timeout viravam
      // mais de um minuto de tela branca quando um servidor não respondia
      const out = await Promise.all((rows || []).filter((r)=>canTouch(r.id)).map(async (r)=>{
        // Migração pendente: row no Stevo mas a instância homônima JÁ conectou no
        // servidor próprio (QR escaneado com o diálogo fechado) → vira a row aqui.
        let apiUrl = r.api_url || WA_URL, apiKey = r.api_key || WA_KEY;
        if (isStevo(apiUrl)) {
          const waState = await liveState(WA_URL, WA_KEY, r.instance_name);
          if (waState === "open") {
            await supabase.from("whatsapp_instances").update({
              api_url: WA_URL,
              api_key: WA_KEY,
              provider_type: "evolution",
              status: "connected",
              updated_at: new Date().toISOString()
            }).eq("id", r.id);
            apiUrl = WA_URL;
            apiKey = WA_KEY;
          }
        }
        const state = await liveState(apiUrl, apiKey, r.instance_name);
        const status = state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
        const phone = owners.get(r.instance_name) || r.phone_number;
        if (status !== r.status || phone && phone !== r.phone_number) {
          await supabase.from("whatsapp_instances").update({
            status,
            phone_number: phone || r.phone_number,
            updated_at: new Date().toISOString()
          }).eq("id", r.id);
        }
        return {
          ...r,
          api_key: undefined,
          status,
          state,
          phone_number: phone,
          server: isStevo(apiUrl) ? "stevo" : "unv"
        };
      }));
      return json({
        instances: out
      });
    }
    // ── create: nova instância no servidor próprio + row no Nexus ──
    if (action === "create") {
      if (!/^[a-z0-9][a-z0-9-]{2,30}$/.test(name)) {
        return json({
          error: "nome inválido: use letras minúsculas, números e hífen (3-31 caracteres)"
        }, 400);
      }
      const display = String(body.display_name || name).trim();
      const cr = await evo(`/instance/create`, {
        method: "POST",
        body: JSON.stringify({
          instanceName: name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true
        })
      });
      const cd = await cr.json().catch(()=>({}));
      if (!cr.ok && !String(cd?.response?.message || cd?.message || "").includes("already")) {
        return json({
          error: `servidor recusou: ${JSON.stringify(cd).slice(0, 200)}`
        }, 502);
      }
      // Conversas entram no Atendimento (WhatsApp Hub) via evolution-webhook
      await evo(`/webhook/set/${name}`, {
        method: "POST",
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: `${SUPABASE_URL}/functions/v1/evolution-webhook`,
            events: [
              "MESSAGES_UPSERT"
            ],
            byEvents: false,
            base64: false
          }
        })
      }).catch(()=>{});
      const { error } = await supabase.from("whatsapp_instances").upsert({
        instance_name: name,
        display_name: display,
        api_url: WA_URL,
        api_key: WA_KEY,
        provider_type: "evolution",
        status: "disconnected",
        created_by: staff.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "instance_name"
      });
      if (error) return json({
        error: `row: ${error.message}`
      }, 500);
      return json({
        ok: true,
        instance_name: name
      });
    }
    // ── qr: pareamento. Row ainda no Stevo = MIGRAÇÃO: garante instância
    // HOMÔNIMA no servidor próprio (mesmo nome ⇒ automações não mudam) + webhook,
    // mostra o QR; a virada da row acontece no action "status" quando conectar. ──
    if (action === "qr") {
      if (!name) return json({
        error: "instance_name obrigatório"
      }, 400);
      const { data: row } = await supabase.from("whatsapp_instances").select("id, api_url").eq("instance_name", name).maybeSingle();
      if (!canTouch(row?.id)) return json({
        error: "sem acesso a esta instância"
      }, 403);
      if (row?.api_url && isStevo(row.api_url)) {
        const st0 = await liveState(WA_URL, WA_KEY, name);
        if (st0 === "unknown" || st0 === "unreachable") {
          await evo(`/instance/create`, {
            method: "POST",
            body: JSON.stringify({
              instanceName: name,
              integration: "WHATSAPP-BAILEYS",
              qrcode: true
            })
          }).catch(()=>{});
        }
        await evo(`/webhook/set/${name}`, {
          method: "POST",
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: `${SUPABASE_URL}/functions/v1/evolution-webhook`,
              events: [
                "MESSAGES_UPSERT"
              ],
              byEvents: false,
              base64: false
            }
          })
        }).catch(()=>{});
      }
      const st = await liveState(WA_URL, WA_KEY, name);
      if (st === "open") return json({
        connected: true
      });
      const qr = await evo(`/instance/connect/${name}`);
      const qd = await qr.json().catch(()=>({}));
      if (!qr.ok) return json({
        error: `QR: ${JSON.stringify(qd).slice(0, 150)}`
      }, 502);
      return json({
        base64: qd.base64 || null,
        pairingCode: qd.pairingCode || null,
        connected: false
      });
    }
    // ── status: uma instância. Se ela abriu no servidor PRÓPRIO e a row ainda
    // aponta pro Stevo, a migração terminou: vira a row aqui, sem passo manual. ──
    if (action === "status") {
      const { data: row } = await supabase.from("whatsapp_instances").select("id, api_url, api_key").eq("instance_name", name).maybeSingle();
      if (!canTouch(row?.id)) return json({
        error: "sem acesso a esta instância"
      }, 403);
      const waState = await liveState(WA_URL, WA_KEY, name);
      if (waState === "open") {
        if (row && isStevo(row.api_url || "")) {
          await supabase.from("whatsapp_instances").update({
            api_url: WA_URL,
            api_key: WA_KEY,
            provider_type: "evolution",
            status: "connected",
            updated_at: new Date().toISOString()
          }).eq("id", row.id);
        } else {
          await supabase.from("whatsapp_instances").update({
            status: "connected",
            updated_at: new Date().toISOString()
          }).eq("instance_name", name);
        }
        return json({
          state: "open"
        });
      }
      const state = row ? await liveState(row.api_url || WA_URL, row.api_key || WA_KEY, name) : waState;
      return json({
        state
      });
    }
    // ── restart: religa a sessão (dialeto conforme o servidor da row) ──
    if (action === "restart") {
      const { data: row } = await supabase.from("whatsapp_instances").select("id, api_url, api_key").eq("instance_name", name).maybeSingle();
      if (!canTouch(row?.id)) return json({
        error: "sem acesso a esta instância"
      }, 403);
      const url = row?.api_url || WA_URL, key = row?.api_key || WA_KEY;
      const r = isStevo(url) ? await fetch(`${url}/instance/reconnect`, {
        method: "POST",
        headers: {
          apikey: key,
          "Content-Type": "application/json"
        },
        body: "{}"
      }) : await fetch(`${url}/instance/restart/${name}`, {
        method: "POST",
        headers: {
          apikey: key
        }
      });
      return json({
        ok: r.ok,
        status: r.status
      });
    }
    // ── delete: remove do servidor próprio + row (instância Stevo: só a row) ──
    if (action === "delete") {
      const { data: row } = await supabase.from("whatsapp_instances").select("id, api_url").eq("instance_name", name).maybeSingle();
      if (!row) return json({
        error: "instância não encontrada"
      }, 404);
      if (!isStevo(row.api_url || "")) {
        await evo(`/instance/logout/${name}`, {
          method: "DELETE"
        }).catch(()=>{});
        await evo(`/instance/delete/${name}`, {
          method: "DELETE"
        }).catch(()=>{});
      }
      await supabase.from("whatsapp_instances").delete().eq("id", row.id);
      return json({
        ok: true
      });
    }
    return json({
      error: `ação desconhecida: ${action}`
    }, 400);
  } catch (e) {
    return json({
      error: String(e).slice(0, 300)
    }, 500);
  }
});