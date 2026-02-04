import { useState, useEffect } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Link2, 
  Building2, 
  Search, 
  ClipboardList, 
  Brain,
  Lightbulb,
  Loader2
} from "lucide-react";
import { SocialIntegrationsTab } from "@/components/social/strategy/SocialIntegrationsTab";
import { SocialCompanyInfoTab } from "@/components/social/strategy/SocialCompanyInfoTab";
import { SocialResearchTab } from "@/components/social/strategy/SocialResearchTab";
import { SocialBriefingTab } from "@/components/social/strategy/SocialBriefingTab";
import { SocialStrategyIntelligenceTab } from "@/components/social/strategy/SocialStrategyIntelligenceTab";
import { SocialContentSuggestions } from "@/components/social/strategy/SocialContentSuggestions";
import { supabase } from "@/integrations/supabase/client";

interface ContextType {
  project: { id: string; product_name: string | null; company_name: string | null };
  boardId: string;
}

export const SocialStrategyLayout = () => {
  const { project, boardId } = useOutletContext<ContextType>();
  const location = useLocation();
  
  // Extract tab from hash if present (e.g., #briefing)
  const hashTab = location.hash.split("?")[0].replace("#", "");
  const [activeTab, setActiveTab] = useState(hashTab || "integrations");
  const [briefingComplete, setBriefingComplete] = useState(false);
  const [loadingBriefing, setLoadingBriefing] = useState(true);

  useEffect(() => {
    checkBriefingStatus();
  }, [project.id]);

  const checkBriefingStatus = async () => {
    try {
      const { data } = await supabase
        .from("social_briefing_forms")
        .select("is_complete")
        .eq("project_id", project.id)
        .single();

      setBriefingComplete(data?.is_complete || false);
    } catch (error) {
      console.error("Error checking briefing:", error);
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const tabs = [
    { id: "integrations", label: "Integrações", icon: Link2 },
    { id: "company", label: "Informações da Empresa", icon: Building2 },
    { id: "research", label: "Pesquisas & Inspirações", icon: Search },
    { id: "briefing", label: "Briefing | Social Media", icon: ClipboardList },
    { id: "strategy", label: "Estratégia & Inteligência", icon: Brain, requiresBriefing: true },
    { id: "suggestions", label: "Sugestões de Conteúdo", icon: Lightbulb, requiresBriefing: true },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-card">
        <h2 className="text-lg font-semibold mb-1">Base Estratégica do Social Media</h2>
        <p className="text-sm text-muted-foreground">
          Fundamentos e inteligência para a estratégia de conteúdo
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 border-b bg-muted/30">
          <TabsList className="h-12 w-full justify-start gap-1 bg-transparent">
            {tabs.map((tab) => {
              const isDisabled = tab.requiresBriefing && !briefingComplete && !loadingBriefing;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={isDisabled}
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 px-4"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {isDisabled && (
                    <span className="text-xs text-muted-foreground ml-1">(Complete o Briefing)</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="integrations" className="h-full m-0 p-0">
            <SocialIntegrationsTab projectId={project.id} />
          </TabsContent>

          <TabsContent value="company" className="h-full m-0 p-0">
            <SocialCompanyInfoTab projectId={project.id} />
          </TabsContent>

          <TabsContent value="research" className="h-full m-0 p-0">
            <SocialResearchTab projectId={project.id} />
          </TabsContent>

          <TabsContent value="briefing" className="h-full m-0 p-0">
            <SocialBriefingTab 
              projectId={project.id} 
              onComplete={() => setBriefingComplete(true)} 
            />
          </TabsContent>

          <TabsContent value="strategy" className="h-full m-0 p-0">
            {loadingBriefing ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : briefingComplete ? (
              <SocialStrategyIntelligenceTab projectId={project.id} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                  <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Complete o Briefing Primeiro</h3>
                  <p className="text-muted-foreground">
                    Para gerar análises estratégicas com IA, você precisa primeiro preencher 
                    completamente o formulário de Briefing de Social Media.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="h-full m-0 p-0">
            {briefingComplete ? (
              <SocialContentSuggestions projectId={project.id} boardId={boardId} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                  <Lightbulb className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Complete o Briefing Primeiro</h3>
                  <p className="text-muted-foreground">
                    Para gerar sugestões de conteúdo, complete o briefing.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
