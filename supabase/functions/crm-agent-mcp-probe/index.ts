// deno-lint-ignore-file no-explicit-any
// @ts-nocheck  (o bloco MCP abaixo é o mesmo de crm-agent-respond, sem tipos)
//
// Teste de conexão de um servidor MCP cadastrado nos Agentes de IA do CRM.
// Só master/admin (valida o JWT do staff). Lê o servidor PELO ID no banco, com
// service_role: o segredo nunca passa pelo navegador nem volta na resposta.
// Faz initialize + tools/list, grava o que o servidor oferece (tools_cache) e o
// resultado do teste, e devolve a lista pra tela marcar o que libera.
//
// POST { server_id }  ->  { ok, server, tools: [{ name, description }], allowed_tools }
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ═════════════════════════════════════════════════════════════════════════════
// MCP: cliente mínimo de ferramentas externas (HTTP "streamable", JSON-RPC 2.0).
// ATENÇÃO: este bloco é IGUAL em crm-agent-respond e crm-agent-mcp-probe (cada edge
// function sobe com um arquivo só). Mexeu em um, copie pro outro.
// Segurança: só https na porta 443, nada de IP direto, localhost, rede privada ou
// link-local (SSRF), sem seguir redirecionamento, tempo e tamanho limitados, e o
// segredo nunca vai pra log nem pra mensagem de erro.
// ═════════════════════════════════════════════════════════════════════════════
const MCP_PROTOCOLO = "2025-06-18";
const MCP_MAX_BYTES = 262144; // teto da resposta bruta do servidor (256 KB)
const MCP_MAX_FERRAMENTAS = 40; // por servidor
const MCP_MAX_SCHEMA = 6000; // caracteres do input_schema de uma ferramenta
const MCP_HOST_BLOQUEADO = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|arpa|test|invalid|example|onion)$/i;
function mcpIpv4Privado(ip) {
  const p = String(ip).split(".").map((x)=>parseInt(x, 10));
  if (p.length !== 4 || p.some((x)=>!Number.isInteger(x) || x < 0 || x > 255)) return true; // malformado = bloqueia
  const [a, b, c] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local (metadados de nuvem)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // multicast e reservado
  return false;
}
function mcpIpv6Privado(ip) {
  let s = String(ip).toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  // final em IPv4 pontuado (::ffff:1.2.3.4)
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const o = v4[1].split(".").map((x)=>parseInt(x, 10));
    if (o.some((x)=>!(x >= 0 && x <= 255))) return true;
    s = s.slice(0, s.length - v4[1].length) + `${(o[0] << 8 | o[1]).toString(16)}:${(o[2] << 8 | o[3]).toString(16)}`;
  }
  const lados = s.split("::");
  if (lados.length > 2) return true;
  const esq = lados[0] ? lados[0].split(":") : [];
  const dir = lados.length === 2 && lados[1] ? lados[1].split(":") : [];
  const falta = 8 - esq.length - dir.length;
  if (lados.length === 1 ? esq.length !== 8 : falta < 1) return true;
  const g = [
    ...esq,
    ...Array(lados.length === 2 ? falta : 0).fill("0"),
    ...dir
  ].map((x)=>parseInt(x, 16));
  if (g.length !== 8 || g.some((x)=>!Number.isInteger(x) || x < 0 || x > 65535)) return true;
  if (g.every((x)=>x === 0)) return true; // ::
  if (g.slice(0, 7).every((x)=>x === 0) && g[7] === 1) return true; // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (rede privada)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((g[0] & 0xffc0) === 0xfec0) return true; // site-local antigo
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentação
  const embutido = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (g.slice(0, 5).every((x)=>x === 0) && (g[5] === 0xffff || g[5] === 0)) return mcpIpv4Privado(embutido); // v4 mapeado/compatível
  if (g[0] === 0x64 && g[1] === 0xff9b) return mcpIpv4Privado(embutido); // NAT64
  if (g[0] === 0x2002) return mcpIpv4Privado(`${g[1] >> 8}.${g[1] & 255}.${g[2] >> 8}.${g[2] & 255}`); // 6to4
  return false;
}
async function mcpResolver(host) {
  const ips = [];
  if (typeof Deno !== "undefined" && typeof Deno.resolveDns === "function") {
    for (const tipo of [
      "A",
      "AAAA"
    ]){
      try {
        const r = await Deno.resolveDns(host, tipo);
        for (const ip of r || [])ips.push(String(ip));
      } catch (_) {}
    }
  }
  if (!ips.length) {
    // sem resolveDns no ambiente: DNS por HTTPS
    for (const tipo of [
      "A",
      "AAAA"
    ]){
      try {
        const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${tipo}`, {
          headers: {
            accept: "application/dns-json"
          },
          signal: AbortSignal.timeout(4000)
        });
        if (!r.ok) continue;
        const d = await r.json();
        for (const a of d?.Answer || [])if (a?.type === 1 || a?.type === 28) ips.push(String(a.data));
      } catch (_) {}
    }
  }
  return ips;
}
/** Valida o endereço do servidor. Devolve { ok, url } ou { ok:false, error }. */ async function mcpValidarUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch (_) {
    return {
      ok: false,
      error: "endereço inválido"
    };
  }
  if (u.protocol !== "https:") return {
    ok: false,
    error: "só é aceito endereço https"
  };
  if (u.username || u.password) return {
    ok: false,
    error: "o endereço não pode levar usuário e senha"
  };
  if (u.port && u.port !== "443") return {
    ok: false,
    error: "só é aceita a porta padrão do https (443)"
  };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") || host.includes(":") || /^\d+(\.\d+){3}$/.test(host) || /^[\d.]+$/.test(host) || /^0x/i.test(host)) return {
    ok: false,
    error: "use o domínio do servidor, não o IP"
  };
  if (!host.includes(".") || MCP_HOST_BLOQUEADO.test(host)) return {
    ok: false,
    error: "endereço interno ou reservado não é permitido"
  };
  const ips = await mcpResolver(host);
  if (!ips.length) return {
    ok: false,
    error: "não consegui resolver o domínio do servidor"
  };
  for (const ip of ips){
    const priv = ip.includes(":") ? mcpIpv6Privado(ip) : mcpIpv4Privado(ip);
    if (priv) return {
      ok: false,
      error: "o domínio aponta pra rede interna ou reservada, bloqueado"
    };
  }
  u.hash = "";
  return {
    ok: true,
    url: u.toString()
  };
}
/** Tira o segredo de qualquer texto que vá pra log, banco ou resposta. */ function mcpSemSegredo(txt, segredo) {
  let t = String(txt ?? "");
  const s = String(segredo || "");
  if (s.length >= 4) t = t.split(s).join("***");
  return t.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer ***");
}
function mcpCabecalhos(server) {
  const h = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream"
  };
  const segredo = String(server?.secret || "");
  if (/[\r\n]/.test(segredo)) throw new Error("segredo com quebra de linha");
  if (server?.auth_type === "bearer" && segredo) h.Authorization = `Bearer ${segredo}`;
  if (server?.auth_type === "header" && segredo) {
    const nome = String(server.auth_header_name || "X-API-Key").trim();
    if (!/^[A-Za-z0-9-]{1,64}$/.test(nome) || /^(host|content-length|content-type|accept|connection|transfer-encoding|mcp-session-id|mcp-protocol-version)$/i.test(nome)) throw new Error("nome de cabeçalho de autenticação inválido");
    h[nome] = segredo;
  }
  return h;
}
/** Lê a resposta com teto de tamanho e devolve a mensagem JSON-RPC de id = wantId
 *  (corpo JSON puro ou fluxo SSE). Sem wantId, só consome e descarta. */ async function mcpLerMensagem(resp, wantId) {
  if (wantId === undefined) {
    try {
      await resp.body?.cancel();
    } catch (_) {}
    return null;
  }
  const reader = resp.body?.getReader?.();
  if (!reader) return null;
  const sse = String(resp.headers.get("content-type") || "").toLowerCase().includes("text/event-stream");
  const dec = new TextDecoder();
  let buf = "";
  let total = 0;
  const acharNoSse = (texto, fechado)=>{
    const eventos = texto.split(/\r?\n\r?\n/);
    if (!fechado) eventos.pop(); // o último pode estar pela metade
    for (const ev of eventos){
      const dados = ev.split(/\r?\n/).filter((l)=>l.startsWith("data:")).map((l)=>l.slice(5).replace(/^ /, "")).join("\n");
      if (!dados) continue;
      try {
        const msg = JSON.parse(dados);
        const lista = Array.isArray(msg) ? msg : [
          msg
        ];
        const hit = lista.find((m)=>m && m.id === wantId && ("result" in m || "error" in m));
        if (hit) return hit;
      } catch (_) {}
    }
    return null;
  };
  try {
    while(true){
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MCP_MAX_BYTES) throw new Error("resposta do servidor passou do limite de tamanho");
      buf += dec.decode(value, {
        stream: true
      });
      if (sse) {
        const hit = acharNoSse(buf, false);
        if (hit) return hit;
      }
    }
  } finally{
    try {
      await reader.cancel();
    } catch (_) {}
  }
  if (sse) return acharNoSse(buf, true);
  let msg;
  try {
    msg = JSON.parse(buf);
  } catch (_) {
    throw new Error("o servidor não respondeu no formato MCP (JSON-RPC)");
  }
  const lista = Array.isArray(msg) ? msg : [
    msg
  ];
  return lista.find((m)=>m && m.id === wantId && ("result" in m || "error" in m)) || null;
}
/** Abre a sessão (initialize + notifications/initialized) e devolve o que precisa pras próximas chamadas. */ async function mcpAbrir(server, signal) {
  const v = await mcpValidarUrl(server?.url);
  if (!v.ok) throw new Error(v.error);
  const sess = {
    url: v.url,
    headers: mcpCabecalhos(server),
    signal,
    seq: 0,
    segredo: String(server?.secret || "")
  };
  const init = await mcpRpc(sess, "initialize", {
    protocolVersion: MCP_PROTOCOLO,
    capabilities: {},
    clientInfo: {
      name: "unv-nexus-crm",
      version: "1.0.0"
    }
  });
  const versao = String(init?.protocolVersion || MCP_PROTOCOLO);
  if (/^[0-9A-Za-z.-]{1,40}$/.test(versao)) sess.headers["MCP-Protocol-Version"] = versao;
  sess.info = {
    protocolo: versao,
    servidor: String(init?.serverInfo?.name || "").slice(0, 80),
    versao: String(init?.serverInfo?.version || "").slice(0, 40)
  };
  try {
    await mcpRpc(sess, "notifications/initialized", undefined, true);
  } catch (_) {}
  return sess;
}
async function mcpRpc(sess, method, params, notificacao) {
  const id = notificacao ? undefined : ++sess.seq;
  const corpo = {
    jsonrpc: "2.0",
    method
  };
  if (id !== undefined) corpo.id = id;
  if (params !== undefined) corpo.params = params;
  let resp;
  try {
    resp = await fetch(sess.url, {
      method: "POST",
      headers: sess.headers,
      body: JSON.stringify(corpo),
      redirect: "manual",
      signal: sess.signal
    });
  } catch (e) {
    const nome = String(e?.name || "");
    if (nome === "AbortError" || nome === "TimeoutError") throw new Error("o servidor demorou demais pra responder");
    throw new Error(`não consegui conectar no servidor (${mcpSemSegredo(e?.message || e, sess.segredo).slice(0, 120)})`);
  }
  const sid = resp.headers.get("mcp-session-id");
  if (sid && /^[\x21-\x7e]{1,200}$/.test(sid)) sess.headers["Mcp-Session-Id"] = sid;
  if (resp.status >= 300 && resp.status < 400) {
    await mcpLerMensagem(resp).catch(()=>{});
    throw new Error("o servidor respondeu com redirecionamento, que não é seguido por segurança");
  }
  if (!resp.ok) {
    await mcpLerMensagem(resp).catch(()=>{});
    if (resp.status === 401 || resp.status === 403) throw new Error(`o servidor recusou a autenticação (HTTP ${resp.status})`);
    if (resp.status === 404 || resp.status === 405) throw new Error(`este endereço não respondeu como servidor MCP (HTTP ${resp.status})`);
    throw new Error(`o servidor respondeu HTTP ${resp.status}`);
  }
  if (notificacao) {
    await mcpLerMensagem(resp).catch(()=>{});
    return null;
  }
  let msg;
  try {
    msg = await mcpLerMensagem(resp, id);
  } catch (e) {
    const nome = String(e?.name || "");
    if (nome === "AbortError" || nome === "TimeoutError") throw new Error("o servidor demorou demais pra responder");
    throw e;
  }
  if (!msg) throw new Error("o servidor não devolveu resposta pra chamada");
  if (msg.error) throw new Error(`o servidor devolveu erro: ${mcpSemSegredo(msg.error?.message || JSON.stringify(msg.error), sess.segredo).slice(0, 200)}`);
  return msg.result;
}
/** Lista as ferramentas do servidor, já limpas e limitadas. */ async function mcpListarFerramentas(server, timeoutMs) {
  const signal = AbortSignal.timeout(Math.min(20000, Math.max(1000, Number(timeoutMs) || 8000)));
  const sess = await mcpAbrir(server, signal);
  const brutas = [];
  let cursor;
  for(let pagina = 0; pagina < 3; pagina++){
    const r = await mcpRpc(sess, "tools/list", cursor ? {
      cursor
    } : undefined);
    for (const t of Array.isArray(r?.tools) ? r.tools : [])brutas.push(t);
    cursor = typeof r?.nextCursor === "string" && r.nextCursor ? r.nextCursor : null;
    if (!cursor || brutas.length >= MCP_MAX_FERRAMENTAS) break;
  }
  const vistos = new Set();
  const tools = [];
  for (const t of brutas){
    const name = String(t?.name || "").trim();
    if (!name || name.length > 128 || vistos.has(name)) continue;
    vistos.add(name);
    let schema = t?.inputSchema && typeof t.inputSchema === "object" && !Array.isArray(t.inputSchema) ? t.inputSchema : null;
    let schemaSimplificado = false;
    if (!schema || schema.type !== "object" || JSON.stringify(schema).length > MCP_MAX_SCHEMA) {
      schemaSimplificado = !!schema;
      schema = {
        type: "object",
        properties: {},
        additionalProperties: true
      };
    }
    tools.push({
      name,
      description: String(t?.description || t?.title || "").replace(/\s+/g, " ").trim().slice(0, 600),
      input_schema: schema,
      schema_simplificado: schemaSimplificado || undefined
    });
    if (tools.length >= MCP_MAX_FERRAMENTAS) break;
  }
  return {
    info: sess.info,
    tools,
    cortadas: brutas.length > tools.length
  };
}
/** Chama uma ferramenta e devolve { ok, texto }. Nunca lança: erro vira ok:false. */ async function mcpChamarFerramenta(server, toolName, args, timeoutMs, maxChars) {
  const limite = Math.max(200, Number(maxChars) || 4000);
  try {
    const signal = AbortSignal.timeout(Math.min(15000, Math.max(1000, Number(timeoutMs) || 8000)));
    const sess = await mcpAbrir(server, signal);
    const r = await mcpRpc(sess, "tools/call", {
      name: toolName,
      arguments: args && typeof args === "object" ? args : {}
    });
    const partes = [];
    for (const c of Array.isArray(r?.content) ? r.content : []){
      if (c?.type === "text" && typeof c.text === "string") partes.push(c.text);
      else if (c?.type) partes.push(`[conteúdo do tipo ${String(c.type).slice(0, 30)} omitido]`);
    }
    let texto = partes.join("\n").trim();
    if (!texto && r?.structuredContent !== undefined) texto = JSON.stringify(r.structuredContent);
    if (!texto) texto = "(a ferramenta não devolveu conteúdo)";
    texto = mcpSemSegredo(texto, server?.secret);
    if (texto.length > limite) texto = `${texto.slice(0, limite)}\n[resultado cortado: passou de ${limite} caracteres]`;
    return {
      ok: r?.isError !== true,
      texto
    };
  } catch (e) {
    return {
      ok: false,
      falha: true,
      texto: mcpSemSegredo(e?.message || e, server?.secret).slice(0, 200)
    };
  }
}
// ═══════════════════════════ fim do bloco MCP ═══════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "método não permitido" }, 405);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    // 1) quem chama: staff ativo, master ou admin
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return j({ ok: false, error: "não autenticado" }, 401);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return j({ ok: false, error: "não autenticado" }, 401);
    const { data: staff } = await supabase
      .from("onboarding_staff").select("id, role, tenant_id")
      .eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!staff || !["master", "admin"].includes(String(staff.role))) {
      return j({ ok: false, error: "só master ou admin pode testar servidor de ferramentas" }, 403);
    }

    // 2) o servidor vem do banco, pelo id (nada de URL solta no corpo)
    const body = await req.json().catch(() => ({}));
    const serverId = String(body?.server_id || "");
    if (!UUID_RX.test(serverId)) return j({ ok: false, error: "server_id inválido" }, 400);
    const { data: server } = await supabase
      .from("crm_agent_mcp_servers")
      .select("id, name, url, auth_type, auth_header_name, secret, allowed_tools, timeout_ms, tenant_id")
      .eq("id", serverId).maybeSingle();
    if (!server) return j({ ok: false, error: "servidor não encontrado" }, 404);
    if ((staff.tenant_id || null) !== (server.tenant_id || null)) {
      return j({ ok: false, error: "servidor de outra conta" }, 403);
    }

    // 3) initialize + tools/list
    const agora = new Date().toISOString();
    try {
      const lista = await mcpListarFerramentas(server, Math.max(Number(server.timeout_ms) || 8000, 8000));
      const nomes = new Set(lista.tools.map((t: any) => t.name));
      // ferramenta liberada que o servidor não oferece mais sai da lista
      const liberadas = (server.allowed_tools || []).filter((n: string) => nomes.has(n));
      const { error: upErr } = await supabase.from("crm_agent_mcp_servers").update({
        tools_cache: lista.tools,
        allowed_tools: liberadas,
        last_probe_at: agora,
        last_probe_ok: true,
        last_probe_error: null,
      }).eq("id", server.id);
      if (upErr) return j({ ok: false, error: `conectou, mas não consegui gravar: ${upErr.message}` }, 500);
      return j({
        ok: true,
        server: { id: server.id, name: server.name, ...lista.info },
        tools: lista.tools.map((t: any) => ({ name: t.name, description: t.description, schema_simplificado: !!t.schema_simplificado })),
        allowed_tools: liberadas,
        cortadas: lista.cortadas,
      });
    } catch (e) {
      const motivo = mcpSemSegredo((e as any)?.message || e, server.secret).slice(0, 300);
      await supabase.from("crm_agent_mcp_servers").update({
        last_probe_at: agora,
        last_probe_ok: false,
        last_probe_error: motivo,
      }).eq("id", server.id);
      // sem o segredo e sem a URL completa no log
      console.error("[crm-agent-mcp-probe] falha no servidor", server.id, motivo);
      return j({ ok: false, error: motivo });
    }
  } catch (e) {
    console.error("[crm-agent-mcp-probe] erro", String((e as any)?.message || e).slice(0, 200));
    return j({ ok: false, error: "erro interno ao testar o servidor" }, 500);
  }
});
