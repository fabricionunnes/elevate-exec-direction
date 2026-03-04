import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Database } from "lucide-react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { ACTION_CATEGORIES, COMMERCIAL_NICHES, MONTH_NAMES, type CommercialActionTemplate } from "../types";

export const CommercialActionsBankTab = () => {
  const [templates, setTemplates] = useState<CommercialActionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommercialActionTemplate | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", objective: "", niche: "", month: "",
    week: "", category: "Prospecção", step_by_step: "", script: "",
    frequency: "", default_responsible: "", default_deadline_days: "7",
    default_goal: "",
  });

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("commercial_action_templates")
      .select("*")
      .eq("is_active", true)
      .order("niche").order("month").order("week").order("sort_order");
    setTemplates((data as CommercialActionTemplate[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      title: "", description: "", objective: "", niche: "", month: "",
      week: "", category: "Prospecção", step_by_step: "", script: "",
      frequency: "", default_responsible: "", default_deadline_days: "7",
      default_goal: "",
    });
    setEditingTemplate(null);
  };

  const handleEdit = (t: CommercialActionTemplate) => {
    setEditingTemplate(t);
    setForm({
      title: t.title, description: t.description || "", objective: t.objective || "",
      niche: t.niche || "", month: t.month?.toString() || "",
      week: t.week?.toString() || "", category: t.category,
      step_by_step: t.step_by_step || "", script: t.script || "",
      frequency: t.frequency || "", default_responsible: t.default_responsible || "",
      default_deadline_days: t.default_deadline_days?.toString() || "7",
      default_goal: t.default_goal || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    const payload = {
      title: form.title, description: form.description || null,
      objective: form.objective || null, niche: form.niche || null,
      month: form.month ? parseInt(form.month) : null,
      week: form.week ? parseInt(form.week) : null, category: form.category,
      step_by_step: form.step_by_step || null, script: form.script || null,
      frequency: form.frequency || null, default_responsible: form.default_responsible || null,
      default_deadline_days: form.default_deadline_days ? parseInt(form.default_deadline_days) : 7,
      default_goal: form.default_goal || null,
    };

    if (editingTemplate) {
      const { error } = await supabase.from("commercial_action_templates")
        .update(payload as any).eq("id", editingTemplate.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Template atualizado");
    } else {
      const { error } = await supabase.from("commercial_action_templates")
        .insert(payload as any);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Template criado");
    }
    setShowForm(false);
    resetForm();
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await supabase.from("commercial_action_templates").update({ is_active: false } as any).eq("id", id);
    toast.success("Template excluído");
    fetchTemplates();
  };

  const filtered = templates.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (nicheFilter !== "all" && t.niche !== nicheFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  const groupedByNiche = filtered.reduce((acc, t) => {
    const key = t.niche || "Geral";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, CommercialActionTemplate[]>);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar template..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={nicheFilter} onValueChange={setNicheFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Nicho" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os nichos</SelectItem>
              {COMMERCIAL_NICHES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {ACTION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : Object.keys(groupedByNiche).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum template encontrado</p>
        </div>
      ) : (
        Object.entries(groupedByNiche).map(([niche, items]) => (
          <Card key={niche}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {niche}
                <Badge variant="secondary">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{t.title}</span>
                        <Badge variant="outline" className="text-xs">{t.category}</Badge>
                        {t.month && <Badge variant="secondary" className="text-xs">{MONTH_NAMES[t.month - 1]} - S{t.week}</Badge>}
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) resetForm(); setShowForm(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template de Ação"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Nicho</Label>
              <Select value={form.niche || "none"} onValueChange={v => setForm({ ...form, niche: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geral (todos)</SelectItem>
                  {COMMERCIAL_NICHES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={form.month || "none"} onValueChange={v => setForm({ ...form, month: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Mês..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem mês</SelectItem>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semana</Label>
              <Select value={form.week || "none"} onValueChange={v => setForm({ ...form, week: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Semana..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem semana</SelectItem>
                  {[1, 2, 3, 4, 5].map(w => <SelectItem key={w} value={String(w)}>Semana {w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Meta padrão</Label>
              <Input value={form.default_goal} onChange={e => setForm({ ...form, default_goal: e.target.value })} placeholder="Ex: 50 leads gerados" />
            </div>
            <div className="space-y-2">
              <Label>Prazo padrão (dias)</Label>
              <Input type="number" value={form.default_deadline_days} onChange={e => setForm({ ...form, default_deadline_days: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select value={form.frequency || "none"} onValueChange={v => setForm({ ...form, frequency: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recorrência</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Passo a Passo</Label>
              <Textarea value={form.step_by_step} onChange={e => setForm({ ...form, step_by_step: e.target.value })} rows={3} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Script</Label>
              <Textarea value={form.script} onChange={e => setForm({ ...form, script: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave}>{editingTemplate ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
