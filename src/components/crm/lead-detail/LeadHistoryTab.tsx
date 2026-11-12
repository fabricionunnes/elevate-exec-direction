import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRightLeft,
  Phone,
  MessageSquare,
  MessagesSquare,
  FileSignature,
  ListFilter,
  Video,
  Flag,
  DollarSign,
  ArrowDownUp,
  Building2,
  LogIn,
  Gauge,
  Send,
  Bot,
  Tag,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Percurso do lead: linha do tempo unificada, montada a partir de TODAS as fontes
// que o Nexus já grava (mudanças de etapa, atividades, reuniões, follow-ups,
// propostas, pagamentos, diagnóstico de maturidade, motivo de perda). Já nasce
// preenchida e retroativa: só lê o que existe, não depende de backfill.
//
// Limite conhecido do dado: o crm_lead_history guarda o NOME da etapa (não o id) e
// NÃO registra o funil de cada passo. Nomes de etapa se repetem em vários funis,
// então o funil de cada mudança antiga seria chute. Por isso mostramos a jornada
// por etapas pelo nome e o funil atual no topo; funil por evento não é inventado.
// ─────────────────────────────────────────────────────────────────────────────

type Category = "etapa" | "reuniao" | "ligacao" | "mensagem" | "nota" | "proposta" | "pagamento" | "diagnostico" | "marco"
  | "disparo" | "conversa" | "ia" | "etiqueta";

interface TimelineEvent {
  id: string;
  at: string; // ISO
  category: Category;
  title: string;
  detail?: string | null;
  note?: string | null;
  actor?: string | null;
  tone?: "neutral" | "good" | "bad" | "warn";
}

interface LeadHistoryTabProps {
  leadId: string;
  originName?: string;
  pipelineName?: string;
}

const CATEGORY_META: Record<Category, { label: string; icon: any }> = {
  etapa: { label: "Etapa", icon: ArrowRightLeft },
  reuniao: { label: "Reunião", icon: Video },
  ligacao: { label: "Ligação", icon: Phone },
  mensagem: { label: "Mensagem", icon: MessagesSquare },
  nota: { label: "Nota", icon: MessageSquare },
  proposta: { label: "Proposta", icon: FileSignature },
  pagamento: { label: "Pagamento", icon: DollarSign },
  diagnostico: { label: "Diagnóstico", icon: Gauge },
  marco: { label: "Marco", icon: Flag },
  // Percurso completo (Fabrício, 12/11/2026: "tem que ter tudo, e não somente mudança de etapa ou funil")
  disparo: { label: "Disparo", icon: Send },
  conversa: { label: "Conversa", icon: MessagesSquare },
  ia: { label: "Agente de IA", icon: Bot },
  etiqueta: { label: "Etiqueta", icon: Tag },
};

