// Ações em massa do Atendimento (item 8 do benchmark Datacrazy, 30/09/2026).
// Barra que aparece no modo "Selecionar": com conversas marcadas age nelas; sem nenhuma
// marcada age em TODAS as do filtro atual. A contagem da confirmação vem do banco
// (crm_inbox_bulk com dry_run), nunca da lista carregada na tela.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Loader2, ChevronDown, X, SquareCheck, RotateCcw, UserRound, Building2, Tag, MailOpen, EyeOff, Eye, Bot, BotOff, GitBranch, Check } from "lucide-react";

export type BulkAction = "close" | "reopen" | "assign" | "sector" | "tag" | "read" | "hide" | "unhide" | "agent_on" | "agent_off" | "link_pipeline";

const ROTULO: Record<BulkAction, { label: string; verbo: string; icon: any }> = {
  close: { label: "Finalizar", verbo: "finalizar", icon: SquareCheck },
  reopen: { label: "Reabrir", verbo: "reabrir", icon: RotateCcw },
  assign: { label: "Transferir atendente", verbo: "transferir o atendente de", icon: UserRound },
  sector: { label: "Transferir setor", verbo: "transferir o setor de", icon: Building2 },
  tag: { label: "Aplicar etiqueta", verbo: "aplicar a etiqueta em", icon: Tag },
  read: { label: "Marcar como lida", verbo: "marcar como lidas", icon: MailOpen },
  hide: { label: "Ocultar", verbo: "ocultar", icon: EyeOff },
  unhide: { label: "Reexibir", verbo: "reexibir", icon: Eye },
  agent_on: { label: "Ligar agente de IA", verbo: "ligar o agente de IA em", icon: Bot },
  agent_off: { label: "Desligar agente de IA", verbo: "desligar o agente de IA em", icon: BotOff },
  link_pipeline: { label: "Vincular a funil", verbo: "criar negócio (pra quem não tem) em", icon: GitBranch },
};

interface Props {
  selectedIds: string[];
  /** filtro atual da lista, no formato que crm_inbox_bulk entende */
  filter: Record<string, unknown>;
  quick: string;
  onClearSelection: () => void;
  onExit: () => void;
  onDone: (action: BulkAction) => void;
}

