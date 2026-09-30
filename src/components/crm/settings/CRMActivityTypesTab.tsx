// Tipos de atividade (Configurações do CRM). Fabrício, 30/09/2026: a lista era
// fixa no código (AddActivityDialog, EditActivityDialog, filtro de Atividades).
// slug é o valor gravado em crm_activities.type e não muda depois de criado;
// name é o rótulo. Tipos de sistema (o código compara por valor, ex. meeting)
// podem ser renomeados e desativados, nunca excluídos. O banco também trava
// exclusão de tipo com atividade usando (trigger crm_activity_types_guard_delete).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { ACTIVITY_ICON_NAMES, activityIcon, slugFromName } from "@/lib/crm/activityTypes";

type Tipo = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
};

const ICON_OPTIONS = ACTIVITY_ICON_NAMES.map((n) => ({ value: n, label: n }));
const db = () => (supabase as any).from("crm_activity_types");

export function CRMActivityTypesTab() {
  const [itens, setItens] = useState<Tipo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState({ name: "", icon: "Calendar", color: "#64748b" });
  const [editando, setEditando] = useState<{ id: string; name: string; icon: string; color: string } | null>(null);
  const [excluir, setExcluir] = useState<Tipo | null>(null);
  const [usoExcluir, setUsoExcluir] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await db()
      .select("id, slug, name, icon, color, is_active, is_system, sort_order")
      .order("sort_order", { ascending: true }).order("name");
    if (error) toast.error("Não consegui carregar os tipos de atividade");
    setItens((data as Tipo[]) || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const nomeRepetido = (nome: string, ignorarId?: string) =>
    itens.some((i) => i.id !== ignorarId && i.name.trim().toLowerCase() === nome.trim().toLowerCase());

  const adicionar = async () => {
    const nome = novo.name.trim();
    if (!nome) { toast.error("Digite o nome do tipo"); return; }
    if (nomeRepetido(nome)) { toast.error(`"${nome}" já existe`); return; }
    let slug = slugFromName(nome);
    if (!slug) { toast.error("O nome precisa ter letras ou números"); return; }
    if (itens.some((i) => i.slug === slug)) slug = `${slug}_${Date.now().toString(36).slice(-4)}`;
    setOcupado(true);
    const ordem = Math.max(0, ...itens.map((i) => i.sort_order || 0)) + 1;
    const { error } = await db().insert({
      slug, name: nome, icon: novo.icon || null, color: novo.color || null, is_active: true, sort_order: ordem, is_system: false,
    });
    setOcupado(false);
    if (error) { toast.error(`Erro ao adicionar: ${error.message}`); return; }
    setNovo({ name: "", icon: "Calendar", color: "#64748b" });
    toast.success(`Tipo "${nome}" criado`);
    carregar();
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    const nome = editando.name.trim();
    if (!nome) { toast.error("O nome não pode ficar vazio"); return; }
    if (nomeRepetido(nome, editando.id)) { toast.error(`"${nome}" já existe`); return; }
    setOcupado(true);
    const { error } = await db().update({ name: nome, icon: editando.icon || null, color: editando.color || null }).eq("id", editando.id);
    setOcupado(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    setEditando(null);
    carregar();
  };

  const alternar = async (item: Tipo) => {
    const { error } = await db().update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    carregar();
  };

  const mover = async (idx: number, dir: -1 | 1) => {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= itens.length) return;
    const a = itens[idx], b = itens[alvo];
    const oa = a.sort_order ?? idx, ob = b.sort_order ?? alvo;
    const [na, nb] = oa === ob ? [alvo + 1, idx + 1] : [ob, oa];
    setOcupado(true);
    const r1 = await db().update({ sort_order: na }).eq("id", a.id);
    const r2 = await db().update({ sort_order: nb }).eq("id", b.id);
    setOcupado(false);
    if (r1.error || r2.error) toast.error("Não consegui reordenar");
    carregar();
  };

  const pedirExclusao = async (item: Tipo) => {
    if (item.is_system) { toast.error("Tipo de sistema não pode ser excluído. Desative se não quiser usar."); return; }
    setExcluir(item);
    setUsoExcluir(null);
    const { count } = await supabase.from("crm_activities").select("id", { count: "exact", head: true }).eq("type", item.slug);
    setUsoExcluir(count ?? 0);
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setOcupado(true);
    const { error } = await db().delete().eq("id", excluir.id);
    setOcupado(false);
    if (error) { toast.error(error.message || "Erro ao excluir"); return; }
    toast.success(`Tipo "${excluir.name}" excluído`);
    setExcluir(null);
    carregar();
  };

  const Preview = ({ icon, color }: { icon: string | null; color: string | null }) => {
    const Icon = activityIcon(icon);
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${color || "#64748b"}22`, color: color || "#64748b" }}>
        <Icon className="h-4 w-4" />
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tipos de atividade</CardTitle>
        <CardDescription>
          Opções do campo Tipo ao criar ou editar uma atividade e do filtro da tela de Atividades.
          Tipos de sistema são usados por automações e regras do CRM: dá pra renomear e desativar, não excluir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={novo.name}
            onChange={(e) => setNovo((n) => ({ ...n, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
            placeholder="Novo tipo (ex.: Visita técnica)"
            className="max-w-xs"
          />
          <div className="w-[170px]">
            <SearchableSelect value={novo.icon} onValueChange={(v) => setNovo((n) => ({ ...n, icon: v }))}
              options={ICON_OPTIONS} placeholder="Ícone" emptyMessage="Nenhum ícone com esse nome." />
          </div>
          <Input type="color" value={novo.color} onChange={(e) => setNovo((n) => ({ ...n, color: e.target.value }))} className="h-9 w-12 p-1" title="Cor" />
          <Preview icon={novo.icon} color={novo.color} />
          <Button size="sm" onClick={adicionar} disabled={ocupado}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
        </div>

        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum tipo cadastrado. As telas usam a lista padrão enquanto isso.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {itens.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-col">
                  <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0 || ocupado} onClick={() => mover(idx, -1)} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === itens.length - 1 || ocupado} onClick={() => mover(idx, 1)} title="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                {editando?.id === item.id ? (
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <Input
                      autoFocus
                      value={editando.name}
                      onChange={(e) => setEditando({ ...editando, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") salvarEdicao(); if (e.key === "Escape") setEditando(null); }}
                      className="h-8 max-w-[200px]"
                    />
                    <div className="w-[160px]">
                      <SearchableSelect value={editando.icon} onValueChange={(v) => setEditando({ ...editando, icon: v })}
                        options={ICON_OPTIONS} placeholder="Ícone" emptyMessage="Nenhum ícone com esse nome." className="h-8 text-xs" />
                    </div>
                    <Input type="color" value={editando.color} onChange={(e) => setEditando({ ...editando, color: e.target.value })} className="h-8 w-10 p-1" title="Cor" />
                    <Preview icon={editando.icon} color={editando.color} />
                    <Button size="sm" variant="ghost" onClick={salvarEdicao} disabled={ocupado}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <Preview icon={item.icon} color={item.color} />
                    <span className={`text-sm truncate ${!item.is_active ? "text-muted-foreground line-through" : ""}`}>{item.name}</span>
                    <code className="text-[10px] text-muted-foreground">{item.slug}</code>
                    {item.is_system && <Badge variant="outline" className="text-[10px]">sistema</Badge>}
                    {!item.is_active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Switch checked={item.is_active} onCheckedChange={() => alternar(item)} title={item.is_active ? "Desativar" : "Ativar"} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar"
                    onClick={() => setEditando({ id: item.id, name: item.name, icon: item.icon || "Calendar", color: item.color || "#64748b" })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-30"
                    disabled={item.is_system} title={item.is_system ? "Tipo de sistema: só desativar" : "Excluir"}
                    onClick={() => pedirExclusao(item)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Desativar tira o tipo das listas sem mexer nas atividades já criadas. Excluir só é possível quando nenhuma atividade usa o tipo.
        </p>
      </CardContent>

      <AlertDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo "{excluir?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {usoExcluir === null
                ? "Conferindo se há atividades com este tipo..."
                : usoExcluir > 0
                  ? `${usoExcluir.toLocaleString("pt-BR")} atividade(s) usam este tipo. Não dá pra excluir; desative em vez disso.`
                  : "Nenhuma atividade usa este tipo. A exclusão é definitiva."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={ocupado || usoExcluir === null || usoExcluir > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
