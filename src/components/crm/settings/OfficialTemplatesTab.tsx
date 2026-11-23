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
import { Loader2, Plus, RefreshCw, Trash2, ShieldCheck, ImagePlus, Image as ImageIcon, ExternalLink, X } from "lucide-react";

interface OfficialInstance { id: string; display_name: string | null; phone_number: string | null; status: string }
interface Template {
  id: string; name: string; status: string; category: string; language: string;
  rejected_reason?: string | null; quality_score?: { score?: string } | null;
  components: { type: string; format?: string; text?: string; buttons?: { text: string; type?: string; url?: string }[] }[];
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPROVED: { label: "Aprovado", variant: "default" },
  PENDING: { label: "Em análise", variant: "secondary" },
  IN_APPEAL: { label: "Em recurso", variant: "secondary" },
  REJECTED: { label: "Reprovado", variant: "destructive" },
  PAUSED: { label: "Pausado", variant: "destructive" },
  DISABLED: { label: "Desativado", variant: "destructive" },
};

/** supabase.functions.invoke devolve só "non-2xx status code"; o motivo (da Meta) vem no corpo */
async function mensagemDoErro(error: any, data: any): Promise<string> {
  if (data?.error) return String(data.error);
  try {
    const corpo = await error?.context?.json?.();
    if (corpo?.error) return String(corpo.error);
  } catch { /* corpo não é JSON */ }
  return String(error?.message || error || "Erro desconhecido");
}

export function OfficialTemplatesTab() {
  const [instances, setInstances] = useState<OfficialInstance[]>([]);
  const [instanceId, setInstanceId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "MARKETING", body: "", footer: "", buttons: "", examples: "", linkText: "", linkUrl: "" });
  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPrevia, setImagemPrevia] = useState("");
  useEffect(() => {
    if (!imagem) { setImagemPrevia(""); return; }
    const u = URL.createObjectURL(imagem);
    setImagemPrevia(u);
    return () => URL.revokeObjectURL(u);
  }, [imagem]);

  const escolherImagem = (f: File | null) => {
    if (!f) { setImagem(null); return; }
    if (!/^image\/(jpeg|png)$/.test(f.type)) { toast.error("A imagem precisa ser JPG ou PNG"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("A imagem passa de 5 MB. Reduza e tente de novo."); return; }
    setImagem(f);
  };

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
      if (error || data?.error) throw new Error(await mensagemDoErro(error, data));
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
    // regra da Meta: texto não pode começar nem terminar com variável
    if (/^\s*\{\{\d+\}\}/.test(form.body)) { toast.error('O texto não pode começar com variável. Ex.: "Oi, {{1}}! Uma pergunta..."'); return; }
    if (/\{\{\d+\}\}[\s.!?…]*$/.test(form.body)) { toast.error("O texto não pode terminar com variável. Coloque uma frase depois da última {{n}}."); return; }
    const linkText = form.linkText.trim();
    const linkUrl = form.linkUrl.trim();
    if ((linkText || linkUrl) && !(linkText && /^https:\/\/\S+$/i.test(linkUrl))) { toast.error("Botão de link: preencha o texto do botão e um link começando com https://"); return; }
    if (linkText.length > 25) { toast.error("O texto do botão de link passa de 25 caracteres"); return; }
    setSaving(true);
    try {
      // imagem do topo: sobe pra pasta pública e a Meta busca pelo link
      let headerImageUrl: string | undefined;
      if (imagem) {
        const ext = imagem.type === "image/png" ? "png" : "jpg";
        const nomeLimpo = form.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") || "template";
        const caminho = `templates/${nomeLimpo}-${Date.now()}.${ext}`;
        const { error: eUp } = await supabase.storage.from("whatsapp-media").upload(caminho, imagem, { contentType: imagem.type, cacheControl: "31536000" });
        if (eUp) throw new Error(`Não consegui subir a imagem: ${eUp.message}`);
        headerImageUrl = supabase.storage.from("whatsapp-media").getPublicUrl(caminho).data.publicUrl;
      }
      const { data, error } = await supabase.functions.invoke("whatsapp-official-api", {
        body: {
          action: "createTemplate", instanceId,
          name: form.name, category: form.category, body: form.body, footer: form.footer || undefined,
          buttons: form.buttons.split(",").map((b) => b.trim()).filter(Boolean),
          examples: form.examples.split("|").map((e) => e.trim()).filter(Boolean),
          header_image_url: headerImageUrl,
          link_button: linkText ? { text: linkText, url: linkUrl } : undefined,
        },
      });
      if (error || data?.error) throw new Error(await mensagemDoErro(error, data));
      toast.success(`Template "${data.name}" enviado pra aprovação da Meta`);
      setCreateOpen(false);
      setForm({ name: "", category: "MARKETING", body: "", footer: "", buttons: "", examples: "", linkText: "", linkUrl: "" });
      setImagem(null);
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
    if (error || data?.error) { toast.error(await mensagemDoErro(error, data)); return; }
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
              const temImagem = t.components.some((c) => c.type === "HEADER" && c.format === "IMAGE");
              return (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.category.toLowerCase()}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.language}</Badge>
                      {temImagem && <Badge variant="outline" className="text-[10px] gap-1"><ImageIcon className="h-3 w-3" /> com imagem</Badge>}
                      {t.quality_score?.score && t.quality_score.score !== "UNKNOWN" && <Badge variant="outline" className="text-[10px]">qualidade: {t.quality_score.score.toLowerCase()}</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir na Meta" onClick={() => handleDelete(t)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{body}</p>
                  {buttons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">{buttons.map((b) => (
                      <Badge key={b.text} variant="outline" className="gap-1" title={b.url || undefined}>{b.type === "URL" && <ExternalLink className="h-3 w-3" />}{b.text}</Badge>
                    ))}</div>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Label>Imagem no topo (opcional)</Label>
              {imagem ? (
                <div className="flex items-center gap-3 rounded-lg border p-2">
                  <img src={imagemPrevia} alt="Imagem do template" className="h-20 w-20 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{imagem.name}</p>
                    <p className="text-xs text-muted-foreground">{(imagem.size / 1024).toFixed(0)} KB · vai junto em cada envio</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Tirar a imagem" onClick={() => setImagem(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
                  <ImagePlus className="h-4 w-4" /> Escolher imagem (JPG ou PNG, até 5 MB)
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { escolherImagem(e.target.files?.[0] || null); e.target.value = ""; }} />
                </label>
              )}
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
            <div className="space-y-1">
              <Label>Botão de link (opcional)</Label>
              <div className="grid grid-cols-5 gap-2">
                <Input className="col-span-2" value={form.linkText} onChange={(e) => setForm({ ...form, linkText: e.target.value })} placeholder="Saiba mais" maxLength={25} />
                <Input className="col-span-3" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
              </div>
              <p className="text-xs text-muted-foreground">Abre uma página ou um WhatsApp (https://wa.me/55...). Sem emoji no texto do botão.</p>
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
