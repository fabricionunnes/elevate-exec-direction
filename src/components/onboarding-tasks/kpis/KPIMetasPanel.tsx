import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings, Users, BarChart3, Link, Copy } from "lucide-react";
import { KPIConfigurationTab } from "./KPIConfigurationTab";
import { SalespeopleTab } from "./SalespeopleTab";
import { KPIDashboardTab } from "./KPIDashboardTab";

interface KPIMetasPanelProps {
  companyId: string;
  isAdmin: boolean;
}

export const KPIMetasPanel = ({ companyId, isAdmin }: KPIMetasPanelProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    fetchCompanyName();
  }, [companyId]);

  const fetchCompanyName = async () => {
    const { data } = await supabase
      .from("onboarding_companies")
      .select("name")
      .eq("id", companyId)
      .single();
    
    if (data) {
      setCompanyName(data.name);
    }
  };

  const copyPublicLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/kpi-entry/${companyId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado! Compartilhe com os vendedores.");
  };

  if (!companyId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Esta funcionalidade requer uma empresa vinculada ao projeto.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with public link */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Metas & KPIs</h2>
          <p className="text-sm text-muted-foreground">
            Configure e acompanhe os indicadores de performance
          </p>
        </div>
        <Button variant="outline" onClick={copyPublicLink} className="gap-2">
          <Link className="h-4 w-4" />
          Copiar Link de Lançamento
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="salespeople" className="gap-2">
            <Users className="h-4 w-4" />
            Vendedores
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <KPIDashboardTab companyId={companyId} />
        </TabsContent>

        <TabsContent value="salespeople" className="mt-6">
          <SalespeopleTab companyId={companyId} isAdmin={isAdmin} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="config" className="mt-6">
            <KPIConfigurationTab companyId={companyId} isAdmin={isAdmin} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
