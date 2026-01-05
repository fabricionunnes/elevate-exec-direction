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
    facebook_sales_quantity: "",
    facebook_sales_value: "",
    google_ads_investment: "",
    google_sales_quantity: "",
    google_sales_value: "",
    linkedin_ads_investment: "",
    linkedin_sales_quantity: "",
    linkedin_sales_value: "",
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
      // Calculate totals for backward compatibility
      const totalSalesQuantity = 
        (parseInt(formData.facebook_sales_quantity) || 0) +
        (parseInt(formData.google_sales_quantity) || 0) +
        (parseInt(formData.linkedin_sales_quantity) || 0);
      
      const totalSalesValue = 
        (parseFloat(formData.facebook_sales_value) || 0) +
        (parseFloat(formData.google_sales_value) || 0) +
        (parseFloat(formData.linkedin_sales_value) || 0);

      const { error } = await supabase
        .from("onboarding_cac_forms")
        .insert({
          project_id: projectId,
          company_name: "Via Link",
          // Investment per channel
          facebook_ads_investment: formData.facebook_ads_investment ? parseFloat(formData.facebook_ads_investment) : null,
          google_ads_investment: formData.google_ads_investment ? parseFloat(formData.google_ads_investment) : null,
          linkedin_ads_investment: formData.linkedin_ads_investment ? parseFloat(formData.linkedin_ads_investment) : null,
          // Sales per channel
          facebook_sales_quantity: formData.facebook_sales_quantity ? parseInt(formData.facebook_sales_quantity) : null,
          facebook_sales_value: formData.facebook_sales_value ? parseFloat(formData.facebook_sales_value) : null,
          google_sales_quantity: formData.google_sales_quantity ? parseInt(formData.google_sales_quantity) : null,
          google_sales_value: formData.google_sales_value ? parseFloat(formData.google_sales_value) : null,
          linkedin_sales_quantity: formData.linkedin_sales_quantity ? parseInt(formData.linkedin_sales_quantity) : null,
          linkedin_sales_value: formData.linkedin_sales_value ? parseFloat(formData.linkedin_sales_value) : null,
          // Totals
          sales_quantity_3_months: totalSalesQuantity > 0 ? totalSalesQuantity : null,
          sales_value_3_months: totalSalesValue > 0 ? totalSalesValue : null,
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

  const renderChannelSection = (
    channelName: string, 
    investmentField: string, 
    salesQtyField: string, 
    salesValueField: string,
    bgColor: string
  ) => (
    <div className={`p-4 rounded-lg ${bgColor} space-y-4`}>
      <h3 className="font-semibold">{channelName}</h3>
      
      <div className="space-y-2">
        <Label>
          Investimento mensal em {channelName} (R$) <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          placeholder="0"
          value={formData[investmentField as keyof typeof formData]}
          onChange={(e) => handleChange(investmentField, e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>
          Quantidade de vendas via {channelName} (últimos 3 meses) <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          placeholder="0"
          value={formData[salesQtyField as keyof typeof formData]}
          onChange={(e) => handleChange(salesQtyField, e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>
          Faturamento das vendas via {channelName} (R$, últimos 3 meses) <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          placeholder="0"
          value={formData[salesValueField as keyof typeof formData]}
          onChange={(e) => handleChange(salesValueField, e.target.value)}
          required
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Formulário de CAC</CardTitle>
          <CardDescription>
            Preencha os dados de investimento e vendas por canal de mídia paga
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderChannelSection(
              "Facebook ADS",
              "facebook_ads_investment",
              "facebook_sales_quantity",
              "facebook_sales_value",
              "bg-blue-500/10 border border-blue-500/20"
            )}

            {renderChannelSection(
              "Google ADS",
              "google_ads_investment",
              "google_sales_quantity",
              "google_sales_value",
              "bg-red-500/10 border border-red-500/20"
            )}

            {renderChannelSection(
              "LinkedIn ADS",
              "linkedin_ads_investment",
              "linkedin_sales_quantity",
              "linkedin_sales_value",
              "bg-sky-500/10 border border-sky-500/20"
            )}

            <Separator />

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
