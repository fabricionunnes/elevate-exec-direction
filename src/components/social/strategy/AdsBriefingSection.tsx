import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Save, Link, Copy, CheckCircle, Eye, EyeOff,
  Instagram, Facebook, KeyRound, DollarSign, CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface AdsBriefingSectionProps {
  projectId: string;
}

interface AdsBriefing {
  id: string;
  access_token: string;
  instagram_url: string | null;
  facebook_url: string | null;
  meta_ads_login: string | null;
  meta_ads_password: string | null;
  monthly_ad_budget: number | null;
  payment_method: string | null;
  additional_notes: string | null;
  submitted_at: string | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  cartao: "Cartão de Crédito",
  pix: "PIX",
  boleto: "Boleto",
};

export const AdsBriefingSection = ({ projectId }: AdsBriefingSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<AdsBriefing | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    instagram_url: "",
    facebook_url: "",
    meta_ads_login: "",
    meta_ads_password: "",
    monthly_ad_budget: 0,
    payment_method: "",
    additional_notes: "",
    traffic_manager_name: "",
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const { data: existing, error } = await supabase
        .from("social_ads_briefing")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        setData(existing as AdsBriefing);
        setFormData({
          instagram_url: existing.instagram_url || "",
          facebook_url: existing.facebook_url || "",
          meta_ads_login: existing.meta_ads_login || "",
          meta_ads_password: existing.meta_ads_password || "",
          monthly_ad_budget: existing.monthly_ad_budget || 0,
          payment_method: existing.payment_method || "",
          additional_notes: existing.additional_notes || "",
          traffic_manager_name: (existing as any).traffic_manager_name || "",
        });
      }
    } catch (error) {
      console.error("Error loading ads briefing:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { data: created, error } = await supabase
        .from("social_ads_briefing")
        .insert({ project_id: projectId })
        .select()
        .single();

      if (error) throw error;
      setData(created as AdsBriefing);
      toast.success("Formulário criado! Copie o link para enviar ao cliente.");
    } catch (error) {
      console.error("Error creating:", error);
      toast.error("Erro ao criar formulário");
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("social_ads_briefing")
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);

      if (error) throw error;
      toast.success("Salvo!");
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const getPublicLink = () => {
    if (!data?.access_token) return "";
    const baseUrl = getPublicBaseUrl();
    return `${baseUrl}/#/ads-briefing/${data.access_token}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getPublicLink());
    toast.success("Link copiado!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed border-2 bg-muted/30">
        <CardContent className="p-8 text-center space-y-4">
          <KeyRound className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h4 className="font-medium mb-1">Formulário de Tráfego Pago</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Crie o formulário para o cliente preencher as informações de redes sociais, acessos e investimento em anúncios.
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Link className="h-4 w-4" />
            Criar Formulário
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with link */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Briefing de Tráfego Pago</h3>
          {data.submitted_at ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Preenchido pelo cliente
            </Badge>
          ) : (
            <Badge variant="secondary">Aguardando preenchimento</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
          <Copy className="h-4 w-4" />
          Copiar Link Público
        </Button>
      </div>

      {/* Data display/edit */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Instagram className="h-4 w-4" />
              Instagram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={formData.instagram_url}
              onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))}
              placeholder="@usuario ou link"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Facebook className="h-4 w-4" />
              Facebook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={formData.facebook_url}
              onChange={(e) => setFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
              placeholder="Link da página"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Acessos Meta Ads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Login</Label>
              <Input
                value={formData.meta_ads_login}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_ads_login: e.target.value }))}
                placeholder="E-mail ou telefone"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.meta_ads_password}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_ads_password: e.target.value }))}
                  placeholder="Senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Investimento Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyInput
              value={formData.monthly_ad_budget}
              onChange={(value) => setFormData(prev => ({ ...prev, monthly_ad_budget: value }))}
              placeholder="0,00"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Forma de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <Button
                  key={value}
                  variant={formData.payment_method === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, payment_method: value }))}
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={formData.additional_notes}
          onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
          placeholder="Observações adicionais..."
          rows={3}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
};
