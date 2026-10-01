import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  X, 
  ArrowRight, 
  Trash2, 
  UserPlus, 
  Loader2,
  CheckSquare,
  FolderInput,
  ShieldCheck,
  Tag,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createStageActivities } from "@/hooks/useStageActions";
import { checkStageGate, gateIsBlocked, logGateOverride, type LeadGateResult } from "@/lib/crm/stageGate";
import { OfficialTemplateSendDialog } from "@/components/crm/OfficialTemplateSendDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CreateImpulsoDialog } from "@/components/crm/disparos/CreateImpulsoDialog";
import { LeadListBulkButtons } from "@/components/crm/lists/LeadListBulkButtons";

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface Owner {
  id: string;
  name: string;
}

interface Pipeline {
  id: string;
  name: string;
}

// Acima deste volume, a ação em massa NÃO dispara automações de etapa.
// (createStageActivities cria atividades e dispara WhatsApp por lead — inviável e
//  indesejado num remanejamento em massa; o lead é movido, só não roda a automação.)
const BULK_AUTOMATION_LIMIT = 50;

interface KanbanBulkActionsProps {
  selectedLeads: string[];
  onClearSelection: () => void;
  stages: Stage[];
  owners: Owner[];
  onSuccess: () => void;
  isMaster: boolean;
  currentPipelineId?: string;
  /** acesso por funil + permissão granular (lead_delete) */
  canDelete?: boolean;
  /** acesso por funil (can_change_owner) */
  canChangeOwner?: boolean;
  /** permissão granular lead_move */
  canMove?: boolean;
  /** master/admin: "Mover mesmo assim" na trava de etapa */
  canOverrideGate?: boolean;
  staffId?: string | null;
  /** ids de todos os leads do filtro atual do kanban: libera "todos do filtro" no impulso */
  filteredLeadIds?: string[];
  /** o funil está filtrado por UMA lista de leads: aparece também o "Tirar da lista" */
  removeFromList?: { id: string; name: string } | null;
}

