// Configurações do CRM → Automações → "Lembretes de reunião pro cliente" (pedido do Fabrício, 22/09/2026).
// Regra: "X minutos/horas/dias antes da reunião, manda esta mensagem pro lead pela instância Y".
// Quem envia é a edge crm-meeting-reminders (cron a cada 5 min); histórico em crm_meeting_reminder_runs.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CalendarClock, History, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Reminder {
  id: string; name: string; is_active: boolean; minutes_before: number; instance_mode: "auto" | "evolution" | "official";
  instance_id: string | null; official_instance_id: string | null; pipeline_ids: string[]; send_from: string; send_until: string;
  message: string; position: number; run_count: number; last_run_at: string | null;
}
interface Run { id: string; lead_id: string | null; phone: string | null; instance_label: string | null; message: string | null; status: string; error: string | null; created_at: string }

const VARS: { k: string; d: string }[] = [
  { k: "primeiro_nome", d: "primeiro nome do lead" }, { k: "nome", d: "nome completo" }, { k: "empresa", d: "empresa do lead" },
  { k: "quando", d: "hoje / amanhã / sexta-feira, dia 26/09" }, { k: "data", d: "26/09" }, { k: "hora", d: "14:30" }, { k: "dia_semana", d: "sexta-feira" },
  { k: "link", d: "link da reunião" }, { k: "responsavel", d: "quem vai atender" }, { k: "primeiro_nome_responsavel", d: "primeiro nome de quem atende" }, { k: "titulo", d: "título da reunião" },
];
const MENSAGEM_PADRAO = "Oi {primeiro_nome}, tudo bem? Passando pra lembrar da nossa reunião {quando} às {hora}.\n\nO link é este: {link}\n\nSe tiver qualquer imprevisto, me avisa por aqui.";

const nova = (position: number): Reminder => ({
  id: "", name: "", is_active: false, minutes_before: 60, instance_mode: "auto", instance_id: null, official_instance_id: null,
  pipeline_ids: [], send_from: "08:00", send_until: "21:00", message: MENSAGEM_PADRAO, position, run_count: 0, last_run_at: null,
});

// 90 → "1 hora e 30 min"; 1440 → "1 dia"
function tempoTexto(min: number) {
  if (min % 1440 === 0) { const d = min / 1440; return `${d} dia${d > 1 ? "s" : ""}`; }
  if (min % 60 === 0) { const h = min / 60; return `${h} hora${h > 1 ? "s" : ""}`; }
  if (min > 60) return `${Math.floor(min / 60)}h${min % 60}`;
  return `${min} min`;
}
// editor guarda "quantidade + unidade"; o banco guarda minutos
function paraUnidade(min: number): { qtd: number; un: "min" | "h" | "d" } {
  if (min % 1440 === 0) return { qtd: min / 1440, un: "d" };
  if (min % 60 === 0) return { qtd: min / 60, un: "h" };
  return { qtd: min, un: "min" };
}
const FATOR = { min: 1, h: 60, d: 1440 } as const;

