import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Newspaper, Sparkles, Loader2, Send, Copy, Check, ExternalLink, Clock,
} from "lucide-react";
import { sendLoggedWhatsAppText } from "@/lib/whatsapp/sendLoggedWhatsAppText";

interface Props {
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
}

interface FollowupOption {
  angle?: string;
  message: string;
  news_headline?: string;
  news_url?: string;
  news_source?: string;
}

interface InstanceOption {
  id: string;
  instance_name: string;
  status: string;
}

interface SentRow {
  id: string;
  message: string;
  angle: string | null;
  news_headline: string | null;
  sent_at: string;
}

export function CustomFollowupTab({ leadId, leadName, leadPhone }: Props) {
  const [generating, setGenerating] = useState(false);
  const [options, setOptions] = useState<FollowupOption[]>([]);
  const [sendingIdx, setSendingIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [staffId, setStaffId] = useState<string | null>(null);

  const [history, setHistory] = useState<SentRow[]>([]);

  // instâncias autorizadas do usuário (mesmo padrão do WhatsAppQuickSendButton)
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id).eq("is_active", true).maybeSingle();
        if (!staff) return;
        setStaffId(staff.id);

        let list: InstanceOption[] = [];
        if (staff.role === "master") {
          const { data } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_name, status")
            .eq("status", "connected").order("instance_name");
          list = data || [];
        } else {
          const { data: access } = await supabase
            .from("whatsapp_instance_access")
            .select("instance_id, instance:whatsapp_instances(id, instance_name, status)")
            .eq("staff_id", staff.id).eq("can_send", true);
          list = (access || [])
            .filter((a: any) => a.instance?.status === "connected")
            .map((a: any) => ({
              id: a.instance.id, instance_name: a.instance.instance_name, status: a.instance.status,
            }));
        }
        setInstances(list);
        if (list.length === 1) setSelectedInstance(list[0].id);
      } catch (err) {
        console.error("Erro ao carregar instâncias:", err);
      }
    })();
  }, []);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("crm_lead_followups" as any)
      .select("id, message, angle, news_headline, sent_at")
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: false })
      .limit(30);
    setHistory((data as any) || []);
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [leadId]);

  const generate = async () => {
    setGenerating(true);
    setOptions([]);
    try {
      const { data, error } = await supabase.functions.invoke("lead-followup", {
        body: { leadId, count: 4 },
      });
      if (error) throw error;
      if (data?.error) {
        const msgs: Record<string, string> = {
          ia_nao_configurada: "IA não configurada. Configure a chave de IA nas configurações.",
          sem_creditos: "Sem créditos de IA. Recarregue a carteira para gerar follow-ups.",
          ia_parse_failed: "A IA não retornou um resultado válido. Tente de novo.",
          ia_request_failed: "Falha ao chamar a IA. Tente novamente em instantes.",
        };
        toast.error(msgs[data.error] || data.detail || "Não foi possível gerar os follow-ups.");
        return;
      }
      const opts: FollowupOption[] = (data?.options || []).filter((o: any) => o?.message);
      if (!opts.length) {
        toast.error("A IA não trouxe opções. Tente novamente.");
        return;
      }
      setOptions(opts);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao gerar follow-ups.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { /* noop */ }
  };

  const send = async (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    if (!leadPhone) { toast.error("Este lead não tem telefone cadastrado."); return; }
    if (!instances.length) { toast.error("Você não tem instância de WhatsApp autorizada para envio."); return; }
    const instanceId = selectedInstance || (instances.length === 1 ? instances[0].id : "");
    if (!instanceId) { toast.error("Escolha a instância de WhatsApp para enviar."); return; }

    setSendingIdx(idx);
    try {
      await sendLoggedWhatsAppText({
        instanceId,
        phoneRaw: leadPhone,
        message: opt.message,
        leadId,
        leadName,
        staffId: staffId || undefined,
      });

      // registra no histórico → alimenta a continuidade da próxima geração
      await supabase.from("crm_lead_followups" as any).insert({
        lead_id: leadId,
        message: opt.message,
        angle: opt.angle || null,
        news_headline: opt.news_headline || null,
        news_url: opt.news_url || null,
        news_source: opt.news_source || null,
        instance_id: instanceId,
        sent_by: staffId || null,
        status: "sent",
      });

      toast.success("Follow-up enviado. A próxima geração vai dar continuidade a este.");
      setOptions((prev) => prev.filter((_, i) => i !== idx));
      loadHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao enviar o follow-up.");
    } finally {
      setSendingIdx(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 space-y-5">
      {/* Cabeçalho + ação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-orange-500" />
            Follow up personalizado
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A IA busca novidades reais do mercado e monta follow-ups ligados ao que a UNV faz.
            Cada envio dá continuidade ao anterior.
          </p>
        </div>
        <Button onClick={generate} disabled={generating} className="shrink-0">
          {generating
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando...</>
            : <><Sparkles className="h-4 w-4 mr-1.5" /> Gerar follow-ups</>}
        </Button>
      </div>

      {/* Seletor de instância */}
      {instances.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Enviar pela instância:</span>
          <Select value={selectedInstance} onValueChange={setSelectedInstance}>
            <SelectTrigger className="w-56 h-8 text-sm">
              <SelectValue placeholder="Escolha a instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Empty state */}
      {!generating && options.length === 0 && (
        <div className="text-center text-sm text-muted-foreground border border-dashed rounded-lg py-10">
          Clique em <span className="font-medium">Gerar follow-ups</span> para ver as opções personalizadas.
        </div>
      )}

      {generating && (
        <div className="text-center text-sm text-muted-foreground py-10 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando novidades e montando as opções...
        </div>
      )}

      {/* Opções geradas */}
      {options.map((opt, idx) => (
        <Card key={idx} className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {opt.angle && <Badge variant="secondary" className="font-normal">{opt.angle}</Badge>}
              {opt.news_headline && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Newspaper className="h-3 w-3" /> {opt.news_headline}
                  {opt.news_url && (
                    <a href={opt.news_url} target="_blank" rel="noopener noreferrer"
                       className="text-primary hover:underline inline-flex items-center gap-0.5">
                      {opt.news_source || "fonte"} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{opt.message}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => send(idx)} disabled={sendingIdx !== null}
                className="bg-green-600 hover:bg-green-700 text-white">
                {sendingIdx === idx
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>
                  : <><Send className="h-3.5 w-3.5 mr-1" /> Enviar</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(idx, opt.message)}>
                {copiedIdx === idx
                  ? <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Copiado</>
                  : <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Histórico enviado (a régua) */}
      {history.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Follow-ups já enviados ({history.length})
          </h4>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  <span>{new Date(h.sent_at).toLocaleDateString("pt-BR")}</span>
                  {h.angle && <Badge variant="outline" className="font-normal">{h.angle}</Badge>}
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{h.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomFollowupTab;