export const KanbanBulkActions = ({
  selectedLeads,
  onClearSelection,
  stages,
  owners,
  onSuccess,
  isMaster,
  currentPipelineId,
  canDelete = true,
  canChangeOwner = true,
  canMove = true,
  canOverrideGate = false,
  staffId = null,
  filteredLeadIds,
  removeFromList = null,
}: KanbanBulkActionsProps) => {
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [impulsoOpen, setImpulsoOpen] = useState(false);
  const [moveToStage, setMoveToStage] = useState<string>("");
  const [assignToOwner, setAssignToOwner] = useState<string>("");
  const [moveToPipeline, setMoveToPipeline] = useState<string>("");
  // etapa de destino ao mudar de funil (pedido 14/09/2026); vazio = primeira etapa
  const [targetStages, setTargetStages] = useState<{ id: string; name: string }[]>([]);
  const [moveToPipelineStage, setMoveToPipelineStage] = useState<string>("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [bulkTag, setBulkTag] = useState<string>("");
  // Trava de etapa em massa: leads com pendência e o que fazer com eles
  const [gateDialog, setGateDialog] = useState<{
    results: Map<string, LeadGateResult>;
    blocked: LeadGateResult[];
    targetStageName: string;
    run: (ids: string[]) => Promise<void>;
  } | null>(null);

  /**
   * Checa a trava (atividade obrigatória pendente / campo exigido) pra todos os
   * selecionados. Sem pendência: executa. Com pendência: pergunta se move só os
   * liberados ou (master/admin) todos, registrando no histórico quem passou por cima.
   */
  const runWithGate = async (targetStageId: string, run: (ids: string[]) => Promise<void>) => {
    let results: Map<string, LeadGateResult>;
    try {
      results = await checkStageGate(selectedLeads, targetStageId);
    } catch (e) {
      console.error("checkStageGate (massa):", e);
      results = new Map();
    }
    const blocked = selectedLeads.map((id) => results.get(id)).filter((r): r is LeadGateResult => gateIsBlocked(r));
    if (blocked.length === 0) {
      await run(selectedLeads);
      return;
    }
    const { data: st } = await supabase.from("crm_stages").select("name").eq("id", targetStageId).maybeSingle();
    setGateDialog({ results, blocked, targetStageName: st?.name || "nova etapa", run });
  };

  const chunkLeadIds = (leadIds: string[], chunkSize = 100) => {
    const chunks: string[][] = [];

    for (let index = 0; index < leadIds.length; index += chunkSize) {
      chunks.push(leadIds.slice(index, index + chunkSize));
    }

    return chunks;
  };

  useEffect(() => {
    const loadPipelines = async () => {
      const { data } = await supabase
        .from("crm_pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      
      // Filter out current pipeline
      const filtered = (data || []).filter(p => p.id !== currentPipelineId);
      setPipelines(filtered);
    };
    
    const loadTags = async () => {
      const { data } = await supabase.from("crm_tags").select("id, name, color").eq("is_active", true).order("name");
      setTags((data || []) as any);
    };

    if (selectedLeads.length > 0) {
      loadPipelines();
      loadTags();
    }
  }, [selectedLeads.length, currentPipelineId]);

  // Etiqueta em massa (aplicar/remover) — pedido do Fabrício 13/09/2026
  const handleBulkTag = async (action: "add" | "remove") => {
    if (!bulkTag) return;
    setLoading(true);
    try {
      for (const chunk of chunkLeadIds(selectedLeads)) {
        if (action === "add") {
          const { error } = await supabase.from("crm_lead_tags")
            .upsert(chunk.map((lead_id) => ({ lead_id, tag_id: bulkTag })), { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("crm_lead_tags").delete().eq("tag_id", bulkTag).in("lead_id", chunk);
          if (error) throw error;
        }
      }
      const nome = tags.find((t) => t.id === bulkTag)?.name || "etiqueta";
      toast.success(action === "add" ? `Etiqueta "${nome}" aplicada em ${selectedLeads.length} lead(s)` : `Etiqueta "${nome}" removida de ${selectedLeads.length} lead(s)`);
      setBulkTag("");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Erro ao aplicar etiqueta");
    } finally {
      setLoading(false);
    }
  };

  // Em massa não dá pra abrir um dialog por lead: se a etapa destino é de reunião
  // agendada, cria automaticamente a tarefa "Próximo contato" (dia útil seguinte,
  // responsável = dono do lead) pra nenhum lead ficar sem follow-up.
  const ensureNextContactTasks = async (leadIds: string[], stageId: string) => {
    try {
      const { data: st } = await supabase.from("crm_stages").select("name").eq("id", stageId).maybeSingle();
      if (!st || !/agendad/i.test(st.name)) return;
      const { data: leads } = await supabase.from("crm_leads")
        .select("id, owner_staff_id, closer_staff_id, sdr_staff_id").in("id", leadIds);
      const due = new Date();
      due.setDate(due.getDate() + (due.getDay() === 5 ? 3 : due.getDay() === 6 ? 2 : 1));
      due.setHours(9, 0, 0, 0);
      const rows = (leads || []).map((l: any) => ({
        lead_id: l.id, type: "followup", title: "Próximo contato (reunião agendada)",
        scheduled_at: due.toISOString(), status: "pending",
        responsible_staff_id: l.owner_staff_id || l.closer_staff_id || l.sdr_staff_id || null,
      }));
      if (rows.length) await supabase.from("crm_activities").insert(rows);
    } catch (e) {
      console.error("ensureNextContactTasks:", e);
    }
  };

  const handleBulkMove = async () => {
    if (!moveToStage || selectedLeads.length === 0) return;
    if (!canMove) { toast.error("Você não tem permissão para mover leads entre etapas"); return; }
    // (a garantia de tarefa pra etapa 'agendad' é aplicada após o move — ver ensureNextContactTasks)
    setLoading(true);
    try {
      await runWithGate(moveToStage, async (ids) => {
        for (const leadIds of chunkLeadIds(ids)) {
          const { error } = await supabase
            .from("crm_leads")
            .update({ stage_id: moveToStage })
            .in("id", leadIds);
          if (error) throw error;
        }

        if (ids.length <= BULK_AUTOMATION_LIMIT) {
          for (const leadId of ids) {
            await createStageActivities(leadId, moveToStage);
          }
        }

        await ensureNextContactTasks(ids, moveToStage);

        toast.success(`${ids.length} leads movidos com sucesso`);
        setMoveToStage("");
        onClearSelection();
        onSuccess();
      });
    } catch (error) {
      console.error("Error moving leads:", error);
      toast.error("Erro ao mover leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMoveToPipelineStage("");
    setTargetStages([]);
    if (!moveToPipeline) return;
    (async () => {
      const { data } = await supabase.from("crm_stages").select("id, name").eq("pipeline_id", moveToPipeline).order("sort_order");
      setTargetStages((data || []) as any);
    })();
  }, [moveToPipeline]);

  const handleBulkChangePipeline = async () => {
    if (!moveToPipeline || selectedLeads.length === 0) return;
    if (!canMove) { toast.error("Você não tem permissão para mover leads entre etapas"); return; }
    
    setLoading(true);
    try {
      // Etapa escolhida; sem escolha, primeira etapa não final do funil de destino
      let targetStageId = moveToPipelineStage;
      if (!targetStageId) {
        const { data: firstStages, error: stagesError } = await supabase
          .from("crm_stages")
          .select("id")
          .eq("pipeline_id", moveToPipeline)
          .eq("is_final", false)
          .order("sort_order")
          .limit(1);
        if (stagesError) throw stagesError;
        if (!firstStages || firstStages.length === 0) {
          toast.error("O funil de destino não possui etapas disponíveis");
          return;
        }
        targetStageId = firstStages[0].id;
      }

      // Get the first origin of the target pipeline to sync origin_id
      const { data: targetOrigins } = await supabase
        .from("crm_origins")
        .select("id")
        .eq("pipeline_id", moveToPipeline)
        .eq("is_active", true)
        .limit(1);

      const targetOriginId = targetOrigins?.[0]?.id || null;

      await runWithGate(targetStageId, async (ids) => {
        // Move em massa via RPC (uma requisição, pulando os triggers por linha —
        // cadência/log/sync/notificação — que estouravam com muitos leads).
        const { error: moveErr } = await supabase.rpc("bulk_change_lead_pipeline", {
          p_ids: ids,
          p_stage: targetStageId,
          p_origin: targetOriginId,
        });
        if (moveErr) throw moveErr;

        // Automações de etapa só para seleções pequenas (evita spam/timeout em massa)
        if (ids.length <= BULK_AUTOMATION_LIMIT) {
          for (const leadId of ids) {
            await createStageActivities(leadId, targetStageId);
          }
        }

        await ensureNextContactTasks(ids, targetStageId);

        toast.success(`${ids.length} leads movidos para outro funil`);
        setMoveToPipeline("");
        setMoveToPipelineStage("");
        onClearSelection();
        onSuccess();
      });
    } catch (error) {
      console.error("Error changing pipeline:", error);
      toast.error("Erro ao mudar funil");
    } finally {
      setLoading(false);
    }
  };

  const gateMoverLiberados = async () => {
    const g = gateDialog;
    if (!g) return;
    setGateDialog(null);
    const blockedIds = new Set(g.blocked.map((b) => b.leadId));
    const livres = selectedLeads.filter((id) => !blockedIds.has(id));
    if (livres.length === 0) { toast.error("Nenhum lead liberado pra mover"); setLoading(false); return; }
    setLoading(true);
    try { await g.run(livres); } catch (e) { console.error(e); toast.error("Erro ao mover leads"); } finally { setLoading(false); }
  };

  const gateMoverTodos = async () => {
    const g = gateDialog;
    if (!g) return;
    setGateDialog(null);
    setLoading(true);
    try {
      await logGateOverride({ leadIds: selectedLeads, staffId, targetStageName: g.targetStageName, results: g.results });
      await g.run(selectedLeads);
    } catch (e) { console.error(e); toast.error("Erro ao mover leads"); } finally { setLoading(false); }
  };

  const handleBulkAssign = async () => {
    if (!assignToOwner || selectedLeads.length === 0) return;
    if (!canChangeOwner) { toast.error("Você não tem permissão para trocar o responsável neste funil"); return; }
    
    setLoading(true);
    try {
      for (const leadIds of chunkLeadIds(selectedLeads)) {
        const { error } = await supabase
          .from("crm_leads")
          .update({ owner_staff_id: assignToOwner })
          .in("id", leadIds);
        if (error) throw error;
      }

      toast.success(`${selectedLeads.length} leads atribuídos com sucesso`);
      setAssignToOwner("");
      onClearSelection();
      onSuccess();
    } catch (error) {
      console.error("Error assigning leads:", error);
      toast.error("Erro ao atribuir leads");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return;
    if (!canDelete) { toast.error("Você não tem permissão para excluir leads neste funil"); return; }
    
    setLoading(true);
    try {
      const leadBatches = chunkLeadIds(selectedLeads);

      for (const leadIds of leadBatches) {
        const cleanupResults = await Promise.all([
          supabase.from("crm_sales").delete().in("lead_id", leadIds),
          supabase.from("instagram_conversations" as any).delete().in("lead_id", leadIds),
        ]);

        const cleanupError = cleanupResults.find((result) => result.error)?.error;
        if (cleanupError) throw cleanupError;

        const { error } = await supabase
          .from("crm_leads")
          .delete()
          .in("id", leadIds);

        if (error) throw error;
      }

      toast.success(`${selectedLeads.length} leads excluídos com sucesso`);
      setDeleteConfirmOpen(false);
      onClearSelection();
      onSuccess();
    } catch (error) {
      console.error("Error deleting leads:", error);
      toast.error("Erro ao excluir leads em massa");
    } finally {
      setLoading(false);
    }
  };

  if (selectedLeads.length === 0 || !isMaster) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex flex-wrap items-center gap-3 animate-in slide-in-from-bottom-4 max-w-[95vw]">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <Badge variant="secondary" className="text-sm">
            {selectedLeads.length} selecionado(s)
          </Badge>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Move to Stage */}
        <div className="flex items-center gap-2">
          {/* seletores com busca (pedido 13/09/2026) */}
          <div className="w-[170px]" title={canMove ? undefined : "Sem permissão para mover leads entre etapas"}>
            <SearchableSelect value={moveToStage} onValueChange={setMoveToStage}
              options={stages.map((st) => ({ value: st.id, label: st.name }))}
              placeholder="Mover para..." emptyMessage="Nenhuma etapa." className="h-8 text-xs" disabled={!canMove} />
          </div>
          {moveToStage && (
            <Button size="sm" onClick={handleBulkMove} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mover"}
            </Button>
          )}
        </div>

        {/* Change Pipeline */}
        {pipelines.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-[170px]" title={canMove ? undefined : "Sem permissão para mover leads entre etapas"}>
              <SearchableSelect value={moveToPipeline} onValueChange={setMoveToPipeline}
                options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Mudar funil..." emptyMessage="Nenhum funil." className="h-8 text-xs" disabled={!canMove} />
            </div>
            {moveToPipeline && (
              <div className="w-[160px]">
                <SearchableSelect value={moveToPipelineStage} onValueChange={setMoveToPipelineStage}
                  options={targetStages.map((st) => ({ value: st.id, label: st.name }))}
                  placeholder="Etapa (1ª por padrão)" emptyMessage="Nenhuma etapa." className="h-8 text-xs" />
              </div>
            )}
            {moveToPipeline && (
              <Button size="sm" onClick={handleBulkChangePipeline} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mover"}
              </Button>
            )}
          </div>
        )}

        {/* Assign Owner */}
        <div className="flex items-center gap-2">
          <div className="w-[170px]" title={canChangeOwner ? undefined : "Sem permissão para trocar o responsável neste funil"}>
            <SearchableSelect value={assignToOwner} onValueChange={setAssignToOwner}
              options={owners.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Atribuir a..." emptyMessage="Ninguém com esse nome." className="h-8 text-xs" disabled={!canChangeOwner} />
          </div>
          {assignToOwner && (
            <Button size="sm" onClick={handleBulkAssign} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atribuir"}
            </Button>
          )}
        </div>

        {/* Etiqueta em massa */}
        <div className="flex items-center gap-2">
          {/* Busca por nome (pedido 13/09/2026: muitas etiquetas, precisava pesquisar) */}
          <div className="w-[190px]">
            <SearchableSelect
              value={bulkTag}
              onValueChange={setBulkTag}
              options={tags.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Etiqueta..."
              emptyMessage="Nenhuma etiqueta com esse nome."
              className="h-8 text-xs"
            />
          </div>
          {bulkTag && (
            <>
              <Button size="sm" onClick={() => handleBulkTag("add")} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkTag("remove")} disabled={loading} title="Remover esta etiqueta dos selecionados">
                Remover
              </Button>
            </>
          )}
        </div>

        {/* Listas de leads: põe os selecionados numa lista (e tira, se o funil está filtrado por uma) */}
        <LeadListBulkButtons
          compact
          leadIds={selectedLeads}
          removeFrom={removeFromList}
          disabled={loading}
          onDone={() => { onClearSelection(); onSuccess(); }}
        />

        {/* Template pela API oficial (disparo em massa) */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTemplateOpen(true)}
          disabled={loading}
          title="Disparar template aprovado pela Meta (API oficial) pros leads selecionados"
        >
          <ShieldCheck className="h-3 w-3 mr-1" />
          Template oficial
        </Button>

        {/* Impulso: uma ação em lotes, com ritmo, pros selecionados (ou todos do filtro) */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImpulsoOpen(true)}
          disabled={loading}
          title="Mensagem, template, etapa, etiqueta, responsável ou cadência em lotes, com ritmo e status por lead"
        >
          <Zap className="h-3 w-3 mr-1" />
          Criar impulso
        </Button>

        {/* Delete */}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={loading || !canDelete}
          title={canDelete ? "Excluir os selecionados" : "Sem permissão para excluir leads neste funil"}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Excluir
        </Button>

        {/* Clear Selection */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClearSelection}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <OfficialTemplateSendDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        leadIds={selectedLeads}
        onSent={onSuccess}
      />

      <CreateImpulsoDialog
        open={impulsoOpen}
        onOpenChange={setImpulsoOpen}
        leadIds={selectedLeads}
        filteredLeadIds={filteredLeadIds}
        onCreated={onClearSelection}
      />

      {/* Trava de etapa em massa */}
      <AlertDialog open={!!gateDialog} onOpenChange={(o) => { if (!o) { setGateDialog(null); setLoading(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {gateDialog?.blocked.length} de {selectedLeads.length} leads com pendências
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Pra ir para <strong>{gateDialog?.targetStageName}</strong>, estes leads ainda têm atividade obrigatória pendente ou campo exigido em branco. Abra o lead pra resolver, ou mova só os liberados.</p>
                <ul className="max-h-48 overflow-y-auto space-y-1 rounded border border-border p-2">
                  {(gateDialog?.blocked || []).slice(0, 30).map((b) => (
                    <li key={b.leadId} className="text-xs">
                      <span className="font-medium">{b.leadName}</span>
                      <span className="text-muted-foreground">
                        {b.pendingActivities.length > 0 && ` · pendente: ${b.pendingActivities.map((a) => a.title).join(", ")}`}
                        {b.missingFields.length > 0 && ` · falta: ${b.missingFields.map((m) => m.def.label).join(", ")}`}
                      </span>
                    </li>
                  ))}
                  {(gateDialog?.blocked.length || 0) > 30 && (
                    <li className="text-xs text-muted-foreground">e mais {gateDialog!.blocked.length - 30}</li>
                  )}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {canOverrideGate && (
              <Button variant="ghost" onClick={gateMoverTodos} title="Fica registrado no histórico de cada lead que passou por cima das pendências">
                Mover mesmo assim
              </Button>
            )}
            <AlertDialogAction onClick={gateMoverLiberados} disabled={(gateDialog?.blocked.length || 0) >= selectedLeads.length}>
              Mover só os liberados ({selectedLeads.length - (gateDialog?.blocked.length || 0)})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedLeads.length} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              Os leads selecionados vão pra Lixeira com atividades, arquivos e histórico, e podem ser restaurados por um administrador em até 7 dias (Configurações, aba Lixeira). Depois disso a exclusão é definitiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir {selectedLeads.length} leads
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
