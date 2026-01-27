import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  MoreHorizontal, 
  EyeOff, 
  Flag, 
  Info, 
  MessageCircle,
  ExternalLink,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";

interface SponsoredAdCardProps {
  ad: {
    id: string;
    title?: string;
    content: string;
    media_urls?: string[];
    cta_type: string;
    cta_url?: string;
    whatsapp_number?: string;
    ad_set?: {
      targeting?: any;
      campaign?: {
        profile?: {
          id: string;
          display_name: string;
          avatar_url?: string;
          trust_score: number;
        };
      };
    };
  };
  placement: string;
  onImpression?: () => void;
}

const ctaLabels: Record<string, string> = {
  whatsapp: "Falar no WhatsApp",
  view_community: "Ver Comunidade",
  view_listing: "Ver Anúncio",
  learn_more: "Saber Mais",
  view_event: "Ver Evento",
};

export function SponsoredAdCard({ ad, placement, onImpression }: SponsoredAdCardProps) {
  const { toast } = useToast();
  const { data: currentProfile } = useCircleCurrentProfile();
  const queryClient = useQueryClient();
  const [showReport, setShowReport] = useState(false);
  const [showWhySeeing, setShowWhySeeing] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const advertiser = ad.ad_set?.campaign?.profile;

  const hideMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Perfil não encontrado");
      const { error } = await supabase
        .from("circle_ads_hidden")
        .insert({
          ad_id: ad.id,
          profile_id: currentProfile.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-sponsored-ads"] });
      toast({ title: "Anúncio ocultado" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Perfil não encontrado");
      const { error } = await supabase
        .from("circle_ads_reports")
        .insert({
          ad_id: ad.id,
          reporter_profile_id: currentProfile.id,
          reason: reportReason,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Denúncia enviada. Obrigado pelo feedback!" });
      setShowReport(false);
      setReportReason("");
    },
  });

  const recordClickMutation = useMutation({
    mutationFn: async () => {
      await supabase.rpc("record_ad_click", {
        p_ad_id: ad.id,
        p_viewer_profile_id: currentProfile?.id || null,
        p_click_type: "cta",
      });
    },
  });

  const handleCtaClick = () => {
    recordClickMutation.mutate();

    if (ad.cta_type === "whatsapp" && ad.whatsapp_number) {
      window.open(`https://wa.me/${ad.whatsapp_number}`, "_blank");
    } else if (ad.cta_url) {
      window.open(ad.cta_url, "_blank");
    }
  };

  const getTargetingReasons = () => {
    const reasons: string[] = [];
    const targeting = ad.ad_set?.targeting;
    
    if (targeting?.interests?.length) {
      reasons.push(`Interesses: ${targeting.interests.join(", ")}`);
    }
    if (targeting?.reputation_areas?.length) {
      reasons.push(`Área de reputação: ${targeting.reputation_areas.join(", ")}`);
    }
    if (targeting?.communities?.length) {
      reasons.push("Você participa de comunidades relacionadas");
    }
    if (!reasons.length) {
      reasons.push("Este anúncio é exibido para todos os usuários");
    }
    
    return reasons;
  };

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={advertiser?.avatar_url || undefined} />
                <AvatarFallback>
                  {advertiser?.display_name?.charAt(0).toUpperCase() || "A"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{advertiser?.display_name || "Anunciante"}</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Patrocinado
                  </Badge>
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    <span>{advertiser?.trust_score || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => hideMutation.mutate()}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ocultar anúncio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowReport(true)}>
                  <Flag className="h-4 w-4 mr-2" />
                  Denunciar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowWhySeeing(true)}>
                  <Info className="h-4 w-4 mr-2" />
                  Por que estou vendo isso?
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Content */}
          {ad.title && (
            <h4 className="font-semibold mb-2">{ad.title}</h4>
          )}
          
          <p className="text-sm mb-3 whitespace-pre-wrap">{ad.content}</p>

          {/* Media */}
          {ad.media_urls?.[0] && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-3">
              {ad.media_urls[0].includes(".mp4") || ad.media_urls[0].includes(".webm") ? (
                <video 
                  src={ad.media_urls[0]} 
                  controls 
                  className="w-full h-full object-contain"
                />
              ) : (
                <img 
                  src={ad.media_urls[0]} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          {/* CTA Button */}
          <Button 
            className="w-full" 
            onClick={handleCtaClick}
          >
            {ad.cta_type === "whatsapp" ? (
              <MessageCircle className="h-4 w-4 mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            {ctaLabels[ad.cta_type] || "Saber Mais"}
          </Button>
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar Anúncio</DialogTitle>
            <DialogDescription>
              Informe o motivo da denúncia
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Descreva o problema com este anúncio..."
            rows={4}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowReport(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => reportMutation.mutate()}
              disabled={!reportReason.trim() || reportMutation.isPending}
            >
              Enviar Denúncia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Why Seeing Dialog */}
      <Dialog open={showWhySeeing} onOpenChange={setShowWhySeeing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Por que estou vendo este anúncio?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Este anúncio está sendo exibido com base em:
            </p>
            <ul className="space-y-2">
              {getTargetingReasons().map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  {reason}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Você pode ocultar este anúncio se não for relevante para você.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
