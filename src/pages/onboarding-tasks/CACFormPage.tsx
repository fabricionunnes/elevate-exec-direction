import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

const CACFormPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    facebook_ads_investment: "",
    google_ads_investment: "",
    linkedin_ads_investment: "",
    sales_quantity_3_months: "",
    sales_value_3_months: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectId) {
      toast.error("Link inválido");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("onboarding_cac_forms")
        .insert({
          project_id: projectId,
          company_name: "Via Link",
          facebook_ads_investment: formData.facebook_ads_investment ? parseFloat(formData.facebook_ads_investment) : null,
          google_ads_investment: formData.google_ads_investment ? parseFloat(formData.google_ads_investment) : null,
          linkedin_ads_investment: formData.linkedin_ads_investment ? parseFloat(formData.linkedin_ads_investment) : null,
          sales_quantity_3_months: formData.sales_quantity_3_months ? parseInt(formData.sales_quantity_3_months) : null,
          sales_value_3_months: formData.sales_value_3_months ? parseFloat(formData.sales_value_3_months) : null,
        });

      if (error) throw error;

      setSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao enviar formulário");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Formulário Enviado!</h2>
            <p className="text-muted-foreground">
              Obrigado por preencher o formulário de CAC. Os dados foram registrados com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Formulário de CAC</CardTitle>
          <CardDescription>
            Preencha os dados de investimento em mídia paga e resultados de vendas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Investimentos por canal */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Investimento Mensal em Mídia Paga</p>
              
              <div className="space-y-2">
                <Label htmlFor="facebook_ads">
                  Quanto investe por mês em Facebook ADS? (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="facebook_ads"
                  type="number"
                  placeholder="0"
                  value={formData.facebook_ads_investment}
                  onChange={(e) => handleChange("facebook_ads_investment", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_ads">
                  Quanto investe por mês em Google ADS? (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="google_ads"
                  type="number"
                  placeholder="0"
                  value={formData.google_ads_investment}
                  onChange={(e) => handleChange("google_ads_investment", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin_ads">
                  Quanto investe por mês em LinkedIn ADS? (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="linkedin_ads"
                  type="number"
                  placeholder="0"
                  value={formData.linkedin_ads_investment}
                  onChange={(e) => handleChange("linkedin_ads_investment", e.target.value)}
                  required
                />
              </div>
            </div>

            <Separator />

            {/* Resultados de vendas */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Resultados de Vendas (últimos 3 meses)</p>
              
              <div className="space-y-2">
                <Label htmlFor="sales_quantity">
                  Quantidade de vendas feitas através do tráfego pago <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">Total de vendas nos últimos 3 meses</p>
                <Input
                  id="sales_quantity"
                  type="number"
                  placeholder="0"
                  value={formData.sales_quantity_3_months}
                  onChange={(e) => handleChange("sales_quantity_3_months", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales_value">
                  Valor total das vendas (R$) <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">Faturamento total nos últimos 3 meses</p>
                <Input
                  id="sales_value"
                  type="number"
                  placeholder="0"
                  value={formData.sales_value_3_months}
                  onChange={(e) => handleChange("sales_value_3_months", e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar"
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Termos • Privacidade
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CACFormPage;
