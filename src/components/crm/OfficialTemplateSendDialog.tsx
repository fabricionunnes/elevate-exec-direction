// Envio de TEMPLATE pela API oficial do WhatsApp (Cloud API / Meta).
// A Meta só deixa a empresa INICIAR conversa com template aprovado; texto livre
// só nas 24h depois que o lead responde. Este dialog é o único lugar do CRM que
// dispara template: tela do lead (1 lead), Negócios em massa (N leads) e
// Atendimento (conversa da API oficial). Cada envio vira contato + conversa +
// mensagem no Atendimento (a Cloud API não ecoa o que envia).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";

export interface OfficialTemplateLead {
  id: string | null;
  name: string | null;
  phone: string | null;
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

const digits = (p: string) => (p || "").replace(/\D/g, "");
/** telefone no formato que a Cloud API espera: 55 + DDD + número */
const toE164BR = (raw: string) => {
  let d = digits(raw);
  if (!d) return "";
  if (!d.startsWith("55") || d.length < 12) d = `55${d}`;
  return d;
};
const firstName = (name: string | null) => (name || "").trim().split(/\s+/)[0] || "";

/** substitui {{n}} pelos valores, e nos valores troca {primeiro_nome}/{nome}/{sdr} por lead */
function render(body: string, values: string[], lead: OfficialTemplateLead, staffName: string) {
  const resolve = (v: string) =>
    v.replace(/\{primeiro_nome\}/gi, firstName(lead.name))
     .replace(/\{nome\}/gi, (lead.name || "").trim())
     .replace(/\{sdr\}/gi, staffName);
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => resolve(values[Number(n) - 1] || ""));
}

export function OfficialTemplateSendDialog({ open, onOpenChange, leads, leadIds, conversationId, onSent }: Props) {
  const [instances, setInstances] = useState<OfficialInstance[]>([]);
  const [instanceId, setInstanceId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState<string>("");
  const [values, setValues] = useState<string[]>([]);
  const [targets, setTargets] = useState<OfficialTemplateLead[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ ok: number; fail: number; total: number } | null>(null);

  // quem está enviando + instâncias oficiais liberadas
  useEffect(() => {
    if (!open) return;
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

        if (leads?.length) setTargets(leads);
        else if (leadIds?.length) {
          const { data } = await supabase.from("crm_leads").select("id, name, phone").in("id", leadIds);
          setTargets((data || []) as OfficialTemplateLead[]);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
  const preview = validTargets[0] ? render(body, values, validTargets[0], staff?.name || "") : render(body, values, { id: null, name: "Lead", phone: null }, staff?.name || "");

  const handleSend = async () => {
    if (!instanceId || !template || !validTargets.length) return;
    if (values.some((v) => !v.trim())) { toast.error("Preencha todas as variáveis do template"); return; }
    setSending(true);
    setProgress({ ok: 0, fail: 0, total: validTargets.length });
    let ok = 0, fail = 0;
    for (const lead of validTargets) {
      const phone = toE164BR(lead.phone || "");
      const rendered = render(body, values, lead, staff?.name || "");
      const params = values.map((v) => ({
        type: "text",
        text: v.replace(/\{primeiro_nome\}/gi, firstName(lead.name)).replace(/\{nome\}/gi, (lead.name || "").trim()).replace(/\{sdr\}/gi, staff?.name || ""),
      }));
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-official-api", {
          body: {
            action: "sendTemplate", instanceId, phone,
            templateName: template.name, languageCode: template.language,
            components: params.length ? [{ type: "body", parameters: params }] : [],
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        await registrarNoAtendimento({ instanceId, lead, phone, content: rendered, messageId: data?.messageId || null, staffId: staff?.id || null, conversationId: conversationId || null });
        ok++;
      } catch (e) {
        console.error("template oficial:", lead.name, e);
        fail++;
      }
      setProgress({ ok, fail, total: validTargets.length });
    }
    setSending(false);
    if (ok) toast.success(`${ok} template(s) enviado(s)${fail ? `, ${fail} com erro` : ""}`);
    else toast.error("Nenhum envio concluído — veja o console");
    onSent?.();
    if (!fail) onOpenChange(false);
  };

  const semTelefone = targets.length - validTargets.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
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
              <Badge variant="secondary">{validTargets.length} destinatário(s)</Badge>
              {semTelefone > 0 && <Badge variant="destructive">{semTelefone} sem telefone válido</Badge>}
            </div>

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

            {template && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Prévia{validTargets[0]?.name ? ` · ${validTargets[0].name}` : ""}</div>
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
          <Button onClick={handleSend} disabled={sending || loading || !template || !validTargets.length}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {validTargets.length > 1 ? `Disparar pra ${validTargets.length}` : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** contato + conversa (official_instance_id) + mensagem — mesmo formato do whatsapp-official-webhook */
async function registrarNoAtendimento(a: {
  instanceId: string; lead: OfficialTemplateLead; phone: string; content: string;
  messageId: string | null; staffId: string | null; conversationId: string | null;
}) {
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
    if (!contact) return;
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
  if (!convId) return;
  await supabase.from("crm_whatsapp_messages").insert({
    conversation_id: convId, content: a.content, type: "text", direction: "outbound", status: "sent",
    sent_by: a.staffId, whatsapp_message_id: a.messageId,
  } as any);
  await supabase.from("crm_whatsapp_conversations").update({
    last_message: a.content.substring(0, 255), last_message_at: new Date().toISOString(),
  }).eq("id", convId);
}
