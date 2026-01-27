import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  Zap,
  Info
} from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  profileId?: string;
  currentTrustScore?: number;
}

export function TrustScorePricing({ profileId, currentTrustScore = 50 }: Props) {
  const [simulatedScore, setSimulatedScore] = useState(currentTrustScore);

  const { data: pricingRules } = useQuery({
    queryKey: ["circle-ads-pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_ads_pricing_rules")
        .select("*")
        .eq("is_active", true)
        .order("min_trust_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userPricing } = useQuery({
    queryKey: ["circle-ads-user-pricing", simulatedScore],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ads_pricing_multiplier", {
        p_trust_score: simulatedScore,
      });
      if (error) throw error;
      return data?.[0] || { cpm_mult: 1, cpc_mult: 1, reach_mult: 1, priority_mult: 1 };
    },
  });

  const getCurrentTier = (score: number) => {
    return pricingRules?.find(
      (rule: any) => score >= rule.min_trust_score && score <= rule.max_trust_score
    );
  };

  const currentTier = getCurrentTier(simulatedScore);

  const baseCPM = 5.00; // Base CPM in R$
  const baseCPC = 0.50; // Base CPC in R$

  const calculateCost = (base: number, multiplier: number) => {
    return (base * multiplier).toFixed(2);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 40) return "text-yellow-500";
    if (score >= 20) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Elite";
    if (score >= 60) return "Alto";
    if (score >= 40) return "Médio";
    if (score >= 20) return "Baixo";
    return "Crítico";
  };

  return (
    <div className="space-y-6">
      {/* Current Trust Score Card */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Seu Trust Score & Precificação
          </CardTitle>
          <CardDescription>
            Seu Trust Score impacta diretamente o custo e alcance dos seus anúncios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trust Score Display */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center">
              <div className={`text-5xl font-bold ${getScoreColor(currentTrustScore)}`}>
                {currentTrustScore}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Trust Score Atual
              </p>
              <Badge className={`mt-2 ${
                currentTrustScore >= 80 ? "bg-green-500" :
                currentTrustScore >= 60 ? "bg-blue-500" :
                currentTrustScore >= 40 ? "bg-yellow-500" :
                "bg-red-500"
              }`}>
                {getScoreLabel(currentTrustScore)}
              </Badge>
            </div>

            <div className="flex-1 w-full">
              <Progress value={currentTrustScore} className="h-3" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>0</span>
                <span>20</span>
                <span>40</span>
                <span>60</span>
                <span>80</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {/* Current Pricing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <DollarSign className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
              <p className="text-lg font-bold">
                R$ {calculateCost(baseCPM, userPricing?.cpm_mult || 1)}
              </p>
              <p className="text-xs text-muted-foreground">CPM</p>
              {(userPricing?.cpm_mult || 1) < 1 && (
                <Badge variant="outline" className="text-green-500 text-xs mt-1">
                  -{((1 - (userPricing?.cpm_mult || 1)) * 100).toFixed(0)}%
                </Badge>
              )}
              {(userPricing?.cpm_mult || 1) > 1 && (
                <Badge variant="outline" className="text-red-500 text-xs mt-1">
                  +{(((userPricing?.cpm_mult || 1) - 1) * 100).toFixed(0)}%
                </Badge>
              )}
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Target className="h-5 w-5 mx-auto mb-2 text-blue-500" />
              <p className="text-lg font-bold">
                R$ {calculateCost(baseCPC, userPricing?.cpc_mult || 1)}
              </p>
              <p className="text-xs text-muted-foreground">CPC</p>
              {(userPricing?.cpc_mult || 1) < 1 && (
                <Badge variant="outline" className="text-green-500 text-xs mt-1">
                  -{((1 - (userPricing?.cpc_mult || 1)) * 100).toFixed(0)}%
                </Badge>
              )}
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <TrendingUp className="h-5 w-5 mx-auto mb-2 text-purple-500" />
              <p className="text-lg font-bold">
                {((userPricing?.reach_mult || 1) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">Alcance</p>
              {(userPricing?.reach_mult || 1) > 1 && (
                <Badge variant="outline" className="text-green-500 text-xs mt-1">
                  Bônus
                </Badge>
              )}
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Zap className="h-5 w-5 mx-auto mb-2 text-orange-500" />
              <p className="text-lg font-bold">
                {((userPricing?.priority_mult || 1) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">Prioridade</p>
              {(userPricing?.priority_mult || 1) > 1 && (
                <Badge variant="outline" className="text-green-500 text-xs mt-1">
                  Bônus
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Simulator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Simulador de Custo
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Simule como diferentes Trust Scores afetam seus custos de anúncios
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Trust Score Simulado</span>
              <span className={`text-lg font-bold ${getScoreColor(simulatedScore)}`}>
                {simulatedScore}
              </span>
            </div>
            <Slider
              value={[simulatedScore]}
              onValueChange={(v) => setSimulatedScore(v[0])}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-center gap-8 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">CPM</p>
              <p className="text-xl font-bold">
                R$ {calculateCost(baseCPM, userPricing?.cpm_mult || 1)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">CPC</p>
              <p className="text-xl font-bold">
                R$ {calculateCost(baseCPC, userPricing?.cpc_mult || 1)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Tiers Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tabela de Precificação por Trust Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Nível</th>
                  <th className="text-center py-2 px-3">Score</th>
                  <th className="text-center py-2 px-3">CPM</th>
                  <th className="text-center py-2 px-3">CPC</th>
                  <th className="text-center py-2 px-3">Alcance</th>
                  <th className="text-center py-2 px-3">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {pricingRules?.map((rule: any) => (
                  <tr 
                    key={rule.id} 
                    className={`border-b hover:bg-muted/30 ${
                      currentTrustScore >= rule.min_trust_score && 
                      currentTrustScore <= rule.max_trust_score 
                        ? "bg-primary/10" 
                        : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-medium">{rule.name}</td>
                    <td className="text-center py-2 px-3">
                      {rule.min_trust_score}-{rule.max_trust_score}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={rule.cpm_multiplier < 1 ? "text-green-500" : rule.cpm_multiplier > 1 ? "text-red-500" : ""}>
                        {rule.cpm_multiplier < 1 ? "-" : rule.cpm_multiplier > 1 ? "+" : ""}
                        {Math.abs((rule.cpm_multiplier - 1) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={rule.cpc_multiplier < 1 ? "text-green-500" : rule.cpc_multiplier > 1 ? "text-red-500" : ""}>
                        {rule.cpc_multiplier < 1 ? "-" : rule.cpc_multiplier > 1 ? "+" : ""}
                        {Math.abs((rule.cpc_multiplier - 1) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={rule.reach_multiplier > 1 ? "text-green-500" : rule.reach_multiplier < 1 ? "text-red-500" : ""}>
                        {rule.reach_multiplier > 1 ? "+" : rule.reach_multiplier < 1 ? "-" : ""}
                        {Math.abs((rule.reach_multiplier - 1) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={rule.priority_boost > 1 ? "text-green-500" : rule.priority_boost < 1 ? "text-red-500" : ""}>
                        {rule.priority_boost > 1 ? "+" : rule.priority_boost < 1 ? "-" : ""}
                        {Math.abs((rule.priority_boost - 1) * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
