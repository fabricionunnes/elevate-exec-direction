import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shuffle, MessageCircle, Filter } from "lucide-react";

// Distribuição automática (round-robin): leads novos sem dono em funis
// habilitados e conversas novas do WhatsApp sem responsável. A atribuição
// acontece por TRIGGER no banco (crm_distribute_new_lead /
// crm_distribute_new_conversation) — aqui só se configura quem participa.

interface StaffRow {
  id: string;
  name: string;
  role: string | null;
}

interface MemberRow {
  id: string;
  distribution_id: string;
  staff_id: string;
  is_active: boolean;
  assigned_count: number;
}

interface DistRow {
  id: string;
  pipeline_id: string | null;
  is_active: boolean;
}

interface PipelineRow {
  id: string;
  name: string;
}

export const CRMDistributionTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [dists, setDists] = useState<DistRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [openCount, setOpenCount] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, s, d, m, oc] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        supabase.from("crm_lead_distribution" as never).select("*"),
        supabase.from("crm_lead_distribution_members" as never).select("*"),
        supabase
          .from("crm_whatsapp_conversations")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .is("assigned_to", null),
      ]);
      setPipelines((p.data as PipelineRow[]) || []);
      setStaff(((s.data as StaffRow[]) || []).filter((x) => (x.role || "").toLowerCase() !== "juridico"));
      setDists((d.data as unknown as DistRow[]) || []);
      setMembers((m.data as unknown as MemberRow[]) || []);
      setOpenCount(oc.count ?? null);
    } catch {
      toast.error("Erro ao carregar configuração de distribuição");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const distFor = (pipelineId: string | null) =>
    dists.find((d) => d.pipeline_id === pipelineId) || null;

  const membersFor = (distId: string) => members.filter((m) => m.distribution_id === distId);

  // Liga/desliga a distribuição de um funil (ou a global de conversas)
  const toggleDist = async (pipelineId: string | null, active: boolean) => {
    setSaving(true);
    try {
      const existing = distFor(pipelineId);
      if (existing) {
        const { error } = await supabase
          .from("crm_lead_distribution" as never)
          .update({ is_active: active, updated_at: new Date().toISOString() } as never)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("crm_lead_distribution" as never)
          .insert({ pipeline_id: pipelineId, is_active: active } as never);
        if (error) throw error;
      }
      await loadData();
      toast.success(active ? "Distribuição ativada" : "Distribuição desativada");
    } catch {
      toast.error("Erro ao salvar (só master/admin/head comercial alteram)");
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = async (distId: string, staffId: string, checked: boolean) => {
    setSaving(true);
    try {
      const existing = members.find((m) => m.distribution_id === distId && m.staff_id === staffId);
      if (existing) {
        const { error } = await supabase
          .from("crm_lead_distribution_members" as never)
          .update({ is_active: checked } as never)
          .eq("id", existing.id);
        if (error) throw error;
      } else if (checked) {
        const { error } = await supabase
          .from("crm_lead_distribution_members" as never)
          .insert({ distribution_id: distId, staff_id: staffId } as never);
        if (error) throw error;
      }
      await loadData();
    } catch {
      toast.error("Erro ao salvar membro");
    } finally {
      setSaving(false);
    }
  };

  // Distribui agora as conversas abertas sem responsável (RPC no banco)
  const distributeOpenNow = async () => {
    setDistributing(true);
    try {
      const { data, error } = await supabase.rpc("crm_distribute_open_conversations" as never);
      if (error) throw error;
      toast.success(`${data ?? 0} conversas distribuídas`);
      await loadData();
    } catch {
      toast.error("Erro ao distribuir conversas");
    } finally {
      setDistributing(false);
    }
  };

  const activeMemberCount = (distId: string) =>
    membersFor(distId).filter((m) => m.is_active).length;

  const MemberPicker = ({ dist }: { dist: DistRow }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
      {staff.map((s) => {
        const mem = members.find((m) => m.distribution_id === dist.id && m.staff_id === s.id);
        const checked = !!mem?.is_active;
        return (
          <label
            key={s.id}
            className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
          >
            <Checkbox
              checked={checked}
              disabled={saving}
              onCheckedChange={(v) => toggleMember(dist.id, s.id, v === true)}
            />
            <span className="flex-1 truncate">{s.name}</span>
            {mem && mem.assigned_count > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5" title="Recebidos pela distribuição">
                {mem.assigned_count}
              </Badge>
            )}
          </label>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  const globalDist = distFor(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shuffle className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Distribuição automática</h2>
          <p className="text-sm text-muted-foreground">
            Lead novo sem dono e conversa nova sem responsável caem automaticamente pro próximo da fila (rodízio equilibrado).
          </p>
        </div>
      </div>

      {/* Conversas do WhatsApp (global) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Conversas do WhatsApp</CardTitle>
            </div>
            <Switch
              checked={!!globalDist?.is_active}
              disabled={saving}
              onCheckedChange={(v) => toggleDist(null, v)}
            />
          </div>
          <CardDescription>
            Conversa nova: se o lead já tem dono, vai pro dono; senão, rodízio entre os selecionados abaixo.
            {openCount !== null && openCount > 0 && (
              <span className="block mt-1 text-amber-500 font-medium">
                {openCount} conversas abertas estão sem responsável agora.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {globalDist ? (
            <>
              <MemberPicker dist={globalDist} />
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <Button
                  size="sm"
                  onClick={distributeOpenNow}
                  disabled={distributing || !globalDist.is_active || activeMemberCount(globalDist.id) === 0}
                >
                  {distributing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Shuffle className="h-3.5 w-3.5 mr-1.5" />}
                  Distribuir conversas abertas agora
                </Button>
                <span className="text-xs text-muted-foreground">
                  Aplica dono do lead quando existir; o resto entra no rodízio.
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ative a chave acima pra escolher quem participa.</p>
          )}
        </CardContent>
      </Card>

      {/* Leads por funil */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Leads novos por funil</CardTitle>
          </div>
          <CardDescription>
            Só distribui lead criado SEM dono nos funis ligados abaixo — importações em massa e funis históricos não são afetados se ficarem desligados.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {pipelines.map((p) => {
            const dist = distFor(p.id);
            return (
              <div key={p.id} className="rounded-lg border border-border/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{p.name}</span>
                    {dist?.is_active && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {activeMemberCount(dist.id)} no rodízio
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={!!dist?.is_active}
                    disabled={saving}
                    onCheckedChange={(v) => toggleDist(p.id, v)}
                  />
                </div>
                {dist?.is_active && <MemberPicker dist={dist} />}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
