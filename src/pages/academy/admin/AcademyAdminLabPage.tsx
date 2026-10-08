import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlaskConical, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";
import { iaDb, LAB_CATEGORY_LABEL, CRESCER_PHASE_LABEL, type IaLabItem } from "@/lib/academy/iaAcademy";

// Admin do Laboratório de Agentes: CRUD de prompts, agentes, fluxos e templates.

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const emptyForm = () => ({
  title: "", slug: "", category: "prompt" as IaLabItem["category"], crescer_phase: "", description: "",
  prompt_text: "", external_url: "", tools: "", track_id: "", sort_order: 0, is_active: true,
});

export const AcademyAdminLabPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [items, setItems] = useState<IaLabItem[]>([]);
  const [tracks, setTracks] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IaLabItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [{ data: lab }, { data: tr }] = await Promise.all([
        iaDb.from("ia_academy_lab_items").select("*").order("sort_order", { ascending: true }),
        supabase.from("academy_tracks").select("id, name").order("sort_order"),
      ]);
      setItems((lab as IaLabItem[]) || []);
      setTracks((tr as any[]) || []);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => { setEditing(null); setForm({ ...emptyForm(), sort_order: items.length + 1 }); setOpen(true); };
  const openEdit = (i: IaLabItem) => {
    setEditing(i);
    setForm({
      title: i.title, slug: i.slug, category: i.category, crescer_phase: i.crescer_phase || "", description: i.description || "",
      prompt_text: i.prompt_text || "", external_url: i.external_url || "", tools: (i.tools || []).join(", "),
      track_id: i.track_id || "", sort_order: i.sort_order, is_active: i.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: (form.slug.trim() || slugify(form.title)),
        category: form.category,
        crescer_phase: form.crescer_phase || null,
        description: form.description.trim() || null,
        prompt_text: form.prompt_text.trim() || null,
        external_url: form.external_url.trim() || null,
        tools: form.tools.split(",").map((t) => t.trim()).filter(Boolean),
        track_id: form.track_id || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      const { error } = editing
        ? await iaDb.from("ia_academy_lab_items").update(payload).eq("id", editing.id)
        : await iaDb.from("ia_academy_lab_items").insert(payload);
      if (error) throw error;
      toast.success(editing ? "Item atualizado" : "Item criado");
      setOpen(false);
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message?.includes("slug") ? "Já existe um item com esse slug" : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (i: IaLabItem) => {
    if (!confirm(`Excluir "${i.title}"?`)) return;
    await iaDb.from("ia_academy_lab_items").delete().eq("id", i.id);
    toast.success("Item excluído");
    load();
  };

  if (!userContext.isAdmin) {
    return <div className="p-4 md:p-6"><Card className="p-12 text-center"><h3 className="font-semibold">Acesso negado</h3></Card></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><FlaskConical className="h-7 w-7 text-primary" /> Laboratório de Agentes</h1>
          <p className="text-muted-foreground mt-1">Prompts, agentes, fluxos N8N e templates que o aluno copia.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo item</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">#</TableHead>
                  <TableHead className="min-w-[160px]">Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                  <TableHead className="hidden md:table-cell">Fase</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{i.sort_order}</TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="font-medium">{i.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-none">{i.slug}{i.tools?.length ? ` · ${i.tools.join(", ")}` : ""}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">{LAB_CATEGORY_LABEL[i.category]}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{i.crescer_phase ? CRESCER_PHASE_LABEL[i.crescer_phase] || i.crescer_phase : "—"}</TableCell>
                    <TableCell><Badge variant={i.is_active ? "default" : "secondary"}>{i.is_active ? "Sim" : "Não"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as IaLabItem["category"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LAB_CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fase do CRESCER</Label>
              <Select value={form.crescer_phase || "none"} onValueChange={(v) => setForm({ ...form, crescer_phase: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {Object.entries(CRESCER_PHASE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trilha</Label>
              <Select value={form.track_id || "none"} onValueChange={(v) => setForm({ ...form, track_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">—</SelectItem>
                  {tracks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Prompt / conteúdo pra copiar</Label>
              <Textarea rows={10} className="font-mono text-xs" value={form.prompt_text} onChange={(e) => setForm({ ...form, prompt_text: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Link externo (JSON do N8N, planilha, doc)</Label>
              <Input value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Ferramentas (separadas por vírgula)</Label>
              <Input value={form.tools} onChange={(e) => setForm({ ...form, tools: e.target.value })} placeholder="chatgpt, claude, n8n, whatsapp" />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Visível pros alunos</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyAdminLabPage;
