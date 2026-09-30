// Agendar mensagem de WhatsApp (30/09/2026): usado pelo botão "Agendar" do chat (conversa
// já escolhida) e pela tela Configurações → Mensagens agendadas (busca a conversa).
// Grava em crm_scheduled_messages; quem envia é a edge function crm-scheduled-dispatch
// (cron a cada minuto), pelo mesmo caminho do botão Enviar.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Loader2, Search, CalendarClock, Check } from "lucide-react";
import { format, addHours, setHours, setMinutes, startOfMinute } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { applyQuickVariables, quickVariablesFor } from "./QuickResponsesPicker";

export interface ScheduleTarget {
  id: string;
  instance_id: string | null;
  official_instance_id: string | null;
  contact?: { phone: string; name: string | null } | null;
  lead?: { name: string } | null;
  instance?: { instance_name: string; display_name: string | null } | null;
  official_instance?: { display_name: string | null } | null;
}

export interface ScheduledRow {
  id: string;
  conversation_id: string | null;
  instance_id: string | null;
  official_instance_id: string | null;
  phone_number: string;
  message: string;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** conversa já escolhida (chat). Sem ela, o diálogo busca a conversa. */
  conversation?: ScheduleTarget | null;
  initialText?: string;
  /** editar uma agendada pendente */
  editing?: ScheduledRow | null;
  staffId?: string | null;
  onSaved?: () => void;
}

const nomeDe = (c: ScheduleTarget | null | undefined) => {
  const n = String(c?.lead?.name || c?.contact?.name || "").trim();
  return /[\p{L}]/u.test(n) ? n : c?.contact?.phone || "Sem nome";
};
const numeroDe = (c: ScheduleTarget | null | undefined) =>
  c?.instance ? c.instance.display_name || c.instance.instance_name : c?.official_instance ? `${c.official_instance.display_name || "API oficial"} (API oficial)` : "sem número";

