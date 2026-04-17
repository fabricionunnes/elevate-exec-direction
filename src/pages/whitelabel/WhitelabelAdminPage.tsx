import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, Palette, Users, CreditCard, Globe, Plug, ArrowLeft, Boxes } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { TenantBrandingSettings } from "@/components/whitelabel/TenantBrandingSettings";
import { TenantUsersManagement } from "@/components/whitelabel/TenantUsersManagement";
import { TenantUsageDashboard } from "@/components/whitelabel/TenantUsageDashboard";
import { TenantDomainSettings } from "@/components/whitelabel/TenantDomainSettings";
import { TenantIntegrationsSettings } from "@/components/whitelabel/TenantIntegrationsSettings";
import { TenantModulesView } from "@/components/whitelabel/TenantModulesView";

export default function WhitelabelAdminPage() {
  const { tenant, isWhiteLabel } = useTenant();
  const [activeTab, setActiveTab] = useState("usage");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/onboarding-tasks")}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para o início
        </Button>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Painel White-Label
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie a personalização, usuários e assinatura do seu tenant
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto">
            <TabsTrigger value="usage" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Uso &</span> Billing
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Boxes className="h-4 w-4" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Plug className="h-4 w-4" />
              Integrações
            </TabsTrigger>
            <TabsTrigger value="domain" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Globe className="h-4 w-4" />
              Domínio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <TenantUsageDashboard />
          </TabsContent>
          <TabsContent value="modules">
            <TenantModulesView />
          </TabsContent>
          <TabsContent value="branding">
            <TenantBrandingSettings />
          </TabsContent>
          <TabsContent value="users">
            <TenantUsersManagement />
          </TabsContent>
          <TabsContent value="integrations">
            <TenantIntegrationsSettings />
          </TabsContent>
          <TabsContent value="domain">
            <TenantDomainSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
