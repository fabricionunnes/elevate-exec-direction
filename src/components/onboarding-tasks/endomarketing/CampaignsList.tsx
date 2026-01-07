import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Plus, 
  Trophy, 
  Users, 
  Calendar, 
  BarChart3, 
  Pencil, 
  XCircle,
  Play,
  Clock,
  CheckCircle2
} from "lucide-react";
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

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string;
  kpi_id: string;
  calculation_method: string;
  competition_type: string;
  has_goal: boolean;
  goal_value: number | null;
  has_prizes: boolean;
  prize_model: string | null;
  all_salespeople: boolean;
  created_at: string;
  kpi?: { name: string } | null;
  participants?: { id: string }[];
  prizes?: { id: string; position: number; name: string }[];
}

interface CampaignsListProps {
  companyId: string;
  projectId: string;
  isAdmin: boolean;
  onEditCampaign: (campaignId: string) => void;
  onCreateCampaign: () => void;
}

export const CampaignsList = ({
  companyId,
  projectId,
  isAdmin,
  onEditCampaign,
  onCreateCampaign,
}: CampaignsListProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [endingCampaignId, setEndingCampaignId] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, [projectId]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("endomarketing_campaigns")
        .select(`
          *,
          kpi:company_kpis(name),
          participants:endomarketing_participants(id),
          prizes:endomarketing_prizes(id, position, name)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Update status based on dates
      const now = new Date();
      const updatedCampaigns = (data || []).map(campaign => {
        let calculatedStatus = campaign.status;
        const startDate = parseISO(campaign.start_date);
        const endDate = parseISO(campaign.end_date);

        if (campaign.status !== "ended") {
          if (isBefore(now, startDate)) {
            calculatedStatus = "scheduled";
          } else if (isWithinInterval(now, { start: startDate, end: endDate })) {
            calculatedStatus = "active";
          } else if (isAfter(now, endDate)) {
            calculatedStatus = "ended";
          }
        }

        return { ...campaign, status: calculatedStatus };
      });

      setCampaigns(updatedCampaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const handleEndCampaign = async () => {
    if (!endingCampaignId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staffMember } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      const { error } = await supabase
        .from("endomarketing_campaigns")
        .update({
          status: "ended",
          ended_manually_at: new Date().toISOString(),
          ended_manually_by: staffMember?.id,
        })
        .eq("id", endingCampaignId);

      if (error) throw error;

      toast.success("Campanha encerrada com sucesso");
      fetchCampaigns();
    } catch (error) {
      console.error("Error ending campaign:", error);
      toast.error("Erro ao encerrar campanha");
    } finally {
      setEndingCampaignId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500"><Play className="h-3 w-3 mr-1" /> Ativa</Badge>;
      case "scheduled":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Agendada</Badge>;
      case "ended":
        return <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" /> Encerrada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPrizesSummary = (campaign: Campaign) => {
    if (!campaign.has_prizes) return "Sem premiação";
    
    switch (campaign.prize_model) {
      case "first":
        return "1º lugar";
      case "top3":
        return "Top 3";
      case "topN":
        return `Top ${campaign.prizes?.length || 0}`;
      case "tiers":
        return "Por faixas";
      case "goal_achieved":
        return "Quem bater meta";
      default:
        return "Configurada";
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (statusFilter === "all") return true;
    return c.status === statusFilter;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="active">Ativas</TabsTrigger>
            <TabsTrigger value="scheduled">Agendadas</TabsTrigger>
            <TabsTrigger value="ended">Encerradas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        {isAdmin && (
          <Button onClick={onCreateCampaign} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        )}
      </div>

      {/* Campaigns list */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Nenhuma campanha {statusFilter !== "all" ? statusFilter === "active" ? "ativa" : statusFilter === "scheduled" ? "agendada" : "encerrada" : ""}</p>
            <p className="text-sm">
              {isAdmin 
                ? "Crie uma campanha para incentivar o time comercial" 
                : "Aguarde a criação de novas campanhas"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCampaigns.map(campaign => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      {campaign.name}
                    </CardTitle>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground">{campaign.description}</p>
                    )}
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">KPI</p>
                      <p className="font-medium">{campaign.kpi?.name || "—"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Participantes</p>
                      <p className="font-medium">
                        {campaign.all_salespeople ? "Todos" : `${campaign.participants?.length || 0} vendedores`}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-medium capitalize">{campaign.competition_type === "individual" ? "Individual" : "Por equipe"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Premiação</p>
                    <p className="font-medium">{getPrizesSummary(campaign)}</p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={() => onEditCampaign(campaign.id)} className="gap-2">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    {campaign.status !== "ended" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setEndingCampaignId(campaign.id)}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                        Encerrar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* End campaign confirmation dialog */}
      <AlertDialog open={!!endingCampaignId} onOpenChange={() => setEndingCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao encerrar a campanha, os resultados serão travados e os vencedores definidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndCampaign}>
              Encerrar campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
