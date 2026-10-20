// Contrato do cliente ganho (Fabrício, 20/10/2026): "depois que o cliente deu ganho no CRM Comercial,
// se o lead já tiver com o contrato assinado, já vá o contrato em anexo dentro do projeto do cliente
// e já conclua a tarefa de contrato. Se não tiver assinado, 2x por dia consultar; assim que assinar,
// anexar e dar baixa na tarefa; e se não tiver assinado, enviar pela instância Fabrício Nunnes pro
// closer que fechou a venda cobrando o contrato, pelo menos 1x ao dia, sempre às 17h."
//
// Ações: { action: "verificar", lead_id?, dias?, dry_run? }  → anexa os assinados (gatilho do ganho + crons)
//        { action: "cobrar", dry_run? }                       → verifica e cobra o closer dos não assinados
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-contrato-secret" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const dig = (v: unknown) => String(v || "").replace(/\D/g, "");
const fim8 = (v: unknown) => dig(v).slice(-8);
const ddmm = (iso: string) => { const d = new Date(new Date(iso).getTime() - 3 * 3600000).toISOString(); return `${d.slice(8, 10)}/${d.slice(5, 7)}`; };
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const EVENTO_RE = /evento|mans[ãa]o|palestra|imers/i; // ganho de evento não tem contrato
const INSTANCIA = "fabricionunnes";

async function autorizado(sb: any, req: Request) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer && bearer === SERVICE_ROLE) return true;
  const seg = req.headers.get("x-contrato-secret");
  if (!seg) return false;
  const { data } = await sb.rpc("app_secret_get", { p_key: "crm_contrato_secret" });
  return !!data && data === seg;
}

