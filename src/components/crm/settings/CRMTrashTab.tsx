// Lixeira do CRM: lead, funil e etapa excluídos ficam 7 dias guardados (tabela
// crm_trash, preenchida por gatilho no banco) e voltam com o que estava
// pendurado neles. Só master/admin enxergam e restauram (RLS + RPC).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";

type Item = {
  id: string;
  entity: "lead" | "pipeline" | "stage";
  entity_id: string;
  label: string | null;
  meta: Record<string, any> | null;
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
  expires_at: string;
};

const TIPO: Record<Item["entity"], string> = { lead: "Lead", pipeline: "Funil", stage: "Etapa" };
const LIMITE = 500;

const dataHora = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function restante(expira: string): string {
  const ms = new Date(expira).getTime() - Date.now();
  if (ms <= 0) return "expira hoje";
  const dias = Math.floor(ms / 86400000);
  if (dias >= 1) return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  const horas = Math.max(1, Math.floor(ms / 3600000));
  return `${horas} h`;
}

export function CRMTrashTab() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [tipo, setTipo] = useState("todos");
  const [situacao, setSituacao] = useState("na_lixeira");
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState<Item | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState<Item | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    // sem as colunas data/children/links: são a cópia inteira do registro e pesam
    let q = (supabase as any)
      .from("crm_trash")
      .select("id, entity, entity_id, label, meta, deleted_by, deleted_at, restored_at, expires_at", { count: "exact" })
      .order("deleted_at", { ascending: false })
      .limit(LIMITE);
    if (tipo !== "todos") q = q.eq("entity", tipo);
    if (situacao === "na_lixeira") q = q.is("restored_at", null);
    if (situacao === "restaurados") q = q.not("restored_at", "is", null);
    if (busca.trim()) q = q.ilike("label", `%${busca.trim()}%`);
    const { data, error, count } = await q;
    if (error) {
      toast.error("Não consegui carregar a lixeira");
      setItens([]);
      setTotal(0);
    } else {
      setItens((data as Item[]) || []);
      setTotal(count ?? (data?.length || 0));
      const ids = Array.from(new Set(((data as Item[]) || []).map((i) => i.deleted_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: staff } = await supabase.from("onboarding_staff").select("user_id, name").in("user_id", ids);
        setNomes(Object.fromEntries((staff || []).map((s: any) => [s.user_id, s.name])));
      }
    }
    setCarregando(false);
  }, [tipo, situacao, busca]);

  useEffect(() => {
    const t = setTimeout(carregar, busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [carregar, busca]);

  const restaurar = async (item: Item) => {
    setOcupado(item.id);
    const { data, error } = await (supabase as any).rpc("crm_trash_restore", { p_id: item.id });
    setOcupado(null);
    setConfirmarRestaurar(null);
    if (error) {
      toast.error(error.message || "Não consegui restaurar");
      return;
    }
    const avisos: any[] = data?.avisos || [];
    const aviso = avisos.find((a) => a?.aviso)?.aviso;
    const falhas = avisos.filter((a) => a?.erro).length;
    const leads = data?.restaurado?.leads;
    toast.success(
      `${TIPO[item.entity]} restaurado${leads ? `, com ${leads} ${leads === 1 ? "lead" : "leads"}` : ""}`,
      {
        description: aviso || (falhas ? `${falhas} ${falhas === 1 ? "item ligado não voltou" : "itens ligados não voltaram"}. O registro principal está de volta.` : undefined),
        action: item.entity === "lead" ? { label: "Abrir lead", onClick: () => navigate(`/crm/leads/${item.entity_id}`) } : undefined,
      },
    );
    carregar();
  };

  const apagar = async (item: Item) => {
    setOcupado(item.id);
    const { error } = await (supabase as any).from("crm_trash").delete().eq("id", item.id);
    setOcupado(null);
    setConfirmarApagar(null);
    if (error) {
      toast.error("Não consegui apagar da lixeira");
      return;
    }
    toast.success("Removido da lixeira de vez");
    carregar();
  };

  const tipos = useMemo(
    () => [
      { value: "todos", label: "Todos os tipos" },
      { value: "lead", label: "Leads" },
      { value: "pipeline", label: "Funis" },
      { value: "stage", label: "Etapas" },
    ],
    [],
  );
  const situacoes = useMemo(
    () => [
      { value: "na_lixeira", label: "Na lixeira" },
      { value: "restaurados", label: "Já restaurados" },
      { value: "todos", label: "Tudo" },
    ],
    [],
  );

  const detalhe = (i: Item) => {
    const m = i.meta || {};
    if (i.entity === "lead") {
      const partes = [m.pipeline, m.stage].filter(Boolean).join(" · ");
      const filhos = Number(m.children_count || 0);
      return [partes, m.phone, m.owner ? `Resp.: ${m.owner}` : null, filhos ? `${filhos} ${filhos === 1 ? "registro ligado" : "registros ligados"}` : null]
        .filter(Boolean)
        .join("  |  ");
    }
    if (i.entity === "pipeline") {
      return `${m.stages ?? 0} etapas  |  ${m.leads ?? 0} leads caíram junto e voltam com o funil`;
    }
    return m.pipeline ? `Funil: ${m.pipeline}` : "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" /> Lixeira
        </CardTitle>
        <CardDescription>
          Leads, funis e etapas excluídos ficam aqui por 7 dias. Restaurar traz de volta o registro com atividades, histórico,
          etiquetas e arquivos. Depois dos 7 dias a exclusão é definitiva.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" className="pl-8" />
          </div>
          <SearchableSelect value={tipo} onValueChange={(v) => setTipo(v || "todos")} options={tipos} className="w-44" />
          <SearchableSelect value={situacao} onValueChange={(v) => setSituacao(v || "na_lixeira")} options={situacoes} className="w-44" />
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {total} {total === 1 ? "item" : "itens"}
            {total > LIMITE ? `, mostrando os ${LIMITE} mais recentes` : ""}
          </span>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : itens.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            {situacao === "na_lixeira" ? "Lixeira vazia." : "Nada encontrado com esse filtro."}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {itens.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <Badge variant="secondary" className="shrink-0">{TIPO[i.entity]}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{i.label || "(sem nome)"}</p>
                  <p className="truncate text-xs text-muted-foreground">{detalhe(i)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>
                    Excluído em {dataHora(i.deleted_at)}
                    {i.deleted_by && nomes[i.deleted_by] ? ` por ${nomes[i.deleted_by].split(" ")[0]}` : ""}
                  </p>
                  <p>
                    {i.restored_at ? `Restaurado em ${dataHora(i.restored_at)}` : `Some da lixeira em ${restante(i.expires_at)}`}
                  </p>
                </div>
                {!i.restored_at && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={ocupado === i.id} onClick={() => setConfirmarRestaurar(i)}>
                      {ocupado === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restaurar
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Apagar de vez" disabled={ocupado === i.id} onClick={() => setConfirmarApagar(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmarRestaurar} onOpenChange={(o) => !o && setConfirmarRestaurar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar {confirmarRestaurar ? TIPO[confirmarRestaurar.entity].toLowerCase() : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmarRestaurar?.label}" volta pro CRM como estava, com o que tinha ligado a ele.
              {confirmarRestaurar?.entity === "pipeline" ? " Os leads que foram excluídos junto com o funil voltam também." : ""}
              {" "}Nenhuma automação de lead novo é disparada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmarRestaurar && restaurar(confirmarRestaurar)}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmarApagar} onOpenChange={(o) => !o && setConfirmarApagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar de vez?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmarApagar?.label}" sai da lixeira agora e não dá mais pra restaurar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmarApagar && apagar(confirmarApagar)}>
              Apagar de vez
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
