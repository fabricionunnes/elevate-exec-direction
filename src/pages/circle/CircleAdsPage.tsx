import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  TrendingUp, 
  Eye, 
  Wallet, 
  AlertTriangle, 
  Sparkles,
  Users,
  Shield,
  Gavel,
  Lock,
  BarChart3,
  Package
} from "lucide-react";
import { CircleAdsCampaignsList } from "@/components/circle/ads/CircleAdsCampaignsList";
import { CircleAdsCreateCampaign } from "@/components/circle/ads/CircleAdsCreateCampaign";
import { CircleAdsDashboard } from "@/components/circle/ads/CircleAdsDashboard";
import { CircleAdsWallet } from "@/components/circle/ads/CircleAdsWallet";
import { CircleAdsModeration } from "@/components/circle/ads/CircleAdsModeration";
import { AudienceBuilder } from "@/components/circle/ads/AudienceBuilder";
import { TrustScorePricing } from "@/components/circle/ads/TrustScorePricing";
import { CircleAdsAI } from "@/components/circle/ads/CircleAdsAI";
import { MediaPackages } from "@/components/circle/ads/MediaPackages";
import { AuctionHistory } from "@/components/circle/ads/AuctionHistory";
import { PrivacySettings } from "@/components/circle/ads/PrivacySettings";

export default function CircleAdsPage() {
  const { data: profile } = useCircleCurrentProfile();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);

  const { data: canAdvertise, isLoading: checkingAccess } = useQuery({
    queryKey: ["circle-ads-can-advertise", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase.rpc("can_user_advertise", {
        p_profile_id: profile.id,
      });
      if (error) throw error;
      return data as {
        allowed: boolean;
        reason?: string;
        trust_score?: number;
        wallet_balance?: number;
        active_campaigns?: number;
        max_campaigns?: number;
      };
    },
    enabled: !!profile?.id,
  });

  const { data: wallet } = useQuery({
    queryKey: ["circle-ads-wallet", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("circle_ads_wallets")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_onboarding_admin");
      if (error) return false;
      return data;
    },
  });

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">
            Circle Ads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plataforma completa de mídia e anúncios
          </p>
        </div>

        <div className="flex items-center gap-3">
          {wallet && (
            <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
              <Wallet className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">
                R$ {Number(wallet.balance || 0).toFixed(2)}
              </span>
            </div>
          )}

          {canAdvertise?.allowed && (
            <Button onClick={() => setShowCreateCampaign(true)}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Nova Campanha</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          )}
        </div>
      </div>

      {/* Access Warning */}
      {canAdvertise && !canAdvertise.allowed && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Acesso Restrito</p>
              <p className="text-sm text-muted-foreground">{canAdvertise.reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {canAdvertise?.allowed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trust Score</p>
                  <p className="text-lg font-bold">{canAdvertise.trust_score || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Wallet className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="text-lg font-bold">
                    R$ {Number(canAdvertise.wallet_balance || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Eye className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                  <p className="text-lg font-bold">
                    {canAdvertise.active_campaigns || 0}/{canAdvertise.max_campaigns || 5}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                  <Shield className="h-4 w-4 text-pink-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="text-lg font-bold">
                    {(canAdvertise.trust_score || 0) >= 80 ? "30%" : 
                     (canAdvertise.trust_score || 0) >= 60 ? "15%" : "0%"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content - Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex overflow-x-auto no-scrollbar">
          <TabsTrigger value="campaigns" className="flex-1 min-w-fit gap-1">
            <BarChart3 className="h-3 w-3 hidden sm:inline" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 min-w-fit gap-1">
            <Sparkles className="h-3 w-3 hidden sm:inline" />
            IA
          </TabsTrigger>
          <TabsTrigger value="audiences" className="flex-1 min-w-fit gap-1">
            <Users className="h-3 w-3 hidden sm:inline" />
            Públicos
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex-1 min-w-fit gap-1">
            <TrendingUp className="h-3 w-3 hidden sm:inline" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex-1 min-w-fit gap-1">
            <Shield className="h-3 w-3 hidden sm:inline" />
            Preços
          </TabsTrigger>
          <TabsTrigger value="packages" className="flex-1 min-w-fit gap-1">
            <Package className="h-3 w-3 hidden sm:inline" />
            Pacotes
          </TabsTrigger>
          <TabsTrigger value="auctions" className="flex-1 min-w-fit gap-1">
            <Gavel className="h-3 w-3 hidden sm:inline" />
            Leilões
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex-1 min-w-fit gap-1">
            <Wallet className="h-3 w-3 hidden sm:inline" />
            Carteira
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex-1 min-w-fit gap-1">
            <Lock className="h-3 w-3 hidden sm:inline" />
            Privacidade
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="moderation" className="flex-1 min-w-fit">
              Moderação
              <Badge variant="secondary" className="ml-1 text-xs">Admin</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <CircleAdsCampaignsList 
            profileId={profile?.id} 
            onCreateCampaign={() => setShowCreateCampaign(true)}
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <CircleAdsAI 
            profileId={profile?.id}
            onCampaignCreated={() => setActiveTab("campaigns")}
          />
        </TabsContent>

        <TabsContent value="audiences" className="mt-4">
          <AudienceBuilder profileId={profile?.id} />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <CircleAdsDashboard profileId={profile?.id} />
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <TrustScorePricing 
            profileId={profile?.id} 
            currentTrustScore={canAdvertise?.trust_score || 50}
          />
        </TabsContent>

        <TabsContent value="packages" className="mt-4">
          <MediaPackages profileId={profile?.id} />
        </TabsContent>

        <TabsContent value="auctions" className="mt-4">
          <AuctionHistory profileId={profile?.id} />
        </TabsContent>

        <TabsContent value="wallet" className="mt-4">
          <CircleAdsWallet profileId={profile?.id} wallet={wallet} />
        </TabsContent>

        <TabsContent value="privacy" className="mt-4">
          <PrivacySettings profileId={profile?.id} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="moderation" className="mt-4">
            <CircleAdsModeration />
          </TabsContent>
        )}
      </Tabs>

      {/* Create Campaign Modal */}
      {showCreateCampaign && (
        <CircleAdsCreateCampaign
          profileId={profile?.id}
          onClose={() => setShowCreateCampaign(false)}
        />
      )}
    </div>
  );
}
