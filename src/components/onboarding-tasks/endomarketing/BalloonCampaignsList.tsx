import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calendar, Target, Gift, Users } from "lucide-react";
import { format, parseISO, isAfter, isBefore, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
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

interface BalloonCampaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string;
  goal_type: string;
  prize_mode: string;
  balloons_per_achievement: number;
  all_salespeople: boolean;
  prizes?: { id: string }[];
  pops?: { id: string }[];
}

interface BalloonCampaignsListProps {
  projectId: string;
  isAdmin: boolean;
  onEdit: (id: string) => void;
  onCreate: () => void;
  onPlay: (id: string) => void;
}

export const BalloonCampaignsList = ({ projectId, isAdmin, onEdit, onCreate, onPlay }: BalloonCampaignsListProps) => {
  const [campaigns, setCampaigns] = useState<BalloonCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchCampaigns(); }, [projectId]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("endomarketing_balloon_campaigns")
        .select(`*, prizes:endomarketing_balloon_prizes(id), pops:endomarketing_balloon_pops(id)`)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const now = new Date();
      const updated = (data || []).map(c => {
        let status = c.status;
        const start = parseISO(c.start_date);
        const end = parseISO(c.end_date);
        if (status !== "ended") {
          if (isBefore(now, start)) status = "scheduled";
          else if (isWithinInterval(now, { start, end })) status = "active";
          else if (isAfter(now, end)) status = "ended";
        }
        return { ...c, status };
      });

      setCampaigns(updated);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar campanhas de balões");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await supabase.from("endomarketing_balloon_pops").delete().eq("campaign_id", deletingId);
      await supabase.from("endomarketing_balloon_achievements").delete().eq("campaign_id", deletingId);
      await supabase.from("endomarketing_balloon_prizes").delete().eq("campaign_id", deletingId);
      await supabase.from("endomarketing_balloon_participants").delete().eq("campaign_id", deletingId);
      const { error } = await supabase.from("endomarketing_balloon_campaigns").delete().eq("id", deletingId);
      if (error) throw error;
      toast.success("Campanha excluída!");
      fetchCampaigns();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  };

  const getGoalLabel = (type: string) => {
    const map: Record<string, string> = { daily: "Diária", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal", custom: "Personalizado" };
    return map[type] || type;
  };

  const getPrizeModeLabel = (mode: string) => {
    const map: Record<string, string> = { weighted: "Por peso", equal: "Distribuição igual", fixed_pool: "Lista fixa" };
    return map[mode] || mode;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">🎈 Ativa</Badge>;
      case "scheduled": return <Badge variant="secondary">⏳ Agendada</Badge>;
      case "ended": return <Badge variant="outline">✅ Encerrada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-28" /></Card>)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">🎈 Campanhas de Balões</h3>
        {isAdmin && (
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Campanha de Balões
          </Button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-4xl mb-4">🎈</p>
            <p className="font-medium">Nenhuma campanha de balões criada</p>
            <p className="text-sm">Crie uma campanha para que vendedores estourem balões ao bater metas!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      🎈 {campaign.name}
                    </CardTitle>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground">{campaign.description}</p>
                    )}
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Período</p>
                      <p className="font-medium">
                        {format(parseISO(campaign.start_date), "dd/MM", { locale: ptBR })} - {format(parseISO(campaign.end_date), "dd/MM/yy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Meta</p>
                      <p className="font-medium">{getGoalLabel(campaign.goal_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Prêmios</p>
                      <p className="font-medium">{campaign.prizes?.length || 0} ({getPrizeModeLabel(campaign.prize_mode)})</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Estourados</p>
                      <p className="font-medium">{campaign.pops?.length || 0} balões</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  {campaign.status === "active" && (
                    <Button variant="default" size="sm" onClick={() => onPlay(campaign.id)} className="gap-2">
                      🎈 Estourar Balões
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => onEdit(campaign.id)} className="gap-2">
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeletingId(campaign.id)} className="gap-2 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" /> Excluir
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha de balões?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente a campanha, prêmios e todo o histórico de balões estourados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