export function ScheduleMessageDialog({ open, onOpenChange, conversation, initialText, editing, staffId, onSaved }: Props) {
  const [target, setTarget] = useState<ScheduleTarget | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ScheduleTarget[]>([]);
  const [searching, setSearching] = useState(false);
  const [date, setDate] = useState<Date>(() => startOfMinute(addHours(new Date(), 1)));
  const [time, setTime] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = editing ? new Date(editing.scheduled_at) : startOfMinute(addHours(new Date(), 1));
    setDate(base);
    setTime(format(base, "HH:mm"));
    setText(editing?.message ?? initialText ?? "");
    setSearch("");
    setResults([]);
    setTarget(conversation || null);
    if (editing?.conversation_id && !conversation) {
      (async () => {
        const { data } = await (supabase as any)
          .from("crm_whatsapp_conversations")
          .select("id, instance_id, official_instance_id, contact:crm_whatsapp_contacts(phone, name), lead:crm_leads(name), instance:whatsapp_instances(instance_name, display_name), official_instance:whatsapp_official_instances(display_name)")
          .eq("id", editing.conversation_id).maybeSingle();
        if (data) setTarget(data as ScheduleTarget);
      })();
    }
  }, [open, conversation, editing, initialText]);

  // Busca de conversa por nome ou telefone (só quando não veio do chat)
  useEffect(() => {
    if (!open || conversation || editing) return;
    const termo = search.trim();
    if (termo.length < 2) { setResults([]); return; }
    let ativo = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const digitsQ = termo.replace(/\D/g, "");
      const or = digitsQ.length >= 4 ? `name.ilike.%${termo}%,phone.ilike.%${digitsQ}%` : `name.ilike.%${termo}%`;
      const { data: contatos } = await (supabase as any).from("crm_whatsapp_contacts").select("id").or(or).limit(40);
      const ids = ((contatos || []) as any[]).map((c) => c.id);
      let convs: any[] = [];
      if (ids.length) {
        const { data } = await (supabase as any)
          .from("crm_whatsapp_conversations")
          .select("id, instance_id, official_instance_id, last_message_at, contact:crm_whatsapp_contacts(phone, name), lead:crm_leads(name), instance:whatsapp_instances(instance_name, display_name), official_instance:whatsapp_official_instances(display_name)")
          .in("contact_id", ids).is("merged_into", null)
          .order("last_message_at", { ascending: false, nullsFirst: false }).limit(20);
        convs = data || [];
      }
      if (!ativo) return;
      setResults(convs as ScheduleTarget[]);
      setSearching(false);
    }, 350);
    return () => { ativo = false; clearTimeout(t); };
  }, [search, open, conversation, editing]);

  const quando = useMemo(() => {
    const [h, m] = time.split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return setMinutes(setHours(date, h), m);
  }, [date, time]);

  const preview = useMemo(() => applyQuickVariables(text, quickVariablesFor(target)), [text, target]);
  const noPassado = quando ? quando.getTime() < Date.now() - 30000 : false;

  const salvar = async () => {
    if (!target && !editing) { toast.error("Escolha a conversa"); return; }
    if (!text.trim()) { toast.error("Escreva a mensagem"); return; }
    if (!quando) { toast.error("Informe a hora"); return; }
    if (noPassado) { toast.error("A data e hora já passaram"); return; }
    const alvo = target;
    if (alvo && !alvo.instance_id && !alvo.official_instance_id) { toast.error("Esta conversa não tem número associado pra enviar"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from("crm_scheduled_messages")
          .update({ message: text.trim(), scheduled_at: quando.toISOString(), status: "pending", error_message: null, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success(`Agendada para ${format(quando, "dd/MM 'às' HH:mm", { locale: ptBR })}`);
      } else {
        const { error } = await (supabase as any).from("crm_scheduled_messages").insert({
          conversation_id: alvo!.id,
          instance_id: alvo!.instance_id || null,
          official_instance_id: alvo!.instance_id ? null : alvo!.official_instance_id || null,
          phone_number: String(alvo!.contact?.phone || "").replace(/\D/g, ""),
          message: text.trim(),
          scheduled_at: quando.toISOString(),
          status: "pending",
          created_by: staffId || null,
        });
        if (error) throw error;
        toast.success(`Mensagem agendada para ${format(quando, "dd/MM 'às' HH:mm", { locale: ptBR })}`);
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não consegui agendar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{editing ? "Editar mensagem agendada" : "Agendar mensagem"}</DialogTitle>
          <DialogDescription>
            A mensagem sai sozinha na data e hora escolhidas, pelo número da conversa, e aparece no histórico como enviada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conversa */}
          <div className="space-y-1">
            <Label>Conversa</Label>
            {target ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{nomeDe(target)}</p>
                  <p className="text-xs text-muted-foreground truncate">{target.contact?.phone} · {numeroDe(target)}</p>
                </div>
                {!conversation && !editing && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTarget(null)}>Trocar</Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input autoFocus className="pl-8" placeholder="Nome ou telefone do contato" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {searching ? (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</div>
                  ) : results.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{search.trim().length < 2 ? "Digite pelo menos 2 caracteres" : "Nenhuma conversa encontrada"}</p>
                  ) : (
                    results.map((c) => (
                      <button key={c.id} type="button" onClick={() => setTarget(c)}
                        className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{nomeDe(c)}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.contact?.phone} · {numeroDe(c)}</p>
                        </div>
                        <Check className="h-4 w-4 opacity-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Data e hora */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {noPassado && <p className="text-xs text-destructive">Essa data e hora já passaram.</p>}

          {/* Mensagem */}
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva a mensagem. Pode usar {{nome}}, {{primeiro_nome}} e {{telefone}}." />
            {/\{\{/.test(text) && target && (
              <p className="text-xs text-muted-foreground whitespace-pre-line rounded-md bg-muted/50 p-2">Vai sair assim: {preview}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || (!target && !editing) || !text.trim() || !quando || noPassado}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
            {editing ? "Salvar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
