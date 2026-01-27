import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  MoreVertical, 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  Eye, 
  TrendingUp,
  Target,
  Calendar,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CircleAdsCampaignDetails } from "./CircleAdsCampaignDetails";

interface Props {
  profileId?: string;
  onCreateCampaign: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  pending_review: { label: "Em Análise", variant: "outline" },
  active: { label: "Ativa", variant: "default" },
  paused: { label: "Pausada", variant: "secondary" },
  rejected: { label: "Reprovada", variant: "destructive" },
  completed: { label: "Encerrada", variant: "outline" },
};

const objectiveLabels = {
  reach: "Alcance",
  engagement: "Engajamento",
  whatsapp_traffic: "Tráfego WhatsApp",
  community_promotion: "Divulgação de Comunidade",
  marketplace_promotion: "Divulgação de Marketplace",
  event_promotion: "Divulgação de Evento",
};

export function CircleAdsCampaignsList({ profileId, onCreateCampaign }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["circle-ads-campaigns", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("circle_ads_campaigns")
        .select(`
          *,
          ad_sets:circle_ads_ad_sets(
            id,
            name,
            status,
            ads:circle_ads_ads(id, name, status)
          )
        `)
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "pending_review" | "active" | "paused" | "rejected" | "completed" }) => {
      const { error } = await supabase
        .from("circle_ads_campaigns")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-campaigns"] });
      toast({ title: "Status atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("circle_ads_campaigns")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-campaigns"] });
      toast({ title: "Campanha excluída!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir campanha", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!campaigns?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-violet-100 dark:bg-violet-900/30 rounded-full mb-4">
            <Target className="h-8 w-8 text-violet-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhuma campanha ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Crie sua primeira campanha e alcance mais pessoas no UNV Circle
          </p>
          <Button onClick={onCreateCampaign}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Campanha
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="overflow-hidden">
          <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base sm:text-lg truncate">
                    {campaign.name}
                  </CardTitle>
                  <Badge variant={statusConfig[campaign.status]?.variant || "secondary"}>
                    {statusConfig[campaign.status]?.label || campaign.status}
                  </Badge>
                </div>
                <CardDescription className="mt-1">
                  {objectiveLabels[campaign.objective as keyof typeof objectiveLabels] || campaign.objective}
                </CardDescription>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedCampaign(campaign.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </DropdownMenuItem>
                  {campaign.status === "active" && (
                    <DropdownMenuItem 
                      onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "paused" })}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </DropdownMenuItem>
                  )}
                  {campaign.status === "paused" && (
                    <DropdownMenuItem 
                      onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "active" })}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Ativar
                    </DropdownMenuItem>
                  )}
                  {(campaign.status === "draft" || campaign.status === "rejected") && (
                    <DropdownMenuItem 
                      onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "pending_review" })}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Enviar para Análise
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => deleteMutation.mutate(campaign.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Orçamento</p>
                  <p className="font-medium">
                    R$ {Number(campaign.budget_amount || 0).toFixed(2)}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({campaign.budget_type === "daily" ? "diário" : "total"})
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Gasto</p>
                  <p className="font-medium">R$ {Number(campaign.spent_amount || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="font-medium text-xs">
                    {campaign.start_date 
                      ? format(new Date(campaign.start_date), "dd/MM", { locale: ptBR })
                      : "-"
                    }
                    {campaign.end_date && (
                      <> - {format(new Date(campaign.end_date), "dd/MM", { locale: ptBR })}</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Anúncios</p>
                  <p className="font-medium">
                    {campaign.ad_sets?.reduce((acc: number, set: any) => acc + (set.ads?.length || 0), 0) || 0}
                  </p>
                </div>
              </div>
            </div>

            {campaign.rejection_reason && (
              <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                <strong>Motivo da reprovação:</strong> {campaign.rejection_reason}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <CircleAdsCampaignDetails
          campaignId={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}
