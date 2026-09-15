// Envio de TEMPLATE pela API oficial do WhatsApp (Cloud API / Meta).
// A Meta só deixa a empresa INICIAR conversa com template aprovado; texto livre
// só nas 24h depois que o lead responde. Este dialog é o único lugar do CRM que
// dispara template: tela do lead (1 lead), Negócios em massa (N leads) e
// Atendimento (conversa da API oficial). Cada envio vira contato + conversa +
// mensagem no Atendimento (a Cloud API não ecoa o que envia).
//
// Todo disparo vira um registro em whatsapp_official_campaigns com um
// destinatário por lead (enviado, erro no envio, pulado) e abre a tela
// /crm/disparos/:id no fim. Antes o dialog ficava aberto quando havia erro e um
// novo clique reenviava pra todo mundo (15/09/2026: 26 leads receberam 2x).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";

export interface OfficialTemplateLead {
  id: string | null;
  name: string | null;
  phone: string | null;
  stage_id?: string | null;
  pipeline_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** leads já carregados (tela do lead / Atendimento) */
  leads?: OfficialTemplateLead[];
  /** ids pra buscar (Negócios em massa) */
  leadIds?: string[];
  /** conversa do Atendimento já aberta pela API oficial (grava a mensagem nela) */
  conversationId?: string | null;
  onSent?: () => void;
}

interface OfficialInstance { id: string; display_name: string | null; phone_number: string | null }
interface TemplateComponent { type: string; text?: string; format?: string; buttons?: { type: string; text: string }[] }
interface Template { id: string; name: string; language: string; status: string; category: string; components: TemplateComponent[] }
interface Stage { id: string; name: string; pipeline_id: string; sort_order: number; is_final: boolean | null; final_type: string | null }

const RECENT_DAYS = 7;
const TAG_NAME = "Template enviado";

