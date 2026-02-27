import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit2, Trash2, FolderTree, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: string;
  group_name: string;
  dre_line: string | null;
  dfc_section: string | null;
  sort_order: number;
  is_active: boolean;
}

const DRE_LINES = [
  { value: "receita_bruta", label: "Receita Bruta" },
  { value: "deducoes", label: "(-) Deduções" },
  { value: "despesas_pessoal", label: "Despesas com Pessoal" },
  { value: "despesas_admin", label: "Despesas Administrativas" },
  { value: "despesas_comerciais", label: "Despesas Comerciais" },
  { value: "investimentos", label: "Investimentos" },
  { value: "despesas_financeiras", label: "Despesas Financeiras" },
];

const DFC_SECTIONS = [
  { value: "operacional", label: "Operacional" },
  { value: "investimento", label: "Investimento" },
  { value: "financiamento", label: "Financiamento" },
];

export default function FinancialCategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [form, setForm] = useState({
    name: "", type: "despesa", group_name: "", dre_line: "none", dfc_section: "operacional", sort_order: "0",
  });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("staff_financial_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (!error) setCategories((data as any) || []);
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      name: form.name,
      type: form.type,
      group_name: form.group_name || "Outros",
      dre_line: form.dre_line !== "none" ? form.dre_line : null,
      dfc_section: form.dfc_section,
      sort_order: parseInt(form.sort_order) || 0,
    };

    if (dialog.category) {
      const { error } = await supabase.from("staff_financial_categories").update(payload as any).eq("id", dialog.category.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Categoria atualizada");
    } else {
      const { error } = await supabase.from("staff_financial_categories").insert(payload as any);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Categoria criada");
    }
    setDialog({ open: false, category: null });
    loadCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Desativar esta categoria?")) return;
    await supabase.from("staff_financial_categories").update({ is_active: false } as any).eq("id", id);
    toast.success("Categoria desativada");
    loadCategories();
  };

  const openCreate = () => {
    setForm({ name: "", type: "despesa", group_name: "", dre_line: "none", dfc_section: "operacional", sort_order: "0" });
    setDialog({ open: true, category: null });
  };

  const openEdit = (cat: Category) => {
    setForm({
      name: cat.name,
      type: cat.type,
      group_name: cat.group_name,
      dre_line: cat.dre_line || "none",
      dfc_section: cat.dfc_section || "operacional",
      sort_order: String(cat.sort_order),
    });
    setDialog({ open: true, category: cat });
  };

  // Group categories
  const grouped = categories.reduce<Record<string, Category[]>>((acc, cat) => {
    const key = cat.group_name || "Outros";
    if (!acc[key]) acc[key] = [];
    acc[key].push(cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            Plano de Contas
          </h2>
          <p className="text-sm text-muted-foreground">Categorias para classificar receitas e despesas no DRE/DFC</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {Object.entries(grouped).map(([group, cats]) => (
        <Card key={group}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{group}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Linha DRE</TableHead>
                  <TableHead>Seção DFC</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>
                      <Badge variant={cat.type === "receita" ? "default" : "destructive"} className="gap-1 text-xs">
                        {cat.type === "receita" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {cat.type === "receita" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {DRE_LINES.find(l => l.value === cat.dre_line)?.label || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {DFC_SECTIONS.find(s => s.value === cat.dfc_section)?.label || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{cat.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {categories.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma categoria cadastrada.
          </CardContent>
        </Card>
      )}

      {/* Category Dialog */}
      <AlertDialog open={dialog.open} onOpenChange={(open) => { if (!open) setDialog({ open: false, category: null }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.category ? "Editar Categoria" : "Nova Categoria"}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Software e Ferramentas" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Grupo</label>
                <Input value={form.group_name} onChange={(e) => setForm(p => ({ ...p, group_name: e.target.value }))} placeholder="Ex: Despesas Administrativas" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Linha DRE</label>
                <Select value={form.dre_line} onValueChange={(v) => setForm(p => ({ ...p, dre_line: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {DRE_LINES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Seção DFC</label>
                <Select value={form.dfc_section} onValueChange={(v) => setForm(p => ({ ...p, dfc_section: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DFC_SECTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Ordem</label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm(p => ({ ...p, sort_order: e.target.value }))} className="w-24" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>{dialog.category ? "Salvar" : "Criar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
