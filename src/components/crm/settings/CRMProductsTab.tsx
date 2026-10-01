// Produtos e planos do CRM (aba Produtos em Configurações), 01/10/2026.
// O produto do lead (crm_leads.product_id) aponta pra onboarding_services, o MESMO
// catálogo de serviços do onboarding (fases, templates, projetos). Por isso aqui não
// existe excluir: só criar, editar, ativar/desativar e ordenar. O slug é gerado na
// criação e nunca muda (a conversão de lead em empresa usa o slug como chave).
// Planos ficam em crm_plans (campo Plano da aba Negócio).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";

type Tipo = "produto" | "plano";

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  recurrence: string | null;
  is_active: boolean;
  sort_order: number;
}

const RECORRENCIAS = [
  { value: "nenhuma", label: "Não definida" },
  { value: "unica", label: "Pagamento único" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];
const rotuloRecorrencia = (r: string | null) => RECORRENCIAS.find((x) => x.value === r)?.label || null;

const CONFIG: Record<Tipo, { tabela: string; colunaPreco: string; select: string; titulo: string; descricao: string; novo: string; rodape: string }> = {
  produto: {
    tabela: "onboarding_services",
    colunaPreco: "list_price",
    select: "id, name, description, list_price, recurrence, is_active, sort_order",
    titulo: "Produtos",
    descricao: "Opções do campo Produto do negócio, do ganho e dos filtros. É o mesmo catálogo de serviços do onboarding.",
    novo: "Novo produto",
    rodape: "Desativar tira o produto das listas do CRM e do onboarding sem mexer nos negócios, vendas e projetos que já usam. Não existe excluir aqui porque o catálogo é compartilhado.",
  },
  plano: {
    tabela: "crm_plans",
    colunaPreco: "price",
    select: "id, name, description, price, is_active, sort_order",
    titulo: "Planos",
    descricao: "Opções do campo Plano na aba Negócio da ficha do lead.",
    novo: "Novo plano",
    rodape: "Desativar tira o plano da lista sem mexer nos negócios que já usam.",
  },
};

const moeda = (v: number | null) =>
  v == null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "1.997,00" ou "1997.5" viram número; vazio vira null
const lerPreco = (txt: string): number | null | "invalido" => {
  const t = txt.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? n : "invalido";
};

const slugify = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produto";

function Catalogo({ tipo }: { tipo: Tipo }) {
  const cfg = CONFIG[tipo];
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", recurrence: "nenhuma", is_active: true });

  const carregar = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from(cfg.tabela)
      .select(cfg.select)
      .order("sort_order", { ascending: true })
      .order("name");
    if (error) toast.error(`Não consegui carregar ${cfg.titulo.toLowerCase()}: ${error.message}`);
    setItens(((data as any[]) || []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      price: r[cfg.colunaPreco] == null ? null : Number(r[cfg.colunaPreco]),
      recurrence: r.recurrence ?? null,
      is_active: r.is_active !== false,
      sort_order: r.sort_order ?? 0,
    })));
    setCarregando(false);
  }, [cfg]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ name: "", description: "", price: "", recurrence: "nenhuma", is_active: true });
    setAberto(true);
  };

  const abrirEdicao = (item: Item) => {
    setEditando(item);
    setForm({
      name: item.name,
      description: item.description || "",
      price: item.price == null ? "" : String(item.price).replace(".", ","),
      recurrence: item.recurrence || "nenhuma",
      is_active: item.is_active,
    });
    setAberto(true);
  };

  const salvar = async () => {
    const nome = form.name.trim();
    if (!nome) { toast.error("Digite o nome"); return; }
    if (itens.some((i) => i.id !== editando?.id && i.name.trim().toLowerCase() === nome.toLowerCase())) {
      toast.error(`"${nome}" já está cadastrado`); return;
    }
    const preco = lerPreco(form.price);
    if (preco === "invalido") { toast.error("Preço inválido. Use só números, ex.: 1997,00"); return; }

    const dados: Record<string, any> = {
      name: nome,
      description: form.description.trim() || null,
      [cfg.colunaPreco]: preco,
      is_active: form.is_active,
    };
    if (tipo === "produto") dados.recurrence = form.recurrence === "nenhuma" ? null : form.recurrence;

    setOcupado(true);
    let erro: any = null;
    if (editando) {
      const r = await (supabase as any).from(cfg.tabela).update(dados).eq("id", editando.id).select("id");
      erro = r.error;
      // RLS barra em silêncio (zero linhas, sem erro): avisa em vez de dizer que salvou
      if (!erro && !(r.data || []).length) erro = { message: "sem permissão pra alterar este item" };
    } else {
      dados.sort_order = Math.max(0, ...itens.map((i) => i.sort_order || 0)) + 1;
      if (tipo === "produto") {
        // slug é único na tabela: tenta o do nome e, se já existir, numera
        const base = slugify(nome);
        for (let n = 1; n <= 6; n++) {
          const r = await (supabase as any).from(cfg.tabela).insert({ ...dados, slug: n === 1 ? base : `${base}-${n}` });
          erro = r.error;
          if (!erro || erro.code !== "23505") break;
        }
      } else {
        const r = await (supabase as any).from(cfg.tabela).insert(dados);
        erro = r.error;
      }
    }
    setOcupado(false);
    if (erro) { toast.error(`Erro ao salvar: ${erro.message}`); return; }
    toast.success(editando ? "Alterações salvas" : `${tipo === "produto" ? "Produto" : "Plano"} criado`);
    setAberto(false);
    carregar();
  };

  const alternar = async (item: Item) => {
    const r = await (supabase as any).from(cfg.tabela).update({ is_active: !item.is_active }).eq("id", item.id).select("id");
    if (r.error || !(r.data || []).length) { toast.error(`Não consegui alterar: ${r.error?.message || "sem permissão"}`); return; }
    carregar();
  };

  // Cadastro antigo tem tudo com ordem 0: ao mover, renumera a lista inteira (são poucos itens)
  const mover = async (idx: number, dir: -1 | 1) => {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= itens.length) return;
    const nova = [...itens];
    [nova[idx], nova[alvo]] = [nova[alvo], nova[idx]];
    setOcupado(true);
    const resultados = await Promise.all(
      nova.map((it, i) => (it.sort_order === i + 1 ? null : (supabase as any).from(cfg.tabela).update({ sort_order: i + 1 }).eq("id", it.id)))
        .filter(Boolean) as Promise<{ error: any }>[],
    );
    setOcupado(false);
    if (resultados.some((r) => r.error)) toast.error("Não consegui reordenar");
    carregar();
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{cfg.titulo}</CardTitle>
          <CardDescription>{cfg.descricao}</CardDescription>
        </div>
        <Button size="sm" onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" />{cfg.novo}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nada cadastrado ainda.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {itens.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex flex-col">
                  <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0 || ocupado} onClick={() => mover(idx, -1)} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === itens.length - 1 || ocupado} onClick={() => mover(idx, 1)} title="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium truncate ${item.is_active ? "" : "text-muted-foreground line-through"}`}>{item.name}</span>
                    {!item.is_active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                    {rotuloRecorrencia(item.recurrence) && <Badge variant="secondary" className="text-[10px]">{rotuloRecorrencia(item.recurrence)}</Badge>}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                </div>
                <span className="text-sm tabular-nums text-muted-foreground shrink-0">{moeda(item.price) || "sem preço"}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={item.is_active} onCheckedChange={() => alternar(item)} title={item.is_active ? "Desativar" : "Ativar"} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(item)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{cfg.rodape}</p>
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${tipo}` : cfg.novo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea className="mt-1" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Preço de tabela (R$)</Label>
                <Input className="mt-1" inputMode="decimal" placeholder="Ex.: 1997,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              {tipo === "produto" && (
                <div>
                  <Label>Recorrência</Label>
                  <SearchableSelect className="mt-1" value={form.recurrence} onChange={(v) => setForm({ ...form, recurrence: v })} options={RECORRENCIAS} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch id={`ativo-${tipo}`} checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label htmlFor={`ativo-${tipo}`} className="cursor-pointer">Ativo (aparece nas listas)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={ocupado}>
              {ocupado && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function CRMProductsTab() {
  return (
    <div className="space-y-6">
      <Catalogo tipo="produto" />
      <Catalogo tipo="plano" />
    </div>
  );
}