const digits = (p: string) => (p || "").replace(/\D/g, "");
/** telefone no formato que a Cloud API espera: 55 + DDD + número */
const toE164BR = (raw: string) => {
  let d = digits(raw);
  if (!d) return "";
  if (!d.startsWith("55") || d.length < 12) d = `55${d}`;
  return d;
};
/** "RENATA SOUZA" → "Renata"; nome vazio vira "tudo bem" (a Meta recusa variável vazia) */
const firstName = (name: string | null) => {
  const f = (name || "").trim().split(/\s+/)[0] || "";
  if (!f) return "";
  return f === f.toUpperCase() ? f.charAt(0) + f.slice(1).toLowerCase() : f;
};
const chunk = <T,>(arr: T[], n: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/** valor da variável pro lead. A Meta recusa texto vazio, quebra de linha, tab e 4+ espaços. */
function resolveVar(v: string, lead: OfficialTemplateLead, staffName: string) {
  const primeiro = firstName(lead.name) || "tudo bem";
  const out = v
    .replace(/\{primeiro_nome\}/gi, primeiro)
    .replace(/\{nome\}/gi, (lead.name || "").trim() || primeiro)
    .replace(/\{sdr\}/gi, staffName)
    .replace(/[\n\t\r]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
  return out || "tudo bem";
}

function render(body: string, values: string[], lead: OfficialTemplateLead, staffName: string) {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => resolveVar(values[Number(n) - 1] || "", lead, staffName));
}

export function OfficialTemplateSendDialog({ open, onOpenChange, leads, leadIds, conversationId, onSent }: Props) {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<OfficialInstance[]>([]);
  const [instanceId, setInstanceId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState<string>("");
  const [values, setValues] = useState<string[]>([]);
  const [targets, setTargets] = useState<OfficialTemplateLead[]>([]);
  const [optOutTargets, setOptOutTargets] = useState<OfficialTemplateLead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [moveMode, setMoveMode] = useState<string>("next");
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());
  const [skipRecent, setSkipRecent] = useState(true);
  const [staff, setStaff] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ ok: number; fail: number; total: number } | null>(null);
  const [limite, setLimite] = useState<{ dailyLimit: number | null; usados: number } | null>(null);

  // quem está enviando + instâncias oficiais liberadas + leads com etapa atual
  useEffect(() => {
    if (!open) return;
    setProgress(null);
    setMoveMode("next");
    setSkipRecent(true);
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: st } = await supabase.from("onboarding_staff")
          .select("id, name, role").eq("user_id", user?.id || "").eq("is_active", true).maybeSingle();
        if (st) setStaff({ id: st.id, name: st.name });
        let list: OfficialInstance[] = [];
        if (st?.role === "master" || st?.role === "admin") {
          const { data } = await supabase.from("whatsapp_official_instances")
            .select("id, display_name, phone_number").eq("status", "connected");
          list = (data || []) as OfficialInstance[];
        } else if (st) {
          const { data } = await supabase.from("whatsapp_official_instance_access")
            .select("instance:whatsapp_official_instances(id, display_name, phone_number, status)")
            .eq("staff_id", st.id).eq("can_send", true);
          list = (data || []).map((a: any) => a.instance).filter((i: any) => i && i.status === "connected");
        }
        setInstances(list);
        if (list.length && !instanceId) setInstanceId(list[0].id);

        // leads com etapa/funil (pra mover pra próxima etapa depois do envio)
        const idsToFetch = leads?.length
          ? (leads.map((l) => l.id).filter(Boolean) as string[])
          : (leadIds || []);
        const fetched = new Map<string, OfficialTemplateLead>();
        for (const part of chunk(idsToFetch, 150)) {
          const { data } = await supabase.from("crm_leads").select("id, name, phone, stage_id, pipeline_id").in("id", part);
          for (const l of (data || []) as OfficialTemplateLead[]) if (l.id) fetched.set(l.id, l);
        }
        const baseTargets: OfficialTemplateLead[] = leads?.length
          ? leads.map((l) => (l.id && fetched.has(l.id) ? { ...fetched.get(l.id)!, name: l.name || fetched.get(l.id)!.name, phone: l.phone || fetched.get(l.id)!.phone } : l))
          : Array.from(fetched.values());

        // Quem pediu pra parar (tag "Opt-out") nunca entra no disparo
        const ids = baseTargets.map((t) => t.id).filter(Boolean) as string[];
        const optOut = new Set<string>();
        for (const part of chunk(ids, 150)) {
          const { data: lt } = await supabase.from("crm_lead_tags").select("lead_id, tag:crm_tags!inner(name)").in("lead_id", part).ilike("tag.name", "opt-out");
          for (const r of lt || []) optOut.add((r as any).lead_id);
        }
        setOptOutTargets(baseTargets.filter((t) => t.id && optOut.has(t.id)));
        setTargets(baseTargets.filter((t) => !t.id || !optOut.has(t.id)));

        const pipelineIds = Array.from(new Set(baseTargets.map((t) => t.pipeline_id).filter(Boolean))) as string[];
        if (pipelineIds.length) {
          const { data: stg } = await supabase.from("crm_stages")
            .select("id, name, pipeline_id, sort_order, is_final, final_type")
            .in("pipeline_id", pipelineIds).order("sort_order");
          setStages((stg || []) as Stage[]);
        } else {
          setStages([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // limite diário da Meta (contatos únicos com template em 24h) e quanto já foi usado
  useEffect(() => {
    if (!open || !instanceId) return;
    (async () => {
      const desde = new Date(Date.now() - 864e5).toISOString();
      const [res, rec] = await Promise.all([
        supabase.functions.invoke("whatsapp-official-api", { body: { action: "getLimits", instanceId } }),
        supabase.from("whatsapp_official_campaign_recipients").select("phone").in("status", ["sent", "delivered", "read"]).gte("sent_at", desde).limit(10000),
      ]);
      if (res.error || res.data?.error) { setLimite(null); return; }
      const usados = new Set(((rec.data || []) as any[]).map((r) => r.phone).filter(Boolean)).size;
      setLimite({ dailyLimit: res.data?.dailyLimit ?? null, usados });
    })();
  }, [open, instanceId]);

  // templates aprovados da instância escolhida
  useEffect(() => {
    if (!open || !instanceId) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-official-api", {
        body: { action: "getTemplates", instanceId },
      });
      if (error || data?.error) { toast.error("Não consegui carregar os templates da Meta"); return; }
      const approved = ((data?.templates || []) as Template[]).filter((t) => t.status === "APPROVED");
      setTemplates(approved);
      if (approved.length && !approved.some((t) => t.name === templateName)) setTemplateName(approved[0].name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instanceId]);

  // quem já recebeu ESTE template nos últimos 7 dias (evita mandar 2x)
  useEffect(() => {
    if (!open || !templateName || !targets.length) { setRecentIds(new Set()); return; }
    (async () => {
      const since = new Date(Date.now() - RECENT_DAYS * 864e5).toISOString();
      const ids = targets.map((t) => t.id).filter(Boolean) as string[];
      const found = new Set<string>();
      for (const part of chunk(ids, 150)) {
        const { data } = await supabase.from("whatsapp_official_campaign_recipients")
          .select("lead_id, campaign:whatsapp_official_campaigns!inner(template_name)")
          .in("lead_id", part)
          .in("status", ["sent", "delivered", "read"])
          .gte("sent_at", since)
          .eq("campaign.template_name", templateName);
        for (const r of data || []) if ((r as any).lead_id) found.add((r as any).lead_id);
      }
      setRecentIds(found);
    })();
  }, [open, templateName, targets]);

  const template = useMemo(() => templates.find((t) => t.name === templateName) || null, [templates, templateName]);
  const body = template?.components.find((c) => c.type === "BODY")?.text || "";
  const varCount = useMemo(() => {
    const m = body.match(/\{\{\d+\}\}/g) || [];
    return new Set(m).size;
  }, [body]);

  // defaults: {{1}} = primeiro nome do lead, {{2}} = quem envia
  useEffect(() => {
    if (!template) return;
    setValues((prev) => {
      const next = [...prev].slice(0, varCount);
      while (next.length < varCount) next.push("");
      if (varCount >= 1 && !next[0]) next[0] = "{primeiro_nome}";
      if (varCount >= 2 && !next[1] && /^(primeiro_contato|reativacao)/.test(template.name)) next[1] = "{sdr}";
      return next;
    });
  }, [template, varCount]);

  const validTargets = targets.filter((t) => toE164BR(t.phone || "").length >= 12);
  const recentTargets = validTargets.filter((t) => t.id && recentIds.has(t.id));
  const sendable = skipRecent ? validTargets.filter((t) => !(t.id && recentIds.has(t.id))) : validTargets;
  const semTelefone = targets.length - validTargets.length;
  const preview = sendable[0] ? render(body, values, sendable[0], staff?.name || "") : render(body, values, { id: null, name: "Lead", phone: null }, staff?.name || "");

  // funil mais comum entre os leads (opções de etapa fixa)
  const mainPipelineId = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of targets) if (t.pipeline_id) count.set(t.pipeline_id, (count.get(t.pipeline_id) || 0) + 1);
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [targets]);
  const mainStages = stages.filter((s) => s.pipeline_id === mainPipelineId);

  const nextStageFor = (lead: OfficialTemplateLead): Stage | null => {
    if (!lead.stage_id || !lead.pipeline_id) return null;
    const list = stages.filter((s) => s.pipeline_id === lead.pipeline_id).sort((a, b) => a.sort_order - b.sort_order);
    const cur = list.find((s) => s.id === lead.stage_id);
    if (!cur || cur.is_final || cur.final_type) return null;
    return list.find((s) => s.sort_order > cur.sort_order && !s.is_final && !s.final_type) || null;
  };
  const nextExample = useMemo(() => {
    const lead = sendable.find((t) => nextStageFor(t));
    if (!lead) return null;
    const cur = stages.find((s) => s.id === lead.stage_id);
    const nxt = nextStageFor(lead);
    return cur && nxt ? `${cur.name} → ${nxt.name}` : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendable, stages]);

  const moverLead = async (lead: OfficialTemplateLead): Promise<{ from: string | null; to: string } | null> => {
    if (!lead.id || moveMode === "none") return null;
    let to: Stage | null = null;
    if (moveMode === "next") to = nextStageFor(lead);
    else to = stages.find((s) => s.id === moveMode) || null;
    if (!to || to.id === lead.stage_id) return null;
    const upd: Record<string, string> = { stage_id: to.id };
    if (to.pipeline_id !== lead.pipeline_id) upd.pipeline_id = to.pipeline_id;
    const { error } = await supabase.from("crm_leads").update(upd).eq("id", lead.id);
    if (error) { console.error("mover lead após disparo:", lead.name, error); return null; }
    return { from: lead.stage_id || null, to: to.id };
  };

  const handleSend = async () => {
    if (sending || !instanceId || !template || !sendable.length) return;
    if (values.some((v) => !v.trim())) { toast.error("Preencha todas as variáveis do template"); return; }
    setSending(true);
    setProgress({ ok: 0, fail: 0, total: sendable.length });

    const bodyPreview = render(body, values, { id: null, name: "{primeiro_nome}", phone: null }, staff?.name || "");
    const { data: camp, error: campErr } = await supabase.from("whatsapp_official_campaigns").insert({
      official_instance_id: instanceId,
      template_name: template.name,
      template_language: template.language,
      template_category: template.category,
      body_preview: bodyPreview,
      variables: values,
      created_by_staff_id: staff?.id || null,
      created_by_name: staff?.name || null,
      source: conversationId ? "atendimento" : leads?.length ? "lead" : "negocios",
      move_mode: moveMode === "next" || moveMode === "none" ? moveMode : "stage",
      move_stage_id: moveMode === "next" || moveMode === "none" ? null : moveMode,
      tag_name: TAG_NAME,
      total: targets.length + optOutTargets.length,
      status: "sending",
    } as any).select("id").single();
    if (campErr || !camp) {
      console.error("criar disparo:", campErr);
      toast.error("Não consegui registrar o disparo. Nada foi enviado.");
      setSending(false);
      setProgress(null);
      return;
    }

    const recipientId = new Map<OfficialTemplateLead, string>();
    const base = (t: OfficialTemplateLead) => ({ campaign_id: camp.id, lead_id: t.id, lead_name: t.name, phone: toE164BR(t.phone || "") || t.phone });
    const rows: any[] = [];
    for (const t of sendable) {
      const id = crypto.randomUUID();
      recipientId.set(t, id);
      rows.push({ id, ...base(t), status: "pending" });
    }
    for (const t of targets.filter((x) => toE164BR(x.phone || "").length < 12)) rows.push({ ...base(t), status: "skipped", error_text: "Sem telefone válido" });
    if (skipRecent) for (const t of recentTargets) rows.push({ ...base(t), status: "skipped", error_text: `Já recebeu este template nos últimos ${RECENT_DAYS} dias` });
    for (const t of optOutTargets) rows.push({ ...base(t), status: "skipped", error_text: "Pediu pra não receber (Opt-out)" });
    for (const part of chunk(rows, 500)) {
      const { error } = await supabase.from("whatsapp_official_campaign_recipients").insert(part);
      if (error) console.error("registrar destinatários:", error);
    }

    let ok = 0, fail = 0;
    for (const lead of sendable) {
      const recId = recipientId.get(lead)!;
      const phone = toE164BR(lead.phone || "");
      const rendered = render(body, values, lead, staff?.name || "");
      const params = values.map((v) => ({ type: "text", text: resolveVar(v, lead, staff?.name || "") }));
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-official-api", {
          body: {
            action: "sendTemplate", instanceId, phone,
            templateName: template.name, languageCode: template.language,
            components: params.length ? [{ type: "body", parameters: params }] : [],
          },
        });
        if (error) {
          let msg = error.message;
          try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* corpo não é JSON */ }
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        const wamid: string | null = data?.messageId || null;
        const sentAt = new Date().toISOString();
        // grava o wamid já: o status da Meta (entregue/falhou) chega em segundos
        await supabase.from("whatsapp_official_campaign_recipients").update({ status: "sent", whatsapp_message_id: wamid, sent_at: sentAt }).eq("id", recId);
        const reg = await registrarNoAtendimento({ instanceId, lead, phone, content: rendered, messageId: wamid, staffId: staff?.id || null, conversationId: conversationId || null });
        if (lead.id) await marcarTagTemplateEnviado(lead.id);
        const mv = await moverLead(lead);
        const { data: cur } = await supabase.from("whatsapp_official_campaign_recipients")
          .update({ message_id: reg?.messageId || null, conversation_id: reg?.conversationId || null, moved_from_stage_id: mv?.from || null, moved_to_stage_id: mv?.to || null })
          .eq("id", recId).select("status").maybeSingle();
        // a falha chegou antes de mover: volta o lead pra etapa de antes
        if (mv && cur?.status === "failed" && lead.id && mv.from) {
          await supabase.from("crm_leads").update({ stage_id: mv.from, pipeline_id: lead.pipeline_id }).eq("id", lead.id).eq("stage_id", mv.to);
          await supabase.from("whatsapp_official_campaign_recipients").update({ stage_reverted: true }).eq("id", recId);
        }
        ok++;
      } catch (e) {
        console.error("template oficial:", lead.name, e);
        await supabase.from("whatsapp_official_campaign_recipients")
          .update({ status: "error", error_text: String((e as Error)?.message || e).slice(0, 500) }).eq("id", recId);
        fail++;
      }
      setProgress({ ok, fail, total: sendable.length });
    }

    await supabase.from("whatsapp_official_campaigns").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", camp.id);
    setSending(false);
    if (ok) toast.success(`${ok} template(s) enviado(s)${fail ? `, ${fail} com erro` : ""}`);
    else toast.error("Nenhum envio concluído. Veja os motivos no histórico do disparo.");
    onSent?.();
    onOpenChange(false);
    navigate(`/crm/disparos/${camp.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Enviar template (API oficial)
          </DialogTitle>
          <DialogDescription>
            Template aprovado pela Meta. É assim que a empresa inicia conversa fora da janela de 24h.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</div>
        ) : !instances.length ? (
          <div className="py-6 text-sm text-muted-foreground">Nenhuma instância da API oficial conectada ou liberada pra você.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{sendable.length} destinatário(s)</Badge>
              {semTelefone > 0 && <Badge variant="destructive">{semTelefone} sem telefone válido</Badge>}
              {optOutTargets.length > 0 && <Badge variant="outline">{optOutTargets.length} pulado(s): pediram pra não receber</Badge>}
              {limite?.dailyLimit != null && (
                <Badge variant="outline">Limite Meta: restam {Math.max(limite.dailyLimit - limite.usados, 0)} de {limite.dailyLimit} em 24h</Badge>
              )}
            </div>

            {limite?.dailyLimit != null && sendable.length > Math.max(limite.dailyLimit - limite.usados, 0) && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2.5 text-xs">
                Esse disparo passa do limite diário da Meta: restam {Math.max(limite.dailyLimit - limite.usados, 0)} contatos nas próximas 24h e você vai enviar pra {sendable.length}. O que passar do limite a Meta recusa. Selecione menos leads ou mande o resto amanhã.
              </div>
            )}

            {recentTargets.length > 0 && (
              <div className="flex items-start justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                <span>
                  {recentTargets.length} lead(s) já receberam este template nos últimos {RECENT_DAYS} dias.
                  {skipRecent ? " Eles vão ficar de fora." : " Eles vão receber de novo."}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-muted-foreground">Pular</span>
                  <Switch checked={skipRecent} onCheckedChange={setSkipRecent} />
                </div>
              </div>
            )}

            {instances.length > 1 && (
              <div className="space-y-1">
                <Label>Número</Label>
                <Select value={instanceId} onValueChange={setInstanceId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.display_name || "API Oficial"} {i.phone_number ? `· ${i.phone_number}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Template</Label>
              {templates.length ? (
                <Select value={templateName} onValueChange={setTemplateName}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name} <span className="text-muted-foreground">· {t.category.toLowerCase()}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum template aprovado ainda. A Meta aprova em minutos ou horas; tente de novo depois.</p>
              )}
            </div>

            {template && varCount > 0 && (
              <div className="space-y-2">
                <Label>Variáveis <span className="text-muted-foreground font-normal">(use {"{primeiro_nome}"}, {"{nome}"} ou {"{sdr}"} pra preencher por lead)</span></Label>
                {Array.from({ length: varCount }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{`{{${i + 1}}}`}</span>
                    <Input value={values[i] || ""} onChange={(e) => setValues((v) => { const n = [...v]; n[i] = e.target.value; return n; })} placeholder={`Valor da variável ${i + 1}`} />
                  </div>
                ))}
              </div>
            )}

            {targets.some((t) => t.id) && (
              <div className="space-y-1">
                <Label>Depois de enviar, mover o lead para</Label>
                <Select value={moveMode} onValueChange={setMoveMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="next">Próxima etapa{nextExample ? ` (${nextExample})` : ""}</SelectItem>
                    <SelectItem value="none">Não mover</SelectItem>
                    {mainStages.filter((s) => !s.is_final && !s.final_type).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Todo lead enviado recebe a etiqueta "{TAG_NAME}". Se a Meta não entregar, o lead volta pra etapa de antes.
                </p>
              </div>
            )}

            {template && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Prévia{sendable[0]?.name ? ` · ${sendable[0].name}` : ""}</div>
                {preview}
                {template.components.find((c) => c.type === "BUTTONS")?.buttons?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.components.find((c) => c.type === "BUTTONS")!.buttons!.map((b) => (
                      <Badge key={b.text} variant="outline">{b.text}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {progress && (
              <p className="text-xs text-muted-foreground">Enviados {progress.ok} · erros {progress.fail} · total {progress.total}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || loading || !template || !sendable.length}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {sending ? "Enviando…" : sendable.length > 1 ? `Disparar pra ${sendable.length}` : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tag "Template enviado" no lead a cada disparo pela API oficial (pedido do Fabrício 11/09/2026).
 *  Cria a tag se não existir; ignora se o lead já tem. */
let _tagTemplateId: string | null = null;
async function marcarTagTemplateEnviado(leadId: string) {
  try {
    if (!_tagTemplateId) {
      const { data: t } = await supabase.from("crm_tags").select("id").ilike("name", TAG_NAME).limit(1).maybeSingle();
      if (t?.id) _tagTemplateId = t.id;
      else {
        const { data: created } = await supabase.from("crm_tags").insert({ name: TAG_NAME, color: "#2563eb", is_active: true }).select("id").single();
        _tagTemplateId = created?.id || null;
      }
    }
    if (!_tagTemplateId) return;
    await supabase.from("crm_lead_tags").upsert({ lead_id: leadId, tag_id: _tagTemplateId }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
  } catch (e) {
    console.error("tag Template enviado:", e);
  }
}

/** contato + conversa (official_instance_id) + mensagem — mesmo formato do whatsapp-official-webhook */
async function registrarNoAtendimento(a: {
  instanceId: string; lead: OfficialTemplateLead; phone: string; content: string;
  messageId: string | null; staffId: string | null; conversationId: string | null;
}): Promise<{ conversationId: string; messageId: string | null } | null> {
  let convId = a.conversationId;
  if (!convId) {
    let { data: contact } = await supabase.from("crm_whatsapp_contacts").select("id, lead_id").eq("phone", a.phone).maybeSingle();
    if (!contact) {
      const { data: created } = await supabase.from("crm_whatsapp_contacts")
        .insert({ phone: a.phone, name: a.lead.name || a.phone, lead_id: a.lead.id }).select("id, lead_id").single();
      contact = created;
    } else if (!contact.lead_id && a.lead.id) {
      await supabase.from("crm_whatsapp_contacts").update({ lead_id: a.lead.id }).eq("id", contact.id);
    }
    if (!contact) return null;
    const { data: conv } = await supabase.from("crm_whatsapp_conversations").select("id, lead_id")
      .eq("official_instance_id", a.instanceId).eq("contact_id", contact.id).neq("status", "closed")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (conv) {
      convId = conv.id;
      if (!conv.lead_id && a.lead.id) await supabase.from("crm_whatsapp_conversations").update({ lead_id: a.lead.id }).eq("id", conv.id);
    } else {
      const { data: created } = await supabase.from("crm_whatsapp_conversations")
        .insert({ official_instance_id: a.instanceId, contact_id: contact.id, lead_id: a.lead.id, status: "open" } as any)
        .select("id").single();
      convId = created?.id || null;
    }
  }
  if (!convId) return null;
  const { data: msg } = await supabase.from("crm_whatsapp_messages").insert({
    conversation_id: convId, content: a.content, type: "text", direction: "outbound", status: "sent",
    sent_by: a.staffId, whatsapp_message_id: a.messageId,
  } as any).select("id").maybeSingle();
  await supabase.from("crm_whatsapp_conversations").update({
    last_message: a.content.substring(0, 255), last_message_at: new Date().toISOString(),
  }).eq("id", convId);
  return { conversationId: convId, messageId: (msg as any)?.id || null };
}