export function CRMMeetingRemindersSection() {
  const [rules, setRules] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [instances, setInstances] = useState<{ id: string; instance_name: string; display_name: string | null; status: string }[]>([]);
  const [officials, setOfficials] = useState<{ id: string; display_name: string; phone_number: string | null }[]>([]);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [qtd, setQtd] = useState(1); const [un, setUn] = useState<"min" | "h" | "d">("h");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [histOf, setHistOf] = useState<Reminder | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = supabase as any;
    const [r, p, i, o] = await Promise.all([
      sb.from("crm_meeting_reminders").select("*").order("position").order("created_at"),
      sb.from("crm_pipelines").select("id, name").order("name"),
      sb.from("whatsapp_instances").select("id, instance_name, display_name, status").order("instance_name"),
      sb.from("whatsapp_official_instances").select("id, display_name, phone_number").order("display_name"),
    ]);
    setRules(r.data || []); setPipelines(p.data || []); setInstances(i.data || []); setOfficials(o.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const abrir = (r: Reminder) => { const u = paraUnidade(r.minutes_before); setQtd(u.qtd); setUn(u.un); setEditing({ ...r }); };
  const upd = (fn: (d: Reminder) => void) => setEditing((prev) => { if (!prev) return prev; const d = { ...prev }; fn(d); return d; });

  const resumo = (r: Reminder) => {
    const inst = r.instance_mode === "evolution" ? (instances.find((i) => i.id === r.instance_id)?.display_name || instances.find((i) => i.id === r.instance_id)?.instance_name || "instância removida")
      : r.instance_mode === "official" ? (officials.find((o) => o.id === r.official_instance_id)?.display_name || "instância removida")
      : "o número da conversa do lead";
    const funis = r.pipeline_ids.length ? r.pipeline_ids.map((id) => pipelines.find((p) => p.id === id)?.name || "?").join(", ") : "todos os funis";
    return `${tempoTexto(r.minutes_before)} antes da reunião → manda pelo ${inst} · ${funis} · das ${r.send_from.slice(0, 5)} às ${r.send_until.slice(0, 5)}`;
  };

  const salvar = async () => {
    if (!editing) return;
    const minutes = Math.round((Number(qtd) || 0) * FATOR[un]);
    if (!editing.name.trim()) { toast.error("Dê um nome pro lembrete"); return; }
    if (minutes <= 0) { toast.error("Informe quanto tempo antes da reunião"); return; }
    if (!editing.message.trim()) { toast.error("Escreva a mensagem"); return; }
    if (editing.instance_mode === "evolution" && !editing.instance_id) { toast.error("Escolha a instância"); return; }
    if (editing.instance_mode === "official" && !editing.official_instance_id) { toast.error("Escolha a instância oficial"); return; }
    setSaving(true);
    const payload = {
      name: editing.name.trim(), minutes_before: minutes, instance_mode: editing.instance_mode,
      instance_id: editing.instance_mode === "evolution" ? editing.instance_id : null,
      official_instance_id: editing.instance_mode === "official" ? editing.official_instance_id : null,
      pipeline_ids: editing.pipeline_ids, send_from: editing.send_from, send_until: editing.send_until, message: editing.message, position: editing.position,
    };
    const sb = supabase as any;
    const { error } = editing.id ? await sb.from("crm_meeting_reminders").update(payload).eq("id", editing.id) : await sb.from("crm_meeting_reminders").insert(payload);
    setSaving(false);
    if (error) { toast.error("Não consegui salvar: " + error.message); return; }
    toast.success(editing.id ? "Lembrete salvo" : "Lembrete criado (desligado). Ligue quando estiver pronto.");
    setEditing(null); load();
  };

  const ligar = async (r: Reminder, on: boolean) => {
    const { error } = await (supabase as any).from("crm_meeting_reminders").update({ is_active: on }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: on } : x)));
  };
  const excluir = async (r: Reminder) => {
    if (!confirm(`Excluir o lembrete "${r.name}"?`)) return;
    const { error } = await (supabase as any).from("crm_meeting_reminders").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lembrete excluído"); load();
  };
  const testar = async () => {
    if (!editing) return;
    setTesting(true);
    const rule = { ...editing, minutes_before: Math.round((Number(qtd) || 0) * FATOR[un]) };
    const { data, error } = await supabase.functions.invoke("crm-meeting-reminders", { body: { action: "test", rule, phone: testPhone || undefined } });
    setTesting(false);
    if (error || !data?.ok) { toast.error("Teste falhou: " + (data?.error || error?.message || "erro")); return; }
    toast.success(`Mensagem de teste enviada pra ${data.phone} pela ${data.instancia}`);
  };
  const abrirHistorico = async (r: Reminder) => {
    setHistOf(r);
    const { data } = await (supabase as any).from("crm_meeting_reminder_runs").select("*").eq("reminder_id", r.id).order("created_at", { ascending: false }).limit(50);
    setRuns(data || []);
  };
  const inserirVar = (k: string) => upd((d) => { d.message = `${d.message}${d.message.endsWith(" ") || d.message === "" ? "" : " "}{${k}}`; });

  return (
    <div className="space-y-4 pt-6 border-t">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Lembretes de reunião pro cliente</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Mensagem automática no WhatsApp do lead minutos, horas ou dias antes de cada reunião marcada no CRM. Cada regra manda uma vez por reunião; reunião cancelada não recebe.
          </p>
        </div>
        <Button onClick={() => abrir(nova(rules.length))}><Plus className="h-4 w-4 mr-2" />Novo lembrete</Button>
      </div>

      {loading ? <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : rules.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum lembrete ainda. Exemplo: "1 dia antes" e "1 hora antes", cada um com sua mensagem.
        </CardContent></Card>
      )}

      {rules.map((r) => (
        <Card key={r.id} className={r.is_active ? "border-primary/40" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{r.name}</span>
                  <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Ligado" : "Desligado"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{resumo(r)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {r.run_count > 0 ? `Enviou ${r.run_count} vez${r.run_count > 1 ? "es" : ""}${r.last_run_at ? `, última em ${format(new Date(r.last_run_at), "dd/MM HH:mm")}` : ""}` : "Ainda não enviou"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={r.is_active} onCheckedChange={(v) => ligar(r, v)} />
                <Button variant="ghost" size="icon" title="Histórico" onClick={() => abrirHistorico(r)}><History className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Editar" onClick={() => abrir(r)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Excluir" onClick={() => excluir(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar lembrete" : "Novo lembrete de reunião"}</DialogTitle>
            <DialogDescription>A mensagem vai pro WhatsApp do lead. Use as variáveis pra personalizar.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => upd((d) => { d.name = e.target.value; })} placeholder="Ex.: Lembrete 1 dia antes" /></div>

              <div>
                <Label>Enviar</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" min={1} className="w-24" value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
                  <Select value={un} onValueChange={(v) => setUn(v as any)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="min">minutos</SelectItem><SelectItem value="h">horas</SelectItem><SelectItem value="d">dias</SelectItem></SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">antes da reunião</span>
                </div>
              </div>

              <div>
                <Label>Manda por qual número</Label>
                <SearchableSelect
                  className="mt-1"
                  value={editing.instance_mode === "auto" ? "auto" : editing.instance_mode === "evolution" ? `e:${editing.instance_id}` : `o:${editing.official_instance_id}`}
                  onValueChange={(v) => upd((d) => {
                    if (v === "auto") { d.instance_mode = "auto"; d.instance_id = null; d.official_instance_id = null; }
                    else if (v.startsWith("e:")) { d.instance_mode = "evolution"; d.instance_id = v.slice(2); d.official_instance_id = null; }
                    else { d.instance_mode = "official"; d.official_instance_id = v.slice(2); d.instance_id = null; }
                  })}
                  placeholder="Escolha o número"
                  emptyMessage="Nenhum número encontrado."
                  options={[
                    { value: "auto", label: "Automático: o número da conversa do lead" },
                    ...instances.map((i) => ({ value: `e:${i.id}`, label: `${i.display_name || i.instance_name}${i.status !== "connected" ? " (desconectada)" : ""}` })),
                    ...officials.map((o) => ({ value: `o:${o.id}`, label: `${o.display_name} (API oficial${o.phone_number ? ` · ${o.phone_number}` : ""})` })),
                  ]}
                />
                <p className="text-xs text-muted-foreground mt-1">No automático, o lembrete sai pelo mesmo número em que o lead conversou por último. Lead sem conversa fica sem lembrete. Pela API oficial, fora da janela de 24h a Meta só entrega template.</p>
              </div>

              <div>
                <Label>Funis</Label>
                <p className="text-xs text-muted-foreground mb-2">Nenhum marcado = todos os funis.</p>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {pipelines.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={editing.pipeline_ids.includes(p.id)}
                        onCheckedChange={() => upd((d) => { d.pipeline_ids = d.pipeline_ids.includes(p.id) ? d.pipeline_ids.filter((x) => x !== p.id) : [...d.pipeline_ids, p.id]; })} />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Só enviar a partir de</Label><Input type="time" value={editing.send_from.slice(0, 5)} onChange={(e) => upd((d) => { d.send_from = e.target.value; })} /></div>
                <div><Label>até</Label><Input type="time" value={editing.send_until.slice(0, 5)} onChange={(e) => upd((d) => { d.send_until = e.target.value; })} /></div>
                <p className="text-xs text-muted-foreground col-span-2">Se o horário do lembrete cair fora dessa janela, ele espera a janela abrir. Se a reunião for antes disso, manda assim mesmo.</p>
              </div>

              <div>
                <Label>Mensagem</Label>
                <Textarea rows={6} value={editing.message} onChange={(e) => upd((d) => { d.message = e.target.value; })} />
                <div className="flex flex-wrap gap-1 mt-2">
                  {VARS.map((v) => (
                    <button type="button" key={v.k} title={v.d} onClick={() => inserirVar(v.k)}
                      className="text-xs px-2 py-0.5 rounded-full border bg-muted hover:bg-muted/70">{`{${v.k}}`}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <Label>Testar no meu WhatsApp</Label>
                <div className="flex gap-2">
                  <Input placeholder="Telefone (vazio = o do seu cadastro)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                  <Button variant="outline" onClick={testar} disabled={testing}>{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Enviar teste</Button>
                </div>
                <p className="text-xs text-muted-foreground">Manda a mensagem com dados de exemplo pra você ver como o cliente recebe.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!histOf} onOpenChange={(o) => { if (!o) setHistOf(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico: {histOf?.name}</DialogTitle><DialogDescription>Últimos 50 envios desta regra.</DialogDescription></DialogHeader>
          {runs.length === 0 ? <p className="text-sm text-muted-foreground py-4">Nada enviado ainda.</p> : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div key={r.id} className="border rounded-md p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>{r.status === "sent" ? "Enviado" : r.status === "failed" ? "Falhou" : "Pulado"}</Badge>
                      {r.phone && <span>{r.phone}</span>}{r.instance_label && <span className="text-muted-foreground">via {r.instance_label}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  {r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                  {r.message && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.message}</p>}
                  {r.lead_id && <a className="text-xs text-primary hover:underline" href={`#/crm/leads/${r.lead_id}`}>abrir lead</a>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
