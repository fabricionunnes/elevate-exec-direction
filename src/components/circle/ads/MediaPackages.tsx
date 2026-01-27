import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, 
  Rocket, 
  Zap, 
  Building2,
  Check,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  profileId?: string;
}

const TIER_ICONS: Record<string, any> = {
  starter: Zap,
  growth: Rocket,
  scale: Crown,
  enterprise: Building2,
};

const TIER_COLORS: Record<string, string> = {
  starter: "bg-blue-500",
  growth: "bg-green-500",
  scale: "bg-purple-500",
  enterprise: "bg-gradient-to-r from-amber-500 to-orange-500",
};

export function MediaPackages({ profileId }: Props) {
  const queryClient = useQueryClient();

  const { data: packages, isLoading: loadingPackages } = useQuery({
    queryKey: ["circle-ads-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_ads_packages")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ["circle-ads-subscription", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("circle_ads_subscriptions")
        .select("*, package:circle_ads_packages(*)")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const { data: creditsBalance } = useQuery({
    queryKey: ["circle-ads-credits-balance", profileId],
    queryFn: async () => {
      if (!profileId) return 0;
      const { data, error } = await supabase.rpc("get_ads_credits_balance", {
        p_profile_id: profileId,
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!profileId,
  });

  const isLoading = loadingPackages || loadingSub;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      {subscription && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${TIER_COLORS[subscription.package?.tier || 'starter']}`}>
                  {(() => {
                    const Icon = TIER_ICONS[subscription.package?.tier || 'starter'];
                    return <Icon className="h-5 w-5 text-white" />;
                  })()}
                </div>
                <div>
                  <CardTitle className="text-lg">{subscription.package?.name}</CardTitle>
                  <CardDescription>Seu plano atual</CardDescription>
                </div>
              </div>
              <Badge variant="default" className="bg-green-500">
                Ativo
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold text-primary">{creditsBalance}</p>
                <p className="text-xs text-muted-foreground">Créditos disponíveis</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold">{subscription.package?.monthly_credits}</p>
                <p className="text-xs text-muted-foreground">Créditos/mês</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold">
                  {subscription.package?.max_campaigns === -1 ? "∞" : subscription.package?.max_campaigns}
                </p>
                <p className="text-xs text-muted-foreground">Campanhas</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold">{((subscription.package?.priority_boost || 1) * 100 - 100).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Prioridade extra</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Packages */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Pacotes de Mídia
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages?.map((pkg: any) => {
            const Icon = TIER_ICONS[pkg.tier] || Zap;
            const isCurrentPlan = subscription?.package_id === pkg.id;
            const features = Array.isArray(pkg.features) ? pkg.features : [];

            return (
              <Card 
                key={pkg.id}
                className={`relative overflow-hidden ${
                  isCurrentPlan ? "border-primary ring-2 ring-primary/20" : ""
                } ${pkg.tier === "scale" ? "border-purple-500/50" : ""}`}
              >
                {pkg.tier === "scale" && (
                  <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs px-3 py-1 rounded-bl-lg">
                    Popular
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${TIER_COLORS[pkg.tier]}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{pkg.name}</CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">
                      R$ {Number(pkg.price_monthly).toFixed(0)}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>

                  <div className="space-y-2">
                    {features.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}

                    {pkg.ai_access && (
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        <span className="text-purple-600 font-medium">Circle Ads AI</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? "outline" : "default"}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? "Plano Atual" : "Escolher Plano"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Credits Info */}
      <Card className="bg-muted/30">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-primary/10 rounded-full">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">Como funcionam os créditos?</h4>
              <p className="text-sm text-muted-foreground">
                Créditos são usados para pagar por impressões e cliques dos seus anúncios.
                O custo varia conforme seu Trust Score e qualidade dos anúncios.
                Créditos não utilizados expiram ao final do mês.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