async function zap(sb: any, numero: string, texto: string) {
  const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type, status").eq("instance_name", INSTANCIA).maybeSingle();
  if (!inst?.api_url || !inst?.api_key) return { ok: false, erro: "instância sem api" };
  let host = ""; try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* */ }
  const v2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
  const url = v2 ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text` : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: inst.api_key }, body: JSON.stringify({ number: numero, text: texto }) });
  return r.ok ? { ok: true } : { ok: false, erro: `${r.status} ${(await r.text()).slice(0, 120)}` };
}

/** Leads ganhos (fora funil de evento) nos últimos `dias`, ou um lead específico. */
async function leadsGanhos(sb: any, dias: number, leadId?: string) {
  let q = sb.from("crm_leads").select("id, name, company, phone, email, document, closed_at, closer_staff_id, owner_staff_id, stage:crm_stages!inner(final_type), pipeline:crm_pipelines(name)")
    .eq("stage.final_type", "won");
  if (leadId) q = q.eq("id", leadId);
  else q = q.gte("closed_at", new Date(Date.now() - dias * 86400000).toISOString());
  const { data, error } = await q.limit(500);
  if (error) throw new Error("leads: " + error.message);
  return ((data || []) as any[]).filter((l) => !EVENTO_RE.test(String(l.pipeline?.name || "")));
}

/** Empresa e projeto do lead: projeto com crm_lead_id; senão empresa por CNPJ, e-mail ou telefone (uma só). */
async function empresaDoLead(sb: any, l: any) {
  const { data: pl } = await sb.from("onboarding_projects").select("id, onboarding_company_id, status, created_at").eq("crm_lead_id", l.id).order("created_at", { ascending: false }).limit(1);
  if (pl?.[0]?.onboarding_company_id) return { companyId: pl[0].onboarding_company_id, projectId: pl[0].id, via: "projeto" };
  const doc = dig(l.document), email = String(l.email || "").trim().toLowerCase(), f8 = fim8(l.phone);
  // PostgREST devolve no máximo 1000 linhas: pagina
  const lista: any[] = [];
  for (let de = 0; de < 20000; de += 1000) {
    const { data: cs } = await sb.from("onboarding_companies").select("id, name, cnpj, email, phone, owner_phone, status, created_at").order("created_at", { ascending: false }).range(de, de + 999);
    lista.push(...(cs || []));
    if (!cs || cs.length < 1000) break;
  }
  const tentar = (pred: (c: any) => boolean) => { const a = lista.filter(pred); return a.length === 1 ? a[0] : null; };
  const c = (doc.length >= 11 && tentar((c) => dig(c.cnpj) === doc))
    || (email && tentar((c) => String(c.email || "").trim().toLowerCase() === email))
    || (f8.length === 8 && tentar((c) => fim8(c.phone) === f8 || fim8(c.owner_phone) === f8));
  if (!c) return null;
  const { data: pr } = await sb.from("onboarding_projects").select("id, status, created_at").eq("onboarding_company_id", c.id).order("created_at", { ascending: false });
  const ativos = (pr || []).filter((p: any) => p.status === "active");
  return { companyId: c.id, projectId: (ativos[0] || pr?.[0])?.id || null, via: "cadastro" };
}

/** Envelopes do lead: pelo CNPJ do contrato gerado e pelo e-mail de quem assina. */
async function envelopesDoLead(sb: any, l: any) {
  const ids = new Set<string>();
  const doc = dig(l.document);
  if (doc.length >= 11) {
    for (let de = 0; de < 20000; de += 1000) {
      const { data: gc } = await sb.from("generated_contracts").select("envelope_id, client_document").not("envelope_id", "is", null).range(de, de + 999);
      (gc || []).filter((g: any) => dig(g.client_document) === doc).forEach((g: any) => ids.add(g.envelope_id));
      if (!gc || gc.length < 1000) break;
    }
  }
  const email = String(l.email || "").trim().toLowerCase();
  if (email) {
    const { data: sg } = await sb.from("signers").select("envelope_id").ilike("email", email);
    (sg || []).forEach((s: any) => ids.add(s.envelope_id));
  }
  if (!ids.size) return [];
  const { data: env } = await sb.from("envelopes").select("id, title, status, final_file_path, completed_at, created_at, signers(name, email, status, order_index)").in("id", [...ids]);
  return ((env || []) as any[]).filter((e) => e.status !== "cancelled").sort((a, b) => String(b.completed_at || b.created_at).localeCompare(String(a.completed_at || a.created_at)));
}

async function tarefaContrato(sb: any, projectId: string | null) {
  if (!projectId) return null;
  const { data } = await sb.from("onboarding_tasks").select("id, status, observations").eq("project_id", projectId).ilike("title", "contrato").order("created_at", { ascending: true }).limit(1);
  return data?.[0] || null;
}

async function verificarLead(sb: any, l: any, dryRun: boolean) {
  const { data: reg } = await sb.from("crm_contrato_ganho").select("*").eq("lead_id", l.id).maybeSingle();
  if (reg?.status === "anexado") return { lead: l.name, status: "ja_anexado" };
  const emp = await empresaDoLead(sb, l);
  const envs = await envelopesDoLead(sb, l);
  const assinado = envs.find((e) => e.status === "completed" && e.final_file_path);
  const base = { lead_id: l.id, company_id: emp?.companyId || null, project_id: emp?.projectId || null, envelope_id: (assinado || envs[0])?.id || null, updated_at: new Date().toISOString() };
  if (!assinado) {
    const st = envs[0]?.status || "sem_contrato";
    if (!dryRun) await sb.from("crm_contrato_ganho").upsert({ ...base, status: "pendente", envelope_status: st }, { onConflict: "lead_id" });
    return { lead: l.name, status: "nao_assinado", envelope: st, empresa: !!emp };
  }
  if (!emp) {
    if (!dryRun) await sb.from("crm_contrato_ganho").upsert({ ...base, status: "sem_empresa", envelope_status: "completed" }, { onConflict: "lead_id" });
    return { lead: l.name, status: "assinado_sem_empresa" };
  }
  const tarefa = await tarefaContrato(sb, emp.projectId);
  // Contrato já anexado à mão depois do ganho (ou um mês antes): não duplica, só conclui a tarefa.
  const desde = new Date(new Date(l.closed_at || Date.now()).getTime() - 30 * 86400000).toISOString();
  const { data: docs } = await sb.from("onboarding_documents").select("id, file_name, created_at").eq("company_id", emp.companyId).eq("category", "contract").gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
  let docId = docs?.[0]?.id || null;
  let acao = docId ? "ja_havia_contrato_anexado" : "anexado";
  if (dryRun) return { lead: l.name, status: "assinado", acao, tarefa: tarefa?.status || "sem_tarefa", envelope: assinado.title };
  if (!docId) {
    const { data: blob, error: dErr } = await sb.storage.from("envelopes").download(assinado.final_file_path);
    if (dErr || !blob) throw new Error(`download envelope ${assinado.id}: ${dErr?.message}`);
    const nomeLimpo = String(assinado.title || "Contrato").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 _.-]/g, "").trim().replace(/\s+/g, "_").slice(0, 90);
    const caminho = `${emp.companyId}/contracts/${Date.now()}_${nomeLimpo}_assinado.pdf`;
    const { error: uErr } = await sb.storage.from("onboarding-documents").upload(caminho, blob, { contentType: "application/pdf" });
    if (uErr) throw new Error(`upload: ${uErr.message}`);
    const { data: ins, error: iErr } = await sb.from("onboarding_documents").insert({
      company_id: emp.companyId, project_id: emp.projectId, task_id: tarefa?.id || null,
      file_name: `${assinado.title || "Contrato"} (assinado).pdf`, file_path: caminho, file_size: blob.size, file_type: "application/pdf",
      category: "contract", description: `Contrato assinado por todos em ${assinado.completed_at ? ddmm(assinado.completed_at) : "?"}, anexado automaticamente após o ganho no CRM.`,
    }).select("id").single();
    if (iErr) throw new Error(`documento: ${iErr.message}`);
    docId = ins.id;
  }
  if (tarefa && tarefa.status !== "completed") {
    const obs = [tarefa.observations, `Concluída automaticamente: contrato assinado anexado em Contratos (${hojeBR().split("-").reverse().join("/")}).`].filter(Boolean).join("\n");
    await sb.from("onboarding_tasks").update({ status: "completed", completed_at: new Date().toISOString(), observations: obs }).eq("id", tarefa.id);
  }
  await sb.from("crm_contrato_ganho").upsert({ ...base, status: "anexado", envelope_status: "completed", document_id: docId, task_id: tarefa?.id || null, attached_at: new Date().toISOString() }, { onConflict: "lead_id" });
  return { lead: l.name, status: "assinado", acao, tarefa: tarefa ? "concluida" : "sem_tarefa" };
}

async function verificar(sb: any, dias: number, dryRun: boolean, leadId?: string) {
  const out: any[] = [];
  for (const l of await leadsGanhos(sb, dias, leadId)) {
    try { out.push(await verificarLead(sb, l, dryRun)); } catch (e) { out.push({ lead: l.name, erro: String(e).slice(0, 200) }); }
  }
  return out;
}

const NOME_STATUS: Record<string, string> = {
  sem_contrato: "ainda não tem contrato enviado pelo Nexus",
  draft: "o contrato está em rascunho, não foi enviado",
  sent: "o contrato foi enviado e ninguém assinou ainda",
  partially_signed: "o contrato está assinado só em parte",
};

async function cobrar(sb: any, dryRun: boolean) {
  const verif = await verificar(sb, 60, dryRun);
  const hoje = hojeBR();
  const { data: pend } = await sb.from("crm_contrato_ganho").select("*").eq("status", "pendente");
  const out: any[] = [];
  for (const p of (pend || []) as any[]) {
    if (p.last_reminder_at && String(p.last_reminder_at).slice(0, 10) === hoje && !dryRun) continue;
    const { data: l } = await sb.from("crm_leads").select("id, name, company, closed_at, closer_staff_id, owner_staff_id").eq("id", p.lead_id).maybeSingle();
    if (!l) continue;
    const staffId = l.closer_staff_id || l.owner_staff_id;
    const { data: st } = staffId ? await sb.from("onboarding_staff").select("name, phone").eq("id", staffId).maybeSingle() : { data: null };
    const d = dig(st?.phone);
    if (d.length < 10) { out.push({ lead: l.name, erro: "closer sem telefone" }); continue; }
    const numero = d.startsWith("55") ? d : `55${d}`;
    let faltam = "";
    if (p.envelope_id && ["sent", "partially_signed"].includes(p.envelope_status)) {
      const { data: sg } = await sb.from("signers").select("name, email, status, order_index").eq("envelope_id", p.envelope_id);
      const pend = (sg || []).filter((s: any) => s.status !== "signed");
      // signatário da UNV (ordem 0 / e-mail da UNV) separado do cliente: às vezes quem trava é a gente
      const ehUNV = (s: any) => Number(s.order_index) === 0 || /universidade|unv|unvholdings|universidadevendas/i.test(`${s.name} ${s.email}`);
      const unv = pend.filter(ehUNV), cli = pend.filter((s: any) => !ehUNV(s));
      const partes = [unv.length ? "da UNV (Universidade de Vendas)" : "", cli.length ? `do cliente (${cli.map((s: any) => s.name).filter(Boolean).join(", ")})` : ""].filter(Boolean);
      if (partes.length) faltam = ` Falta a assinatura ${partes.join(" e ")}.`;
    }
    const empresa = l.company || l.name;
    const nome = String(st?.name || "").split(" ")[0];
    const texto = `${nome ? nome + ", o" : "O"} contrato da ${empresa} ainda não está assinado. Ganho no CRM em ${l.closed_at ? ddmm(l.closed_at) : "?"}, e ${NOME_STATUS[p.envelope_status] || "o contrato não foi concluído"}.${faltam}\n\nConsegue cobrar o cliente hoje? Assim que assinar, o contrato entra sozinho no projeto e a tarefa é concluída.\n\nLead: https://unvholdings.com.br/#/crm/leads/${l.id}`;
    if (dryRun) { out.push({ lead: l.name, closer: st?.name, numero, texto }); continue; }
    const r = await zap(sb, numero, texto);
    if (r.ok) await sb.from("crm_contrato_ganho").update({ last_reminder_at: new Date().toISOString(), reminders: (p.reminders || 0) + 1 }).eq("lead_id", p.lead_id);
    out.push({ lead: l.name, closer: st?.name, enviado: r.ok, erro: r.ok ? undefined : r.erro });
  }
  return { verificados: verif, cobrancas: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    if (!(await autorizado(sb, req))) return json({ error: "não autorizado" }, 401);
    const body = await req.json().catch(() => ({} as any));
    const dry = !!body.dry_run;
    if (body.action === "cobrar") return json(await cobrar(sb, dry));
    // gatilho do ganho: espera o projeto e as tarefas nascerem (o front cria logo depois do ganho)
    if (body.lead_id && Number(body.esperar) > 0) {
      const tarefa = (async () => {
        await new Promise((r) => setTimeout(r, Math.min(Number(body.esperar), 120) * 1000));
        console.log("[contrato-ganho] gatilho", JSON.stringify(await verificar(sb, 3650, dry, String(body.lead_id))).slice(0, 400));
      })();
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) { rt.waitUntil(tarefa); return json({ ok: true, queued: true }); }
      await tarefa;
      return json({ ok: true });
    }
    return json({ verificados: await verificar(sb, Number(body.dias || 60), dry, body.lead_id ? String(body.lead_id) : undefined) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
