import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock,
  Info,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  profileId?: string;
}

export function PrivacySettings({ profileId }: Props) {
  const queryClient = useQueryClient();
  const [consent, setConsent] = useState<"personalized" | "generic_only" | "opt_out">("personalized");
  const [dataCollection, setDataCollection] = useState(true);
  const [personalizedAds, setPersonalizedAds] = useState(true);

  const { data: privacy, isLoading } = useQuery({
    queryKey: ["circle-ads-privacy", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("circle_ads_privacy")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  useEffect(() => {
    if (privacy) {
      setConsent(privacy.consent as any);
      setDataCollection(privacy.data_collection_consent);
      setPersonalizedAds(privacy.personalized_ads_consent);
    }
  }, [privacy]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Perfil não encontrado");

      const privacyData = {
        profile_id: profileId,
        consent,
        data_collection_consent: dataCollection,
        personalized_ads_consent: personalizedAds,
        consent_date: new Date().toISOString(),
      };

      if (privacy) {
        const { error } = await supabase
          .from("circle_ads_privacy")
          .update(privacyData)
          .eq("id", privacy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("circle_ads_privacy")
          .insert(privacyData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-privacy"] });
      toast.success("Preferências de privacidade salvas!");
    },
    onError: () => {
      toast.error("Erro ao salvar preferências");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Privacidade & Anúncios</CardTitle>
              <CardDescription>
                Controle como seus dados são usados para personalização de anúncios
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Consent Level */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nível de Personalização</CardTitle>
          <CardDescription>
            Escolha como você quer ver os anúncios no Circle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={consent} onValueChange={(v: any) => setConsent(v)}>
            <div className="space-y-4">
              <div 
                className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                  consent === "personalized" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => setConsent("personalized")}
              >
                <RadioGroupItem value="personalized" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <Label className="font-medium cursor-pointer">Anúncios Personalizados</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Receba anúncios relevantes baseados nos seus interesses, comunidades e atividades no Circle.
                    Você verá anúncios mais úteis e relevantes.
                  </p>
                </div>
              </div>

              <div 
                className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                  consent === "generic_only" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => setConsent("generic_only")}
              >
                <RadioGroupItem value="generic_only" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4 text-yellow-500" />
                    <Label className="font-medium cursor-pointer">Apenas Anúncios Genéricos</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você ainda verá anúncios, mas eles não serão personalizados com base nas suas atividades.
                    Seus dados não serão usados para segmentação.
                  </p>
                </div>
              </div>

              <div 
                className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                  consent === "opt_out" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => setConsent("opt_out")}
              >
                <RadioGroupItem value="opt_out" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-red-500" />
                    <Label className="font-medium cursor-pointer">Opt-out Total</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nenhum dado seu será coletado para fins de anúncios. Você ainda poderá ver alguns anúncios,
                    mas serão completamente genéricos.
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Detailed Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Controles Detalhados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Coleta de Dados de Navegação</Label>
              <p className="text-sm text-muted-foreground">
                Permitir rastreamento de páginas visitadas e ações no Circle
              </p>
            </div>
            <Switch
              checked={dataCollection}
              onCheckedChange={setDataCollection}
              disabled={consent === "opt_out"}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Anúncios Personalizados</Label>
              <p className="text-sm text-muted-foreground">
                Usar seus interesses para mostrar anúncios relevantes
              </p>
            </div>
            <Switch
              checked={personalizedAds}
              onCheckedChange={setPersonalizedAds}
              disabled={consent === "opt_out" || consent === "generic_only"}
            />
          </div>
        </CardContent>
      </Card>

      {/* LGPD Info */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Seus direitos (LGPD)</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Você pode alterar suas preferências a qualquer momento</li>
                <li>• Seus dados são armazenados com segurança e criptografia</li>
                <li>• Nunca compartilhamos seus dados com terceiros</li>
                <li>• Você pode solicitar a exclusão dos seus dados</li>
              </ul>
              {privacy?.consent_date && (
                <p className="mt-3 text-xs">
                  Último consentimento: {format(new Date(privacy.consent_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button 
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? (
          "Salvando..."
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Salvar Preferências
          </>
        )}
      </Button>
    </div>
  );
}
