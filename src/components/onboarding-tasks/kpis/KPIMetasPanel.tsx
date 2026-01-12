import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings, Users, BarChart3, Link, Sparkles, Building2, Trophy, Gamepad2, ChevronDown, Megaphone, UsersRound } from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { KPIConfigurationTab } from "./KPIConfigurationTab";
import { SalespeopleTab } from "./SalespeopleTab";
import { KPIDashboardTab } from "./KPIDashboardTab";
import { KPIAnalysisTab } from "./KPIAnalysisTab";
import { UnitsTab } from "./UnitsTab";
import { TeamsTab } from "./TeamsTab";
import { EndomarketingPanel } from "../endomarketing/EndomarketingPanel";
import { GamificationPanel } from "../gamification/GamificationPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface KPIMetasPanelProps {
  companyId: string;
  isAdmin: boolean;
  projectId?: string;
  isStaff?: boolean;
  defaultTab?: string;
}

export const KPIMetasPanel = ({ companyId, isAdmin, projectId, isStaff = false, defaultTab }: KPIMetasPanelProps) => {
  const canAccessAllTabs = isStaff || isAdmin;
  const [activeTab, setActiveTab] = useState(defaultTab || "dashboard");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    fetchCompanyName();
  }, [companyId]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

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
    const link = `${getPublicBaseUrl()}/#/kpi-entry/${companyId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado! Compartilhe com os vendedores.");
  };

  // Check if current tab is within a submenu
  const isEndomarketingActive = activeTab === "gamification" || activeTab === "campaigns";
  const isConfigActive = activeTab === "units" || activeTab === "teams" || activeTab === "salespeople" || activeTab === "config";

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header with public link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Metas & KPIs</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure e acompanhe os indicadores de performance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copyPublicLink} className="gap-2 w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm">
          <Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="sm:hidden">Copiar Link</span>
          <span className="hidden sm:inline">Copiar Link de Lançamento</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 pb-1">
          <TabsList className="h-auto w-max sm:w-full inline-flex sm:flex flex-nowrap sm:flex-wrap justify-start gap-1 bg-transparent p-0">
            {/* Dashboard */}
            <TabsTrigger value="dashboard" className="gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Dash</span>
            </TabsTrigger>

            {/* Análise IA */}
            {canAccessAllTabs && (
              <TabsTrigger value="analysis" className="gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Análise IA</span>
                <span className="sm:hidden">IA</span>
              </TabsTrigger>
            )}

            {/* Endomarketing Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors",
                    isEndomarketingActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Endomarketing</span>
                  <span className="sm:hidden">Endo</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() => setActiveTab("gamification")}
                  className={cn(
                    "gap-2 cursor-pointer",
                    activeTab === "gamification" && "bg-accent"
                  )}
                >
                  <Gamepad2 className="h-4 w-4" />
                  Gamificação
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveTab("campaigns")}
                  className={cn(
                    "gap-2 cursor-pointer",
                    activeTab === "campaigns" && "bg-accent"
                  )}
                >
                  <Megaphone className="h-4 w-4" />
                  Campanhas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Configuração Dropdown */}
            {canAccessAllTabs && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors",
                      isConfigActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    )}
                  >
                    <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Configuração</span>
                    <span className="sm:hidden">Config</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setActiveTab("units")}
                    className={cn(
                      "gap-2 cursor-pointer",
                      activeTab === "units" && "bg-accent"
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                    Unidades
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveTab("teams")}
                    className={cn(
                      "gap-2 cursor-pointer",
                      activeTab === "teams" && "bg-accent"
                    )}
                  >
                    <UsersRound className="h-4 w-4" />
                    Equipes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveTab("salespeople")}
                    className={cn(
                      "gap-2 cursor-pointer",
                      activeTab === "salespeople" && "bg-accent"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    Vendedores
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveTab("config")}
                    className={cn(
                      "gap-2 cursor-pointer",
                      activeTab === "config" && "bg-accent"
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    Configuração de KPIs
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TabsList>
        </div>

        {/* Tab Contents */}
        <TabsContent value="dashboard" className="mt-6">
          <KPIDashboardTab 
            companyId={companyId} 
            projectId={projectId} 
            canDeleteEntries={canAccessAllTabs} 
            canEditSalesHistory={true} 
          />
        </TabsContent>

        <TabsContent value="gamification" className="mt-6">
          <GamificationPanel
            companyId={companyId}
            projectId={projectId || ""}
            isAdmin={true}
          />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <EndomarketingPanel
            companyId={companyId}
            projectId={projectId || ""}
            isAdmin={true}
          />
        </TabsContent>

        <TabsContent value="salespeople" className="mt-6">
          <SalespeopleTab companyId={companyId} isAdmin={true} />
        </TabsContent>

        {canAccessAllTabs && (
          <>
            <TabsContent value="units" className="mt-6">
              <UnitsTab companyId={companyId} isAdmin={true} />
            </TabsContent>

            <TabsContent value="teams" className="mt-6">
              <TeamsTab companyId={companyId} isAdmin={true} />
            </TabsContent>

            <TabsContent value="analysis" className="mt-6">
              <KPIAnalysisTab companyId={companyId} projectId={projectId} />
            </TabsContent>

            <TabsContent value="config" className="mt-6">
              <KPIConfigurationTab companyId={companyId} isAdmin={canAccessAllTabs} isClient={!isStaff} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};