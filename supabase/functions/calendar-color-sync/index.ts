// Pinta na agenda do Google as reuniões conforme o desfecho registrado no Nexus:
// amarelo = agendada, verde = realizada, vermelho = no-show. Vale pras reuniões de projeto
// (onboarding_meeting_notes: consultores, produto, Fabrício) e do CRM comercial
// (crm_activities: Ricardo e closers). Roda por cron; só toca evento cujo desfecho mudou.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Paleta de eventos do Google: 5 = Banana (amarelo), 10 = Manjericão (verde), 11 = Tomate (vermelho)
const COLOR_ID: Record<string, string> = { yellow: "5", green: "10", red: "11" };
const DAYS_AHEAD = 30;
type Cor = "yellow" | "green" | "red";
const DAYS_BACK = 14;
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type Item = { source: "project" | "crm"; id: string; eventId: string; ownerUserId: string | null; when: string; desired: Cor | null; label: string };

async function accessTokenFor(supabase: any, userId: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(userId)) return cache.get(userId)!;
  const { data: t } = await supabase.from("user_google_tokens").select("*").eq("user_id", userId).maybeSingle();
  let tok: string | null = t?.access_token || null;
  if (t && t.token_expires_at && new Date(t.token_expires_at).getTime() < Date.now() + 60000) {
    const cid = Deno.env.get("GOOGLE_CLIENT_ID"), sec = Deno.env.get("GOOGLE_CLIENT_SECRET");
    tok = null;
    if (t.refresh_token && cid && sec) {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: cid, client_secret: sec, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
      });
      if (r.ok) {
        const d = await r.json();
        tok = d.access_token;
        await supabase.from("user_google_tokens").update({
          access_token: tok, token_expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(),
        }).eq("user_id", userId);
      }
    }
  }
  cache.set(userId, tok);
  return tok;
}

