// Formas de pagamento e bancos usados na aba Negócio da ficha do lead.
// Fabrício, 30/09/2026: o cadastro existia só escondido no diálogo "Gerenciar campos"
// dentro da própria aba; aqui vira uma aba própria em Configurações.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

type Opcao = { id: string; name: string; is_active: boolean | null; sort_order: number | null };
type Tabela = "crm_payment_method_options" | "crm_bank_options";

function ListaOpcoes({ tabela, titulo, descricao, rotulo }: { tabela: Tabela; titulo: string; descricao: string; rotulo: string }) {
  const [itens, setItens] = useState<Opcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [excluir, setExcluir] = useState<Opcao | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await (supabase as any).from(tabela).select("id, name, is_active, sort_order").order("sort_order", { ascending: true }).order("name");
    if (error) toast.error(`Não consegui carregar ${rotulo}s`);
    setItens((data as Opcao[]) || []);
    setCarregando(false);
  }, [tabela, rotulo]);

  useEffect(() => { carregar(); }, [carregar]);

  const nomeRepetido = (nome: string, ignorarId?: string) =>
    itens.some((i) => i.id !== ignorarId && i.name.trim().toLowerCase() === nome.trim().toLowerCase());

  const adicionar = async () => {
    const nome = novo.trim();
    if (!nome) { toast.error(`Digite o nome da ${rotulo}`); return; }
    if (nomeRepetido(nome)) { toast.error(`"${nome}" já está cadastrada`); return; }
    setOcupado(true);
    const ordem = Math.max(0, ...itens.map((i) => i.sort_order || 0)) + 1;
    const { error } = await (supabase as any).from(tabela).insert({ name: nome, is_active: true, sort_order: ordem });
    setOcupado(false);
    if (error) { toast.error(`Erro ao adicionar: ${error.message}`); return; }
    setNovo(""); toast.success(`${rotulo} adicionada`); carregar();
  };

  const salvarNome = async () => {
    if (!editando) return;
    const nome = editando.nome.trim();
    if (!nome) { toast.error("O nome não pode ficar vazio"); return; }
    if (nomeRepetido(nome, editando.id)) { toast.error(`"${nome}" já está cadastrada`); return; }
    setOcupado(true);
    const { error } = await (supabase as any).from(tabela).update({ name: nome }).eq("id", editando.id);
    setOcupado(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    setEditando(null); carregar();
  };

  const alternar = async (item: Opcao) => {
    const { error } = await (supabase as any).from(tabela).update({ is_active: !(item.is_active ?? true) }).eq("id", item.id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    carregar();
  };

  const mover = async (idx: number, dir: -1 | 1) => {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= itens.length) return;
    const a = itens[idx], b = itens[alvo];
    const oa = a.sort_order ?? idx, ob = b.sort_order ?? alvo;
    // ordens iguais (cadastro antigo) trocam por posição pra sair do empate
    const [na, nb] = oa === ob ? [alvo + 1, idx + 1] : [ob, oa];
    setOcupado(true);
    const r1 = await (supabase as any).from(tabela).update({ sort_order: na }).eq("id", a.id);
    const r2 = await (supabase as any).from(tabela).update({ sort_order: nb }).eq("id", b.id);
    setOcupado(false);
    if (r1.error || r2.error) { toast.error("Não consegui reordenar"); }
    carregar();
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setOcupado(true);
    const { error } = await (supabase as any).from(tabela).delete().eq("id", excluir.id);
    setOcupado(false);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    toast.success(`${rotulo} excluída`); setExcluir(null); carregar();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
            placeholder={`Nova ${rotulo}`}
            className="max-w-sm"
          />
          <Button size="sm" onClick={adicionar} disabled={ocupado}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
        </div>

        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma {rotulo} cadastrada ainda.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {itens.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-col">
                  <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0 || ocupado} onClick={() => mover(idx, -1)} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === itens.length - 1 || ocupado} onClick={() => mover(idx, 1)} title="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                {editando?.id === item.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      autoFocus
                      value={editando.nome}
                      onChange={(e) => setEditando({ id: item.id, nome: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") salvarNome(); if (e.key === "Escape") setEditando(null); }}
                      className="h-8 max-w-sm"
                    />
                    <Button size="sm" variant="ghost" onClick={salvarNome} disabled={ocupado}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className={`text-sm truncate ${item.is_active === false ? "text-muted-foreground line-through" : ""}`}>{item.name}</span>
                    {item.is_active === false && <Badge variant="outline" className="text-[10px]">inativa</Badge>}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Switch checked={item.is_active !== false} onCheckedChange={() => alternar(item)} title={item.is_active === false ? "Ativar" : "Desativar"} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditando({ id: item.id, nome: item.name })} title="Renomear"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setExcluir(item)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Desativar tira a opção da lista da ficha do lead sem mexer nos negócios que já usam. Excluir apaga de vez.</p>
      </CardContent>

      <AlertDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {rotulo}?</AlertDialogTitle>
            <AlertDialogDescription>"{excluir?.name}" sai da lista. Se preferir manter o histórico, use desativar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function CRMPaymentMethodsTab() {
  return (
    <div className="space-y-6">
      <ListaOpcoes
        tabela="crm_payment_method_options"
        titulo="Formas de pagamento"
        descricao="Opções do campo Forma de pagamento na aba Negócio da ficha do lead."
        rotulo="forma de pagamento"
      />
      <ListaOpcoes
        tabela="crm_bank_options"
        titulo="Bancos"
        descricao="Opções do campo Banco na aba Negócio da ficha do lead."
        rotulo="opção de banco"
      />
    </div>
  );
}