const brl = (cents?: number | null) =>
  typeof cents === "number"
    ? (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "";

const winRe = /(ganho|fechad|cliente|vendid)/i;
const lostRe = /(perdid|perda|fora do icp|desqualific|descartad)/i;

export const LeadHistoryTab = ({ leadId, originName, pipelineName }: LeadHistoryTabProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (leadId) loadJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const loadJourney = async () => {
    setLoading(true);
    try {
      const [
        leadRes,
        historyRes,
        activitiesRes,
        actHistRes,
        followupsRes,
        proposalsRes,
        paymentsRes,
        maturityRes,
      ] = await Promise.all([
        supabase.from("crm_leads")
          .select("id, name, created_at, entered_pipeline_at, origin, utm_source, utm_medium, utm_campaign, closed_at, loss_reason_id, stage_id, pipeline_id")
          .eq("id", leadId).maybeSingle(),
        supabase.from("crm_lead_history")
          .select("id, action, field_changed, old_value, new_value, notes, staff_id, created_at")
          .eq("lead_id", leadId).order("created_at", { ascending: true }),
        supabase.from("crm_activities")
          .select("id, type, title, description, scheduled_at, completed_at, status, responsible_staff_id, notes, created_at, meeting_link, recording_url")
          .eq("lead_id", leadId).order("created_at", { ascending: true }),
        supabase.from("crm_activity_history")
          .select("id, activity_id, action, old_scheduled_at, new_scheduled_at, notes, performed_by_staff_id, created_at")
          .eq("lead_id", leadId).order("created_at", { ascending: true }),
        supabase.from("crm_lead_followups")
          .select("id, message, angle, status, sent_by, sent_at, created_at")
          .eq("lead_id", leadId),
        supabase.from("crm_lead_proposals")
          .select("id, title, service_name, status, generated_by, created_at")
          .eq("lead_id", leadId),
        supabase.from("crm_lead_payments")
          .select("id, amount_cents, description, status, provider, created_by, paid_at, created_at")
          .eq("lead_id", leadId),
        supabase.from("crm_lead_maturity")
          .select("id, total, estrategico, marketing, vendas, pessoas, financeiro, created_by, created_at")
          .eq("lead_id", leadId),
      ]);

      const lead: any = leadRes.data || {};
      const history: any[] = historyRes.data || [];
      const activities: any[] = activitiesRes.data || [];
      const actHist: any[] = actHistRes.data || [];
      const followups: any[] = followupsRes.data || [];
      const proposals: any[] = proposalsRes.data || [];
      const payments: any[] = paymentsRes.data || [];
      const maturity: any[] = maturityRes.data || [];

      // ── nomes das pessoas e motivo de perda ─────────────────────────────────
      const staffIds = new Set<string>();
      history.forEach((h) => h.staff_id && staffIds.add(h.staff_id));
      activities.forEach((a) => a.responsible_staff_id && staffIds.add(a.responsible_staff_id));
      actHist.forEach((a) => a.performed_by_staff_id && staffIds.add(a.performed_by_staff_id));
      followups.forEach((f) => f.sent_by && staffIds.add(f.sent_by));
      proposals.forEach((p) => p.generated_by && staffIds.add(p.generated_by));
      payments.forEach((p) => p.created_by && staffIds.add(p.created_by));
      maturity.forEach((m) => m.created_by && staffIds.add(m.created_by));

      const [staffRes, lossRes] = await Promise.all([
        staffIds.size
          ? supabase.from("onboarding_staff").select("id, name").in("id", [...staffIds])
          : Promise.resolve({ data: [] as any[] }),
        lead.loss_reason_id
          ? supabase.from("crm_loss_reasons").select("id, name").eq("id", lead.loss_reason_id).maybeSingle()
          : Promise.resolve({ data: null as any }),
      ]);
      const staffMap = new Map<string, string>((staffRes.data || []).map((s: any) => [s.id, s.name]));
      const lossName = (lossRes as any)?.data?.name || null;

      const ev: TimelineEvent[] = [];

      // ── entrada do lead ──────────────────────────────────────────────────────
      const entrada = lead.entered_pipeline_at || lead.created_at;
      if (entrada) {
        const orig = [lead.origin || originName, lead.utm_source && `origem ${lead.utm_source}`, lead.utm_campaign && `campanha ${lead.utm_campaign}`]
          .filter(Boolean).join(" · ");
        ev.push({ id: "entrada", at: entrada, category: "marco", tone: "good", title: "Lead entrou no CRM", detail: orig || null });
      }

      // ── histórico do lead (etapas, notas, marcos) ─────────────────────────────
      for (const h of history) {
        const actor = h.staff_id ? staffMap.get(h.staff_id) : null;
        if (h.action === "stage_change") {
          const fromName = h.old_value || "início";
          const toName = h.new_value || "—";
          const isWon = winRe.test(toName);
          const isLost = lostRe.test(toName);
          ev.push({
            id: `stage-${h.id}`, at: h.created_at,
            category: isWon || isLost ? "marco" : "etapa",
            tone: isWon ? "good" : isLost ? "bad" : "neutral",
            title: isWon ? `Ganho na etapa "${toName}"` : isLost ? `Perdido na etapa "${toName}"` : `Etapa: ${fromName} → ${toName}`,
            note: h.notes || null, actor,
          });
        } else if (h.action === "note_added" && h.field_changed === "stage_change_note") {
          ev.push({ id: `note-${h.id}`, at: h.created_at, category: "nota", title: h.new_value ? `Nota ao mover para "${h.new_value}"` : "Nota da mudança de etapa", note: h.notes || null, actor });
        } else if (h.action === "note") {
          const autor = actor || (h.new_value ? h.new_value.replace(/^Nota de\s*/i, "").trim() : null);
          ev.push({ id: `note-${h.id}`, at: h.created_at, category: "nota", title: "Nota", note: h.notes || null, actor: autor });
        } else if (h.action === "owner_change") {
          const fromN = h.old_value ? staffMap.get(h.old_value) || h.old_value : "—";
          const toN = h.new_value ? staffMap.get(h.new_value) || h.new_value : "—";
          ev.push({ id: `owner-${h.id}`, at: h.created_at, category: "marco", title: `Responsável alterado: ${fromN} → ${toN}`, actor });
        } else if (h.action === "converted_to_company" || h.action === "company_created") {
          ev.push({ id: `conv-${h.id}`, at: h.created_at, category: "marco", tone: "good", title: "Convertido em cliente", note: h.notes || null, actor });
        } else if (h.action === "reopened") {
          ev.push({ id: `reopen-${h.id}`, at: h.created_at, category: "marco", tone: "warn", title: "Lead reaberto", note: h.notes || null, actor });
        } else if (h.action === "project_created") {
          ev.push({ id: `proj-${h.id}`, at: h.created_at, category: "marco", tone: "good", title: "Projeto de onboarding criado", note: h.notes || null, actor });
        } else if (h.action === "merge") {
          ev.push({ id: `merge-${h.id}`, at: h.created_at, category: "marco", title: "Leads unificados", note: h.notes || null, actor });
        } else if (h.action === "pipeline_change") {
          ev.push({ id: `funil-${h.id}`, at: h.created_at, category: "etapa", tone: "warn", title: `Funil: ${h.old_value || "—"} → ${h.new_value || "—"}`, actor });
        } else if (h.action === "reentrada") {
          ev.push({ id: `reent-${h.id}`, at: h.created_at, category: "marco", tone: "good", title: "Lead entrou de novo", note: h.notes || null, actor });
        } else if (h.action === "meeting_rescheduled") {
          ev.push({ id: `remarc-${h.id}`, at: h.created_at, category: "reuniao", tone: "warn", title: "Reunião remarcada", note: h.notes || null, actor });
        } else if (h.action === "meta_lead_form") {
          ev.push({ id: `meta-${h.id}`, at: h.created_at, category: "marco", title: "Veio de formulário da Meta", note: h.notes || null, actor });
        }
        // summary_accessed e afins ficam de fora (ruído operacional)
      }

      // ── reuniões, ligações, mensagens, notas de atividade ─────────────────────
      for (const a of activities) {
        const actor = a.responsible_staff_id ? staffMap.get(a.responsible_staff_id) : null;
        const when = a.scheduled_at || a.completed_at || a.created_at;
        const done = a.status === "completed";
        const cancelled = a.status === "cancelled";
        if (a.type === "meeting") {
          ev.push({
            id: `act-${a.id}`, at: when, category: "reuniao",
            tone: done ? "good" : cancelled ? "bad" : "warn",
            title: done ? "Reunião realizada" : cancelled ? "Reunião cancelada" : "Reunião agendada",
            detail: [a.title, a.scheduled_at ? format(new Date(a.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : null].filter(Boolean).join(" · ") || null,
            note: a.notes || a.description || null, actor,
          });
        } else if (a.type === "call") {
          const missed = /missed|no.?answer|nao_atend|não atend/i.test(`${a.status} ${a.title || ""} ${a.notes || ""}`);
          ev.push({ id: `act-${a.id}`, at: when, category: "ligacao", tone: missed ? "bad" : "neutral", title: missed ? "Ligação não atendida" : "Ligação", detail: a.title || null, note: a.notes || a.description || null, actor });
        } else if (a.type === "whatsapp" || a.type === "message") {
          ev.push({ id: `act-${a.id}`, at: when, category: "mensagem", title: "WhatsApp", detail: a.title || null, note: a.notes || a.description || null, actor });
        } else if (a.type === "note") {
          ev.push({ id: `act-${a.id}`, at: when, category: "nota", title: "Nota", note: a.notes || a.description || a.title || null, actor });
        } else if (a.type === "proposal") {
          ev.push({ id: `act-${a.id}`, at: when, category: "proposta", title: "Proposta", detail: a.title || null, note: a.notes || null, actor });
        } else if (a.type === "followup") {
          ev.push({ id: `act-${a.id}`, at: when, category: "mensagem", title: "Follow-up", detail: a.title || null, note: a.notes || a.description || null, actor });
        } else {
          ev.push({ id: `act-${a.id}`, at: when, category: "nota", title: a.title || "Atividade", note: a.notes || a.description || null, actor });
        }
      }

      // ── reagendamentos de reunião ─────────────────────────────────────────────
      for (const h of actHist) {
        if (h.action === "rescheduled" || (h.old_scheduled_at && h.new_scheduled_at)) {
          const actor = h.performed_by_staff_id ? staffMap.get(h.performed_by_staff_id) : null;
          const de = h.old_scheduled_at ? format(new Date(h.old_scheduled_at), "dd/MM HH:mm", { locale: ptBR }) : "—";
          const para = h.new_scheduled_at ? format(new Date(h.new_scheduled_at), "dd/MM HH:mm", { locale: ptBR }) : "—";
          ev.push({ id: `arh-${h.id}`, at: h.created_at, category: "reuniao", tone: "warn", title: `Reunião remarcada: ${de} → ${para}`, note: h.notes || null, actor });
        }
      }

      // ── follow-ups (motor de follow-up personalizado) ─────────────────────────
      for (const f of followups) {
        const actor = f.sent_by ? staffMap.get(f.sent_by) : null;
        ev.push({
          id: `fu-${f.id}`, at: f.sent_at || f.created_at, category: "mensagem",
          title: f.status === "sent" || f.sent_at ? "Follow-up enviado" : "Follow-up preparado",
          detail: f.angle || null, note: f.message || null, actor,
        });
      }

      // ── propostas ─────────────────────────────────────────────────────────────
      for (const p of proposals) {
        const actor = p.generated_by ? staffMap.get(p.generated_by) : null;
        ev.push({ id: `prop-${p.id}`, at: p.created_at, category: "proposta", title: `Proposta: ${p.title || p.service_name || "sem título"}`, detail: p.status ? `status: ${p.status}` : null, actor });
      }

      // ── pagamentos / cobranças ────────────────────────────────────────────────
      for (const p of payments) {
        const actor = p.created_by ? staffMap.get(p.created_by) : null;
        const paid = p.status === "paid" || !!p.paid_at;
        ev.push({
          id: `pay-${p.id}`, at: p.paid_at || p.created_at, category: "pagamento", tone: paid ? "good" : "neutral",
          title: paid ? `Pagamento recebido ${brl(p.amount_cents)}` : `Cobrança gerada ${brl(p.amount_cents)}`,
          detail: [p.description, p.provider, p.status].filter(Boolean).join(" · ") || null, actor,
        });
      }

      // ── diagnóstico de maturidade ─────────────────────────────────────────────
      for (const m of maturity) {
        const actor = m.created_by ? staffMap.get(m.created_by) : null;
        ev.push({
          id: `mat-${m.id}`, at: m.created_at, category: "diagnostico", title: `Diagnóstico de maturidade: ${m.total ?? "—"}`,
          detail: `Estratégico ${m.estrategico ?? "-"} · Marketing ${m.marketing ?? "-"} · Vendas ${m.vendas ?? "-"} · Pessoas ${m.pessoas ?? "-"} · Financeiro ${m.financeiro ?? "-"}`,
          actor,
        });
      }

      // ── Disparos, conversas, ações da IA, retornos, cadências e etiquetas (12/11/2026) ──
      // Fabrício: "esse lead já tem dois disparos feitos, deve ter conversa, deve ter tentativa de agendamento".
      try {
        const [dispRes, waConvRes, igConvRes, retRes, cadRes, tagRes] = await Promise.all([
          (supabase as any).from("whatsapp_official_campaign_recipients")
            .select("id, campaign_id, status, error_text, sent_at, delivered_at, read_at, failed_at, created_at").eq("lead_id", leadId),
          (supabase as any).from("crm_whatsapp_conversations")
            .select("id, instance:whatsapp_instances(display_name, instance_name), official_instance:whatsapp_official_instances(display_name)").eq("lead_id", leadId),
          (supabase as any).from("instagram_conversations").select("id").eq("lead_id", leadId),
          (supabase as any).from("crm_ai_agent_retornos").select("id, due_at, motivo, status, sent_at, created_at").eq("lead_id", leadId),
          (supabase as any).from("crm_cadence_enrollments").select("id, cadence_id, status, stopped_reason, enrolled_at, completed_at, created_at").eq("lead_id", leadId),
          (supabase as any).from("crm_lead_tags").select("id, tag_id, created_at").eq("lead_id", leadId),
        ]);
        const disparos: any[] = dispRes.data || [];
        const waConvs: any[] = waConvRes.data || [];
        const igConvs: any[] = igConvRes.data || [];
        const retornos: any[] = retRes.data || [];
        const cadencias: any[] = cadRes.data || [];
        const tagsLead: any[] = tagRes.data || [];
        const waIds = waConvs.map((c) => c.id);
        const igIds = igConvs.map((c) => c.id);
        const convIds = [...waIds, ...igIds];
        const campIds = [...new Set(disparos.map((d) => d.campaign_id).filter(Boolean))];
        const cadIds = [...new Set(cadencias.map((c) => c.cadence_id).filter(Boolean))];
        const tagIds = [...new Set(tagsLead.map((t) => t.tag_id).filter(Boolean))];
        const vazio = Promise.resolve({ data: [] as any[] });

        const [campRes, waMsgRes, igMsgRes, runsRes, cadNomeRes, tagNomeRes] = await Promise.all([
          campIds.length ? (supabase as any).from("whatsapp_official_campaigns").select("id, template_name, created_by_name").in("id", campIds) : vazio,
          waIds.length ? (supabase as any).from("crm_whatsapp_messages").select("conversation_id, direction, is_ai, sent_by, content, type, created_at")
            .in("conversation_id", waIds).order("created_at", { ascending: false }).limit(1000) : vazio,
          igIds.length ? (supabase as any).from("instagram_messages").select("conversation_id, direction, is_ai, sent_by, content, created_at")
            .in("conversation_id", igIds).order("created_at", { ascending: false }).limit(1000) : vazio,
          convIds.length ? (supabase as any).from("crm_ai_agent_runs").select("id, agent_id, conversation_id, mode, outcome, reply, tool_calls, created_at")
            .in("conversation_id", convIds).order("created_at", { ascending: false }).limit(500) : vazio,
          cadIds.length ? (supabase as any).from("crm_cadences").select("id, name").in("id", cadIds) : vazio,
          tagIds.length ? (supabase as any).from("crm_tags").select("id, name").in("id", tagIds) : vazio,
        ]);
        const campMap = new Map<string, any>((campRes.data || []).map((c: any) => [c.id, c]));
        const cadMap = new Map<string, string>((cadNomeRes.data || []).map((c: any) => [c.id, c.name]));
        const tagMap = new Map<string, string>((tagNomeRes.data || []).map((t: any) => [t.id, t.name]));
        const runs: any[] = runsRes.data || [];
        const agIds = [...new Set(runs.map((r) => r.agent_id).filter(Boolean))];
        const agRes = agIds.length ? await (supabase as any).from("crm_ai_agents").select("id, name").in("id", agIds) : { data: [] };
        const agMap = new Map<string, string>((agRes.data || []).map((a: any) => [a.id, a.name]));
        const curto = (t: unknown, n = 160) => { const x = String(t || "").replace(/\s+/g, " ").trim(); return x.length > n ? `${x.slice(0, n)}…` : x; };

        // disparos de template (API oficial)
        const rotuloDisparo: Record<string, string> = {
          read: "Lido pelo lead", delivered: "Entregue", sent: "Enviado", pending: "Na fila", processing: "Enviando",
          failed: "A Meta não entregou", error: "Falhou no envio", skipped: "Não enviado",
        };
        for (const d of disparos) {
          const camp = campMap.get(d.campaign_id);
          const falhou = d.status === "failed" || d.status === "error";
          ev.push({
            id: `disp-${d.id}`, at: d.sent_at || d.failed_at || d.created_at, category: "disparo",
            tone: d.status === "read" ? "good" : falhou ? "bad" : d.status === "skipped" ? "warn" : "neutral",
            title: `Disparo: ${camp?.template_name || "template"}`,
            detail: `${rotuloDisparo[d.status] || d.status}${d.error_text && (falhou || d.status === "skipped") ? ` · ${curto(d.error_text, 120)}` : ""}`,
            actor: camp?.created_by_name || null,
          });
        }

        // conversas: um resumo por dia e por canal (quantas do lead, do time e da IA + o que o lead falou primeiro)
        const canalDe = new Map<string, string>();
        for (const c of waConvs) canalDe.set(c.id, c.official_instance?.display_name ? `WhatsApp oficial (${c.official_instance.display_name})` : `WhatsApp${c.instance?.display_name || c.instance?.instance_name ? ` (${c.instance.display_name || c.instance.instance_name})` : ""}`);
        for (const c of igConvs) canalDe.set(c.id, "Instagram");
        const diaBR = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);
        const grupos = new Map<string, { at: string; canal: string; lead: number; time: number; ia: number; fala: string }>();
        for (const m of [...(waMsgRes.data || []), ...(igMsgRes.data || [])] as any[]) {
          if (!m.created_at) continue;
          const chave = `${m.conversation_id}|${diaBR(m.created_at)}`;
          let g = grupos.get(chave);
          if (!g) { g = { at: m.created_at, canal: canalDe.get(m.conversation_id) || "Conversa", lead: 0, time: 0, ia: 0, fala: "" }; grupos.set(chave, g); }
          if (m.created_at < g.at) g.at = m.created_at;
          if (m.direction === "inbound") {
            g.lead++;
            // a lista vem da mais nova pra mais antiga: a última atribuição é a primeira fala do dia
            if (String(m.content || "").trim()) g.fala = String(m.content);
          } else if (m.is_ai) g.ia++; else g.time++;
        }
        for (const [chave, g] of grupos) {
          const partes = [g.lead ? `${g.lead} do lead` : "", g.time ? `${g.time} do time` : "", g.ia ? `${g.ia} da IA` : ""].filter(Boolean).join(", ");
          ev.push({
            id: `conv-${chave}`, at: g.at, category: "conversa", tone: g.lead ? "good" : "neutral",
            title: g.lead ? `Conversa no ${g.canal}` : `Mensagem enviada no ${g.canal}, sem resposta do lead`,
            detail: partes ? `Mensagens no dia: ${partes}` : null,
            note: g.fala ? `Lead: "${curto(g.fala)}"` : null,
          });
        }

        // ações do agente de IA que valem como passo do percurso (a resposta comum já entra no resumo da conversa)
        for (const r of runs) {
          const agente = r.agent_id ? agMap.get(r.agent_id) || "Agente de IA" : "Agente de IA";
          const saida = String(r.outcome || "");
          const ferramentas: string[] = (Array.isArray(r.tool_calls) ? r.tool_calls : []).map((t: any) => String(t).match(/^([a-z_]+)\(/i)?.[1] || "").filter(Boolean);
          const base = { at: r.created_at, category: "ia" as Category, actor: agente };
          if (r.mode === "followup" && saida.startsWith("sent")) {
            ev.push({ ...base, id: `ia-fu-${r.id}`, title: `Follow-up da IA${saida.match(/\((.+)\)/) ? ` (${saida.match(/\((.+)\)/)![1]})` : ""}`, note: curto(r.reply, 220) || null });
          } else if (r.mode === "retorno" && saida.startsWith("sent")) {
            ev.push({ ...base, id: `ia-ret-${r.id}`, title: "IA voltou no horário combinado com o lead", note: curto(r.reply, 220) || null });
          } else if (r.mode === "confirmacao" && saida.startsWith("sent")) {
            ev.push({ ...base, id: `ia-conf-${r.id}`, tone: /liberad/.test(saida) ? "warn" : "neutral", title: /liberad/.test(saida) ? "IA liberou o horário da reunião (lead não confirmou)" : "IA pediu confirmação da reunião", note: curto(r.reply, 220) || null });
          } else if (r.mode === "resgate" && saida.startsWith("sent")) {
            ev.push({ ...base, id: `ia-resg-${r.id}`, title: "IA retomou conversa que tinha ficado sem resposta", note: curto(r.reply, 220) || null });
          }
          if (/handoff/.test(saida) || ferramentas.includes("transferir_para_humano")) {
            ev.push({ ...base, id: `ia-hand-${r.id}`, tone: "warn", title: "IA passou a conversa pra uma pessoa do time", note: curto(r.reply, 220) || null });
          }
          if (/lost_closed|recusa/.test(saida)) ev.push({ ...base, id: `ia-rec-${r.id}`, tone: "bad", title: "Lead recusou e a IA encerrou a conversa", note: curto(r.reply, 220) || null });
          if (/opt/.test(saida)) ev.push({ ...base, id: `ia-opt-${r.id}`, tone: "bad", title: "Lead pediu pra parar de receber mensagens" });
          if (ferramentas.includes("consultar_horarios")) ev.push({ ...base, id: `ia-hor-${r.id}`, title: "Tentativa de agendamento: IA ofereceu horários", note: curto(r.reply, 220) || null });
          if (ferramentas.includes("agendar_reuniao")) ev.push({ ...base, id: `ia-ag-${r.id}`, tone: "good", title: "IA agendou a reunião", note: curto(r.reply, 220) || null });
          if (ferramentas.includes("marcar_fora_do_perfil")) ev.push({ ...base, id: `ia-icp-${r.id}`, tone: "bad", title: "IA marcou o lead como fora do perfil" });
          if (ferramentas.includes("marcar_perdido")) ev.push({ ...base, id: `ia-perd-${r.id}`, tone: "bad", title: "IA marcou o negócio como perdido" });
        }

        // retornos combinados com o lead
        for (const r of retornos) {
          const quando = r.due_at ? format(new Date(r.due_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : "";
          ev.push({
            id: `ret-${r.id}`, at: r.created_at, category: "ia", tone: r.status === "sent" ? "good" : "neutral",
            title: `Retorno combinado${quando ? ` pra ${quando}` : ""}`,
            detail: r.status === "sent" ? "A IA voltou no horário" : r.status === "pending" ? "Aguardando o horário" : "Substituído (o lead falou antes ou houve novo combinado)",
            note: curto(r.motivo, 200) || null,
          });
        }

        // cadências
        for (const c of cadencias) {
          const nome = cadMap.get(c.cadence_id) || "cadência";
          ev.push({ id: `cad-${c.id}`, at: c.enrolled_at || c.created_at, category: "mensagem", title: `Entrou na cadência "${nome}"`,
            detail: c.status === "stopped" ? `Parou${c.stopped_reason ? `: ${String(c.stopped_reason).replace(/_/g, " ")}` : ""}` : c.status === "completed" ? "Concluída" : "Em andamento" });
        }

        // etiquetas
        for (const t of tagsLead) {
          if (!t.created_at) continue;
          ev.push({ id: `tag-${t.id}`, at: t.created_at, category: "etiqueta", title: `Etiqueta adicionada: ${tagMap.get(t.tag_id) || "etiqueta"}` });
        }
      } catch (e) {
        console.error("Percurso: fontes de conversa, disparo e IA falharam", e);
      }

      // ── desfecho de perda quando não veio como etapa final ────────────────────
      if (lead.closed_at && (lossName || lead.loss_reason_id)) {
        const jaTemPerda = ev.some((e) => e.tone === "bad" && e.title.startsWith("Perdido"));
        if (!jaTemPerda) {
          ev.push({ id: "lost", at: lead.closed_at, category: "marco", tone: "bad", title: "Marcado como perdido", detail: lossName ? `Motivo: ${lossName}` : null });
        } else if (lossName) {
          const marco = ev.find((e) => e.tone === "bad" && e.title.startsWith("Perdido"));
          if (marco && !marco.detail) marco.detail = `Motivo: ${lossName}`;
        }
      }

      // dedupe de notas: o mesmo texto costuma ser gravado em crm_lead_history E
      // em crm_activities (mesma nota, minuto e conteúdo) — mantém só a primeira.
      const seenNota = new Set<string>();
      const deduped = ev.filter((e) => {
        if (e.category !== "nota") return true;
        const key = `${new Date(e.at).toISOString().slice(0, 16)}|${(e.note || e.title || "").trim().slice(0, 60)}`;
        if (seenNota.has(key)) return false;
        seenNota.add(key);
        return true;
      });

      deduped.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      setEvents(deduped);
    } catch (error) {
      console.error("Erro ao montar o percurso do lead:", error);
    } finally {
      setLoading(false);
    }
  };

  const shown = useMemo(() => {
    const base = filterCat === "all" ? events : events.filter((e) => e.category === filterCat);
    return order === "desc" ? [...base].reverse() : base;
  }, [events, filterCat, order]);

  const toneRing: Record<string, string> = {
    good: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
    bad: "bg-rose-500/10 text-rose-600 ring-rose-500/20",
    warn: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
    neutral: "bg-muted text-foreground ring-border",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[190px] h-9">
            <ListFilter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Tudo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tudo</SelectItem>
            <SelectItem value="etapa">Mudanças de etapa</SelectItem>
            <SelectItem value="reuniao">Reuniões</SelectItem>
            <SelectItem value="ligacao">Ligações</SelectItem>
            <SelectItem value="mensagem">Mensagens e follow-ups</SelectItem>
            <SelectItem value="conversa">Conversas</SelectItem>
            <SelectItem value="disparo">Disparos</SelectItem>
            <SelectItem value="ia">Agente de IA</SelectItem>
            <SelectItem value="etiqueta">Etiquetas</SelectItem>
            <SelectItem value="nota">Notas</SelectItem>
            <SelectItem value="proposta">Propostas</SelectItem>
            <SelectItem value="pagamento">Pagamentos</SelectItem>
            <SelectItem value="diagnostico">Diagnósticos</SelectItem>
            <SelectItem value="marco">Marcos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}>
          <ArrowDownUp className="h-4 w-4" />
          {order === "desc" ? "Mais recente" : "Desde a entrada"}
        </Button>
        {pipelineName && (
          <Badge variant="outline" className="gap-1 text-[11px]"><Building2 className="h-3 w-3" />Funil atual: {pipelineName}</Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{shown.length} de {events.length} eventos</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6">
          {shown.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Nenhum evento no percurso ainda.</div>
          ) : (
            <div className="relative pl-2">
              <div className="absolute left-[27px] top-2 bottom-2 w-px bg-border" aria-hidden />
              <div className="space-y-4">
                {shown.map((e) => {
                  const meta = CATEGORY_META[e.category];
                  const Icon = meta.icon;
                  return (
                    <div key={e.id} className="flex gap-4">
                      <div className="flex-shrink-0 relative z-10">
                        <div className={cn("w-[38px] h-[38px] rounded-full flex items-center justify-center ring-4 ring-background", toneRing[e.tone || "neutral"])}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <p className="font-medium text-sm leading-snug">{e.title}</p>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap" title={format(new Date(e.at), "dd/MM/yyyy HH:mm", { locale: ptBR })}>
                            {format(new Date(e.at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {e.detail && <p className="text-xs text-muted-foreground mt-1">{e.detail}</p>}
                        {e.note && (
                          <p className="text-xs mt-1.5 rounded-md bg-muted/60 border border-border px-2.5 py-1.5 whitespace-pre-wrap">{e.note}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                          <span className="uppercase tracking-wide">{meta.label}</span>
                          <span>·</span>
                          <span>{formatDistanceToNow(new Date(e.at), { locale: ptBR, addSuffix: true })}</span>
                          {e.actor && (<><span>·</span><span className="font-medium text-foreground/70">{e.actor}</span></>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
