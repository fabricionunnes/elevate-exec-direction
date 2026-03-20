import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle, Send, Instagram, Facebook, KeyRound, DollarSign, CreditCard } from "lucide-react";
import { toast } from "sonner";

const PublicAdsBriefingPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
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
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("social_ads_briefing")
        .select("*")
        .eq("access_token", token)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (data.submitted_at) {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      setFormData({
        instagram_url: data.instagram_url || "",
        facebook_url: data.facebook_url || "",
        meta_ads_login: data.meta_ads_login || "",
        meta_ads_password: data.meta_ads_password || "",
        monthly_ad_budget: data.monthly_ad_budget || 0,
        payment_method: data.payment_method || "",
        additional_notes: data.additional_notes || "",
      });
    } catch (error) {
      console.error("Error loading:", error);
      toast.error("Erro ao carregar formulário");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.instagram_url && !formData.facebook_url) {
      toast.error("Preencha pelo menos o Instagram ou Facebook");
      return;
    }
    if (!formData.meta_ads_login || !formData.meta_ads_password) {
      toast.error("Preencha os acessos do Meta Ads");
      return;
    }
    if (!formData.payment_method) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("social_ads_briefing")
        .update({
          ...formData,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("access_token", token);

      if (error) throw error;
      setSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    } catch (error) {
      console.error("Error submitting:", error);
      toast.error("Erro ao enviar formulário");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold mb-2">Link inválido</h2>
            <p className="text-muted-foreground">Este formulário não foi encontrado ou o link expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-semibold">Formulário enviado!</h2>
            <p className="text-muted-foreground">
              Obrigado por preencher as informações. Nossa equipe já recebeu os dados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Informações para Tráfego Pago</h1>
          <p className="text-muted-foreground">
            Preencha os dados abaixo para que possamos configurar suas campanhas de anúncios.
          </p>
        </div>

        {/* Redes Sociais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Instagram className="h-5 w-5" />
              Redes Sociais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Instagram <span className="text-destructive">*</span></Label>
              <Input
                placeholder="@seuinstagram ou link do perfil"
                value={formData.instagram_url}
                onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input
                placeholder="Link da página do Facebook"
                value={formData.facebook_url}
                onChange={(e) => setFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Acessos Meta Ads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" />
              Acessos Meta Ads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Forneça os dados de acesso do Instagram e Facebook para que possamos gerenciar os anúncios no Meta Ads.
            </p>
            <div className="space-y-2">
              <Label>Login (e-mail ou telefone) <span className="text-destructive">*</span></Label>
              <Input
                placeholder="E-mail ou telefone de acesso"
                value={formData.meta_ads_login}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_ads_login: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                placeholder="Senha de acesso"
                value={formData.meta_ads_password}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_ads_password: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Investimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              Investimento em Anúncios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Valor previsto para investimento mensal (R$)</Label>
              <CurrencyInput
                value={formData.monthly_ad_budget}
                onChange={(value) => setFormData(prev => ({ ...prev, monthly_ad_budget: value }))}
                placeholder="0,00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Forma de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" />
              Forma de Pagamento <span className="text-destructive">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={formData.payment_method}
              onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
              className="space-y-3"
            >
              {[
                { value: "cartao", label: "Cartão de Crédito" },
                { value: "pix", label: "PIX" },
                { value: "boleto", label: "Boleto" },
              ].map(opt => (
                <div key={opt.value} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={opt.value} id={`pay-${opt.value}`} />
                  <Label htmlFor={`pay-${opt.value}`} className="cursor-pointer flex-1">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <Label>Observações adicionais</Label>
            <Textarea
              placeholder="Algo mais que devemos saber?"
              value={formData.additional_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
              rows={3}
            />
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Formulário
        </Button>
      </div>
    </div>
  );
};

export default PublicAdsBriefingPage;
