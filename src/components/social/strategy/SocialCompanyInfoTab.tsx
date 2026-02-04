import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Globe, Instagram as InstagramIcon, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
}

interface CompanyInfo {
  name: string | null;
  segment: string | null;
  website: string | null;
  instagram: string | null;
  description: string | null;
  target_audience: string | null;
  main_challenges: string | null;
}

export const SocialCompanyInfoTab = ({ projectId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    loadCompanyInfo();
  }, [projectId]);

  const loadCompanyInfo = async () => {
    try {
      // Get project with company info
      const { data: project, error } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          product_name,
          onboarding_companies (
            id,
            name,
            segment,
            website,
            instagram,
            onboarding_company_briefings (
              company_description,
              target_audience,
              main_challenges
            )
          )
        `)
        .eq("id", projectId)
        .single();

      if (error) throw error;

      const companyData = project?.onboarding_companies as any;
      const briefing = companyData?.onboarding_company_briefings?.[0];

      setCompany({
        name: companyData?.name || project?.product_name,
        segment: companyData?.segment,
        website: companyData?.website,
        instagram: companyData?.instagram,
        description: briefing?.company_description,
        target_audience: briefing?.target_audience,
        main_challenges: briefing?.main_challenges,
      });
    } catch (error) {
      console.error("Error loading company info:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Informações da empresa não encontradas.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Company Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{company.name || "Empresa"}</CardTitle>
                {company.segment && (
                  <CardDescription className="text-base">{company.segment}</CardDescription>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {company.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                </Button>
              )}
              {company.instagram && (
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={company.instagram.startsWith("http") ? company.instagram : `https://instagram.com/${company.instagram.replace("@", "")}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="gap-2"
                  >
                    <InstagramIcon className="h-4 w-4" />
                    Instagram
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Company Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {company.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sobre a Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{company.description}</p>
            </CardContent>
          </Card>
        )}

        {company.target_audience && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Público-Alvo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{company.target_audience}</p>
            </CardContent>
          </Card>
        )}

        {company.main_challenges && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Principais Desafios</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{company.main_challenges}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {!company.description && !company.target_audience && !company.main_challenges && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Informações Adicionais</h3>
            <p className="text-muted-foreground mb-4">
              Complete o briefing da empresa no painel de onboarding para ver mais detalhes aqui.
            </p>
            <Button variant="outline" asChild>
              <a href={`#/onboarding-tasks/${projectId}`} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ir para Onboarding
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