export function BulkActionsBar({ selectedIds, filter, quick, onClearSelection, onExit, onDone }: Props) {
  const [action, setAction] = useState<BulkAction | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [running, setRunning] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<{ value: string; label: string }[]>([]);
  const [sectors, setSectors] = useState<{ value: string; label: string }[]>([]);
  const [tags, setTags] = useState<{ value: string; label: string }[]>([]);
  const [pipelines, setPipelines] = useState<{ value: string; label: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_id: string }[]>([]);

  const semSelecao = selectedIds.length === 0;

  // Contagem por SQL ao abrir a confirmação
  useEffect(() => {
    if (!action) return;
    let ativo = true;
    setCount(null);
    setCounting(true);
    (async () => {
      const { data, error } = await (supabase as any).rpc("crm_inbox_bulk", {
        p_action: "count", p_ids: semSelecao ? null : selectedIds, p_filter: filter, p_params: {}, p_dry_run: true,
      });
      if (!ativo) return;
      setCounting(false);
      if (error) { toast.error(error.message || "Não consegui contar as conversas"); setAction(null); return; }
      setCount(Number((data as any)?.count ?? 0));
    })();
    return () => { ativo = false; };
  }, [action]);

  // Opções dos parâmetros (só quando precisa)
  useEffect(() => {
    if (!action) return;
    (async () => {
      if (action === "assign" && staff.length === 0) {
        const { data } = await supabase.from("onboarding_staff").select("id, name, role")
          .in("role", ["master", "admin", "head_comercial", "closer", "sdr", "social_setter", "bdr"]).eq("is_active", true).order("name");
        setStaff(((data || []) as any[]).map((s) => ({ value: s.id, label: s.name, hint: s.role } as any)));
      }
      if (action === "sector" && sectors.length === 0) {
        const { data } = await (supabase as any).from("crm_service_sectors").select("id, name").eq("is_active", true).order("sort_order");
        setSectors(((data || []) as any[]).map((s) => ({ value: s.id, label: s.name })));
      }
      if (action === "tag" && tags.length === 0) {
        const { data } = await supabase.from("crm_tags").select("id, name").eq("is_active", true).order("name");
        setTags(((data || []) as any[]).map((t) => ({ value: t.id, label: t.name })));
      }
      if (action === "link_pipeline" && pipelines.length === 0) {
        const [{ data: pp }, { data: st }] = await Promise.all([
          supabase.from("crm_pipelines").select("id, name").order("name"),
          supabase.from("crm_stages").select("id, name, pipeline_id, sort_order").order("sort_order"),
        ]);
        setPipelines(((pp || []) as any[]).map((p) => ({ value: p.id, label: p.name })));
        setStages(((st || []) as any[]).map((s) => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id })));
      }
    })();
  }, [action]);

  const abrir = (a: BulkAction) => { setParams({}); setAction(a); };

  const precisaParam = action === "assign" ? false : action === "sector" ? false : action === "tag" ? !params.tag_id : action === "link_pipeline" ? !(params.pipeline_id && params.stage_id) : false;

  const executar = async () => {
    if (!action) return;
    setRunning(true);
    const { data, error } = await (supabase as any).rpc("crm_inbox_bulk", {
      p_action: action, p_ids: semSelecao ? null : selectedIds, p_filter: filter, p_params: params, p_dry_run: false,
    });
    setRunning(false);
    if (error) { toast.error(error.message || "Não consegui aplicar a ação"); return; }
    const r = (data || {}) as any;
    const partes = [`${r.affected ?? 0} conversa${(r.affected ?? 0) === 1 ? "" : "s"}`];
    if (action === "link_pipeline") partes[0] = `${r.leads_created ?? 0} negócio${(r.leads_created ?? 0) === 1 ? "" : "s"} criado${(r.leads_created ?? 0) === 1 ? "" : "s"}`;
    if (r.skipped) partes.push(`${r.skipped} ficaram de fora${action === "tag" ? " (sem negócio)" : action === "link_pipeline" ? " (já tinham negócio ou são grupo)" : ""}`);
    toast.success(`${ROTULO[action].label}: ${partes.join(", ")}`);
    const feita = action;
    setAction(null);
    onDone(feita);
  };

  const etapasDoFunil = useMemo(() => stages.filter((s) => s.pipeline_id === params.pipeline_id).map((s) => ({ value: s.id, label: s.name })), [stages, params.pipeline_id]);

  const Icone = action ? ROTULO[action].icon : Check;

  return (
    <>
      <div className="px-2 sm:px-3 py-2 border-b border-border bg-primary/5 flex items-center gap-2">
        <div className="text-xs flex-1 min-w-0">
          {semSelecao ? (
            <span className="text-muted-foreground">Nenhuma marcada: a ação vale pra <strong className="text-foreground">todas do filtro atual</strong></span>
          ) : (
            <span><strong>{selectedIds.length}</strong> selecionada{selectedIds.length === 1 ? "" : "s"}</span>
          )}
        </div>
        {!semSelecao && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onClearSelection}>Limpar</Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-7 text-xs px-2 gap-1">Ações <ChevronDown className="h-3.5 w-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => abrir("close")}><SquareCheck className="h-4 w-4 mr-2" />Finalizar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrir("reopen")}><RotateCcw className="h-4 w-4 mr-2" />Reabrir</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrir("read")}><MailOpen className="h-4 w-4 mr-2" />Marcar como lida</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => abrir("assign")}><UserRound className="h-4 w-4 mr-2" />Transferir atendente</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrir("sector")}><Building2 className="h-4 w-4 mr-2" />Transferir setor</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrir("tag")}><Tag className="h-4 w-4 mr-2" />Aplicar etiqueta</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrir("link_pipeline")}><GitBranch className="h-4 w-4 mr-2" />Vincular a funil</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => abrir("agent_on")}><Bot className="h-4 w-4 mr-2" />Ligar agente de IA</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrir("agent_off")}><BotOff className="h-4 w-4 mr-2" />Desligar agente de IA</DropdownMenuItem>
            <DropdownMenuSeparator />
            {quick === "hidden" ? (
              <DropdownMenuItem onClick={() => abrir("unhide")}><Eye className="h-4 w-4 mr-2" />Reexibir</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => abrir("hide")}><EyeOff className="h-4 w-4 mr-2" />Ocultar</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Sair da seleção" onClick={onExit}><X className="h-4 w-4" /></Button>
      </div>

      <Dialog open={!!action} onOpenChange={(o) => { if (!o && !running) setAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Icone className="h-4 w-4" />{action ? ROTULO[action].label : ""}</DialogTitle>
            <DialogDescription>
              {counting || count === null ? (
                <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Contando no banco...</span>
              ) : count === 0 ? (
                "Nenhuma conversa bate com a seleção."
              ) : (
                <>Vai {action ? ROTULO[action].verbo : ""} <strong>{count}</strong> conversa{count === 1 ? "" : "s"} {semSelecao ? "(todas do filtro atual)" : "(as selecionadas)"}.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {action === "assign" && (
            <div className="space-y-1">
              <Label>Novo atendente</Label>
              <SearchableSelect value={params.staff_id || "none"} onValueChange={(v) => setParams({ staff_id: v === "none" ? "" : v })}
                options={[{ value: "none", label: "Sem atribuição" }, ...staff]} placeholder="Escolher atendente" emptyMessage="Ninguém encontrado." />
            </div>
          )}
          {action === "sector" && (
            <div className="space-y-1">
              <Label>Setor</Label>
              <SearchableSelect value={params.sector_id || "none"} onValueChange={(v) => setParams({ sector_id: v === "none" ? "" : v })}
                options={[{ value: "none", label: "Sem setor" }, ...sectors]} placeholder="Escolher setor" emptyMessage="Nenhum setor. Cadastre em Configurações → Setores." />
            </div>
          )}
          {action === "tag" && (
            <div className="space-y-1">
              <Label>Etiqueta</Label>
              <SearchableSelect value={params.tag_id || ""} onValueChange={(v) => setParams({ tag_id: v })} options={tags} placeholder="Escolher etiqueta" emptyMessage="Nenhuma etiqueta." />
              <p className="text-xs text-muted-foreground">A etiqueta é do negócio: conversa sem negócio fica de fora.</p>
            </div>
          )}
          {action === "link_pipeline" && (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label>Funil</Label>
                <SearchableSelect value={params.pipeline_id || ""} onValueChange={(v) => setParams({ pipeline_id: v, stage_id: "" })} options={pipelines} placeholder="Escolher funil" emptyMessage="Nenhum funil." />
              </div>
              <div className="space-y-1">
                <Label>Etapa</Label>
                <SearchableSelect value={params.stage_id || ""} onValueChange={(v) => setParams((p) => ({ ...p, stage_id: v }))} options={etapasDoFunil} placeholder={params.pipeline_id ? "Escolher etapa" : "Escolha o funil primeiro"} emptyMessage="Nenhuma etapa." disabled={!params.pipeline_id} />
              </div>
              <p className="text-xs text-muted-foreground">Cria o negócio só pra quem ainda não tem, com o nome e o telefone do contato. Quem já tem negócio não muda.</p>
            </div>
          )}
          {action === "hide" && <p className="text-xs text-muted-foreground">Elas somem do Atendimento e o sistema para de guardar as mensagens desses números. Dá pra reexibir na aba Ocultas.</p>}
          {action === "agent_off" && <p className="text-xs text-muted-foreground">O agente para de responder nessas conversas até alguém ligar de novo.</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={running}>Cancelar</Button>
            <Button onClick={executar} disabled={running || counting || !count || precisaParam}>
              {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar{count ? ` (${count})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