// Evento recorrente: o id gravado pode ser o da SÉRIE. Pintar a série pintaria todas
// as ocorrências, então acha a ocorrência do dia da reunião e pinta só ela.
async function resolveEventId(token: string, eventId: string, when: string): Promise<{ id: string | null; err?: string }> {
  const g = await fetch(`${CAL}/${encodeURIComponent(eventId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!g.ok) return { id: null, err: `evento ${g.status}` };
  const ev = await g.json();
  if (ev.status === "cancelled") return { id: null, err: "evento cancelado no Google" };
  if (!Array.isArray(ev.recurrence) || !ev.recurrence.length) return { id: ev.id };
  const t = Date.parse(when);
  const q = new URLSearchParams({ timeMin: new Date(t - 6 * 3600000).toISOString(), timeMax: new Date(t + 6 * 3600000).toISOString(), maxResults: "5" });
  const r = await fetch(`${CAL}/${encodeURIComponent(eventId)}/instances?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return { id: null, err: `ocorrências ${r.status}` };
  const items = ((await r.json()).items || []).filter((i: any) => i.status !== "cancelled");
  if (!items.length) return { id: null, err: "sem ocorrência no dia" };
  items.sort((a: any, b: any) => Math.abs(Date.parse(a.start?.dateTime || a.start?.date) - t) - Math.abs(Date.parse(b.start?.dateTime || b.start?.date) - t));
  return { id: items[0].id };
}

async function paint(token: string, eventId: string, color: Cor | null): Promise<{ ok: boolean; err?: string }> {
  const r = await fetch(`${CAL}/${encodeURIComponent(eventId)}?sendUpdates=none`, {
    method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ colorId: color ? COLOR_ID[color] : null }),
  });
  if (!r.ok) return { ok: false, err: `patch ${r.status}: ${(await r.text()).slice(0, 160)}` };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const dry = body?.dry_run === true;
    const tokens = new Map<string, string | null>();

    // Autoteste: só roda se a chave calendar_color_selftest estiver ligada no banco (uso único).
    if (body?.action === "selftest") {
      const { data: flag } = await supabase.from("crm_settings").select("setting_value").eq("setting_key", "calendar_color_selftest").maybeSingle();
      const uid = typeof flag?.setting_value === "string" ? flag.setting_value : "";
      if (!uid) return j({ ok: false, error: "autoteste desligado" }, 403);
      await supabase.from("crm_settings").delete().eq("setting_key", "calendar_color_selftest");
      const tok = await accessTokenFor(supabase, uid, tokens);
      if (!tok) return j({ ok: false, error: "sem token" });
      const start = new Date(Date.now() + 40 * 86400000); start.setUTCHours(9, 0, 0, 0);
      const c = await fetch(`${CAL}?sendUpdates=none`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "[teste de cor - pode apagar]", start: { dateTime: start.toISOString() }, end: { dateTime: new Date(start.getTime() + 900000).toISOString() }, transparency: "transparent" }) });
      const ev = await c.json();
      const steps: any[] = [];
      for (const col of ["yellow", "green", "red", null] as const) {
        const p = await paint(tok, ev.id, col);
        const g = await (await fetch(`${CAL}/${ev.id}`, { headers: { Authorization: `Bearer ${tok}` } })).json();
        steps.push({ pedido: col, ok: p.ok, err: p.err, colorId: g.colorId ?? null });
      }
      const d = await fetch(`${CAL}/${ev.id}?sendUpdates=none`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
      return j({ ok: true, steps, apagado: d.status });
    }

    const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();
    const until = new Date(Date.now() + DAYS_AHEAD * 86400000).toISOString();
    const items: Item[] = [];

    // 1) Reuniões de projeto
    const { data: notes } = await supabase.from("onboarding_meeting_notes")
      .select("id, google_event_id, meeting_title, meeting_date, is_finalized, is_no_show, calendar_owner_id, staff_id")
      .not("google_event_id", "is", null).gte("meeting_date", since).lte("meeting_date", until).limit(1000);
    const staffIds = [...new Set((notes || []).filter((n: any) => !n.calendar_owner_id && n.staff_id).map((n: any) => n.staff_id))];
    const staffUser = new Map<string, string>();
    if (staffIds.length) {
      const { data: st } = await supabase.from("onboarding_staff").select("id, user_id").in("id", staffIds);
      for (const s of (st || [])) if (s.user_id) staffUser.set(s.id, s.user_id);
    }
    for (const n of (notes || []) as any[]) {
      items.push({ source: "project", id: n.id, eventId: n.google_event_id, when: n.meeting_date, label: n.meeting_title || "",
        ownerUserId: n.calendar_owner_id || staffUser.get(n.staff_id) || null,
        desired: n.is_no_show ? "red" : n.is_finalized ? "green" : "yellow" });
    }

    // 2) Reuniões do CRM comercial
    const { data: acts } = await supabase.from("crm_activities")
      .select("id, title, lead_id, status, scheduled_at, google_calendar_event_id, google_calendar_user_id, responsible_staff_id")
      .eq("type", "meeting").not("google_calendar_event_id", "is", null)
      .gte("scheduled_at", since).lte("scheduled_at", until).limit(1000);
    const leadIds = [...new Set((acts || []).map((a: any) => a.lead_id).filter(Boolean))];
    const evByLead = new Map<string, any[]>();
    for (let i = 0; i < leadIds.length; i += 100) {
      const { data: evs } = await supabase.from("crm_meeting_events").select("lead_id, event_type, event_date, created_at")
        .in("lead_id", leadIds.slice(i, i + 100)).in("event_type", ["realized", "realized_out_of_icp", "no_show"])
        .gte("event_date", new Date(Date.now() - (DAYS_BACK + 2) * 86400000).toISOString());
      for (const e of (evs || [])) { const l = evByLead.get(e.lead_id) || []; l.push(e); evByLead.set(e.lead_id, l); }
    }
    for (const a of (acts || []) as any[]) {
      const st = String(a.status || "").toLowerCase();
      const t = Date.parse(a.scheduled_at);
      let desired: Item["desired"] = null;
      if (!["cancelled", "canceled"].includes(st)) {
        // desfecho lançado perto da data da reunião; o mais recente vale (corrige lançamento errado)
        const evs = (evByLead.get(a.lead_id) || [])
          .filter((e) => { const d = Date.parse(e.event_date); return d >= t - 86400000 && d <= t + 6 * 86400000; })
          .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at));
        if (evs.length) desired = evs[0].event_type === "no_show" ? "red" : "green";
        else if (st === "no_show") desired = "red";
        else if (st === "completed" && t < Date.now()) desired = "green";
        else desired = "yellow"; // agendada, ainda sem desfecho
      }
      items.push({ source: "crm", id: a.id, eventId: a.google_calendar_event_id, when: a.scheduled_at, label: a.title || "",
        ownerUserId: a.google_calendar_user_id || null, desired });
    }

    // 3) Só aplica o que mudou
    const { data: applied } = await supabase.from("calendar_event_colors").select("source, source_id, color").gte("meeting_at", since);
    const appliedMap = new Map<string, string | null>();
    for (const r of (applied || [])) appliedMap.set(`${r.source}:${r.source_id}`, r.color);

    const out: any[] = [];
    let changed = 0;
    for (const it of items) {
      const key = `${it.source}:${it.id}`;
      const prev = appliedMap.has(key) ? appliedMap.get(key) : undefined;
      if ((prev ?? null) === it.desired) continue; // igual ao já aplicado (ou nunca pintado e sem desfecho)
      if (changed >= 90) break; // por rodada; o resto entra na próxima
      if (dry) { out.push({ ...it, de: prev ?? null }); changed++; continue; }
      let error: string | null = null;
      const tok = it.ownerUserId ? await accessTokenFor(supabase, it.ownerUserId, tokens) : null;
      if (!tok) error = "dono da agenda sem conexão com o Google";
      else {
        const res = await resolveEventId(tok, it.eventId, it.when);
        if (!res.id) error = res.err || "evento não encontrado";
        else { const p = await paint(tok, res.id, it.desired); if (!p.ok) error = p.err || "falha"; }
      }
      // Erro definitivo (evento apagado/cancelado no Google) fica gravado pra não tentar de novo
      // a cada rodada; erro passageiro (token, rede, limite) não grava e entra na próxima.
      const definitivo = !error || /evento (404|410)|cancelado|sem ocorrência/.test(error);
      if (!definitivo) { out.push({ source: it.source, label: it.label, when: it.when, cor: it.desired, error }); changed++; continue; }
      await supabase.from("calendar_event_colors").upsert({
        source: it.source, source_id: it.id, event_id: it.eventId, color: it.desired, meeting_at: it.when,
        error, applied_at: new Date().toISOString(),
      }, { onConflict: "source,source_id" });
      out.push({ source: it.source, label: it.label, when: it.when, cor: it.desired, error });
      changed++;
    }
    return j({ ok: true, avaliadas: items.length, alteradas: changed, dry, detalhe: out });
  } catch (e) {
    return j({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
