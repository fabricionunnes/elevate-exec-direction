import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Bot, Radio, GitBranch, BookOpen } from "lucide-react";
import { AgentEditorDialog } from "@/components/crm/agents/AgentEditorDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  instructions: string | null;
  tone: string | null;
  greeting: string | null;
  model: string;
  temperature: number;
  reply_mode: string;
  is_active: boolean;
  handoff_keywords: string[] | null;
  max_messages: number | null;
  scheduling_enabled?: boolean;
  scheduling_staff_ids?: string[] | null;
  schedule_hour_start?: number;
  schedule_hour_end?: number;
  meeting_duration_minutes?: number;
  can_move_stage?: boolean;
  response_delay_seconds?: number;
  work_hours_enabled?: boolean;
  work_hour_start?: number;
  work_hour_end?: number;
  work_days?: number[] | null;
  created_at: string;
}

export default function CRMAgentsPage() {
  const { canSettings, staffId, tenantId } = useCRMContext();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AIAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // counts por agente: canais, funis, conhecimento
  const [counts, setCounts] = useState<Record<string, { channels: number; pipelines: number; knowledge: number }>>({});

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_ai_agents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar agentes");
      setLoading(false);
      return;
    }
    const list = (data || []) as AIAgent[];
    setAgents(list);

    if (list.length) {
      const ids = list.map((a) => a.id);
      const [ch, pi, kn] = await Promise.all([
        supabase.from("crm_ai_agent_channels").select("agent_id").in("agent_id", ids),
        supabase.from("crm_ai_agent_pipelines").select("agent_id").in("agent_id", ids),
        supabase.from("crm_ai_agent_knowledge").select("agent_id").in("agent_id", ids),
      ]);
      const tally = (rows: { agent_id: string }[] | null) => {
        const m: Record<string, number> = {};
        (rows || []).forEach((r) => { m[r.agent_id] = (m[r.agent_id] || 0) + 1; });
        return m;
      };
      const c = tally(ch.data as any), p = tally(pi.data as any), k = tally(kn.data as any);
      const merged: Record<string, { channels: number; pipelines: number; knowledge: number }> = {};
      ids.forEach((id) => { merged[id] = { channels: c[id] || 0, pipelines: p[id] || 0, knowledge: k[id] || 0 }; });
      setCounts(merged);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleToggleActive = async (agent: AIAgent, value: boolean) => {
    // otimista
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: value } : a));
    const { error } = await supabase
      .from("crm_ai_agents")
      .update({ is_active: value, updated_at: new Date().toISOString() })
      .eq("id", agent.id);
    if (error) {
      toast.error("Erro ao alterar status");
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: !value } : a));
    } else {
      toast.success(value ? "Agente ligado" : "Agente desligado");
    }
  };

  const handleNew = () => { setEditing(null); setDialogOpen(true); };
  const handleEdit = (a: AIAgent) => { setEditing(a); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("crm_ai_agents").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Agente excluído"); fetchAgents(); }
    setDeleteId(null);
  };

  if (!canSettings) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Você não tem permissão para gerenciar agentes de atendimento.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Agentes de Atendimento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie agentes de IA, alimente com conhecimento e escolha em quais instâncias e funis eles atuam.
            O modo (auto ou copiloto) é definido por funil.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2 shrink-0"><Plus className="h-4 w-4" /> Novo agente</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : agents.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhum agente criado ainda. Clique em <strong>Novo agente</strong> para começar.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {agents.map((a) => {
            const c = counts[a.id] || { channels: 0, pipelines: 0, knowledge: 0 };
            return (
              <Card key={a.id} className="overflow-hidden">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${a.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.name}</span>
                      <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">
                        {a.is_active ? "Ligado" : "Desligado"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Padrão: {a.reply_mode === "auto" ? "Auto-atende" : "Copiloto"}
                      </Badge>
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Radio className="h-3 w-3" /> {c.channels} instância(s)</span>
                      <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {c.pipelines} funil(is)</span>
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {c.knowledge} fonte(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={a.is_active} onCheckedChange={(v) => handleToggleActive(a, v)} />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AgentEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={editing}
        staffId={staffId}
        tenantId={tenantId}
        onSaved={fetchAgents}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o agente, seus vínculos de instância/funil e toda a base de conhecimento. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
