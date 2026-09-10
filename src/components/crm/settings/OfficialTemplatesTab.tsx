// Templates da API oficial do WhatsApp (Meta): lista com status de aprovação,
// criação direto do CRM e exclusão. Quem aprova é a Meta — aqui só acompanha.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, RefreshCw, Trash2, ShieldCheck } from "lucide-react";

interface OfficialInstance { id: string; display_name: string | null; phone_number: string | null; status: string }
interface Template {
  id: string; name: string; status: string; category: string; language: string;
  rejected_reason?: string | null; quality_score?: { score?: string } | null;
  components: { type: string; text?: string; buttons?: { text: string }[] }[];
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPROVED: { label: "Aprovado", variant: "default" },
  PENDING: { label: "Em análise", variant: "secondary" },
  IN_APPEAL: { label: "Em recurso", variant: "secondary" },
  REJECTED: { label: "Reprovado", variant: "destructive" },
  PAUSED: { label: "Pausado", variant: "destructive" },
  DISABLED: { label: "Desativado", variant: "destructive" },
};

export function OfficialTemplatesTab() {
  const [instances, setInstances] = useState<OfficialInstance[]>([]);
  const [instanceId, setInstanceId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "MARKETING", body: "", footer: "", buttons: "", examples: "" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("whatsapp_official_instances").select("id, display_name, phone_number, status").order("created_at");
      const list = (data || []) as OfficialInstance[];
      setInstances(list);
      const first = list.find((i) => i.status === "connected") || list[0];
      if (first) setInstanceId(first.id);
    })();
  }, []);

  const load = async (id = instanceId) => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-official-api", { body: { action: "getTemplates", instanceId: id } });
      if (error || data?.error) throw new Error(data?.error || String(error));
      setTemplates((data?.templates || []) as Template[]);
    } catch (e) {
      toast.error(`Não consegui listar os templates: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(instanceId); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [instanceId]);

  const varCount = new Set(form.body.match(/\{\{\d+\}\}/g) || []).size;

  const handleCreate = async () => {
    if (!form.name.trim() || !form.body.trim()) { toast.error("Nome e texto são obrigatórios"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-official-api", {
        body: {
          action: "createTemplate", instanceId,
          name: form.name, category: form.category, body: form.body, footer: form.footer || undefined,
          buttons: form.buttons.split(",").map((b) => b.trim()).filter(Boolean),
          examples: form.examples.split("|").map((e) => e.trim()).filter(Boolean),
        },
      });
      if (error || data?.error) throw new Error(data?.error || String(error));
      toast.success(`Template "${data.name}" enviado pra aprovação da Meta`);
      setCreateOpen(false);
      setForm({ name: "", category: "MARKETING", body: "", footer: "", buttons: "", examples: "" });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: Template) => {
    if (!confirm(`Excluir o template "${t.name}" na Meta? Não dá pra desfazer.`)) return;
    const { data, error } = await supabase.functions.invoke("whatsapp-official-api", { body: { action: "deleteTemplate", instanceId, name: t.name } });
    if (error || data?.error) { toast.error(data?.error || String(error)); return; }
    toast.success("Template excluído");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Templates da API oficial</CardTitle>
            <CardDescription>
              A Meta só deixa iniciar conversa com template aprovado. Crie aqui, acompanhe a aprovação e dispare pelo lead, por Negócios (em massa) ou pelo Atendimento.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {instances.length > 1 && (
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {instances.map((i) => <SelectItem key={i.id} value={i.id}>{i.display_name || "API Oficial"} {i.phone_number ? `· ${i.phone_number}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => load()} disabled={loading || !instanceId}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!instanceId}><Plus className="h-4 w-4 mr-1" /> Novo template</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!instances.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma instância da API oficial cadastrada. Conecte em Atendimento → Dispositivos → API Oficial.</p>
        ) : loading && !templates.length ? (
          <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Consultando a Meta…</div>
        ) : !templates.length ? (
          <p className="text-sm text-muted-foreground">Nenhum template ainda. Clique em "Novo template".</p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const st = STATUS[t.status] || { label: t.status, variant: "outline" as const };
              const body = t.components.find((c) => c.type === "BODY")?.text || "";
              const buttons = t.components.find((c) => c.type === "BUTTONS")?.buttons || [];
              return (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.category.toLowerCase()}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.language}</Badge>
                      {t.quality_score?.score && t.quality_score.score !== "UNKNOWN" && <Badge variant="outline" className="text-[10px]">qualidade: {t.quality_score.score.toLowerCase()}</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir na Meta" onClick={() => handleDelete(t)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{body}</p>
                  {buttons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">{buttons.map((b) => <Badge key={b.text} variant="outline">{b.text}</Badge>)}</div>
                  )}
                  {t.status === "REJECTED" && (
                    <p className="mt-2 text-xs text-destructive">Motivo da Meta: {t.rejected_reason || "não informado"}. Ajuste o texto e crie de novo com outro nome.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={(o) => !saving && setCreateOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo template</DialogTitle>
            <DialogDescription>Vai pra análise da Meta. Use {"{{1}}"}, {"{{2}}"}… pras variáveis (nome do lead, quem envia, data). Aprovação costuma sair em minutos ou horas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome (sem espaço)</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: convite_evento" />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing (prospecção, oferta)</SelectItem>
                    <SelectItem value="UTILITY">Utilidade (confirmação, lembrete)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Texto</Label>
              <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={"Olá, {{1}}! Aqui é {{2}}, da UNV Holdings…"} />
              {varCount > 0 && <p className="text-xs text-muted-foreground">{varCount} variável(is). A Meta exige um exemplo pra cada: preencha abaixo separados por | (ex: Carlos | Natalia).</p>}
            </div>
            {varCount > 0 && (
              <div className="space-y-1">
                <Label>Exemplos das variáveis</Label>
                <Input value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} placeholder="Carlos | Natalia" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Rodapé (opcional)</Label>
              <Input value={form.footer} onChange={(e) => setForm({ ...form, footer: e.target.value })} placeholder="Responda SAIR para não receber mais mensagens." maxLength={60} />
            </div>
            <div className="space-y-1">
              <Label>Botões de resposta rápida (opcional, até 3, separados por vírgula)</Label>
              <Input value={form.buttons} onChange={(e) => setForm({ ...form, buttons: e.target.value })} placeholder="Pode sim, Agora não" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Enviar pra aprovação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
