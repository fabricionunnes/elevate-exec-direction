import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Building2, Lightbulb, FileText, Sparkles } from "lucide-react";
import { SocialIntegrationsTab } from "@/components/social/strategy/SocialIntegrationsTab";
import { SocialCompanyInfoTab } from "@/components/social/strategy/SocialCompanyInfoTab";
import { SocialInspirationTab } from "@/components/social/strategy/SocialInspirationTab";
import { SocialBriefingTab } from "@/components/social/strategy/SocialBriefingTab";
import { SocialAITab } from "@/components/social/strategy/SocialAITab";

interface ContextType {
  project: { id: string; product_name: string | null; company_name: string | null };
  boardId: string;
}

export const SocialStrategyPage = () => {
  const { project, boardId } = useOutletContext<ContextType>();
  const [activeTab, setActiveTab] = useState("company-info");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 md:p-4 border-b bg-card">
        <h2 className="text-lg md:text-xl font-semibold">Base Estratégica</h2>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Fundamentos e referências para produção de conteúdo
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b bg-card px-2 md:px-4 overflow-x-auto">
          <TabsList className="h-11 md:h-12 bg-transparent gap-1 md:gap-2 w-max min-w-full md:w-auto">
            <TabsTrigger 
              value="company-info" 
              className="gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 md:px-3"
            >
              <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Informações da Empresa</span>
              <span className="sm:hidden">Empresa</span>
            </TabsTrigger>
            <TabsTrigger 
              value="inspiration" 
              className="gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 md:px-3"
            >
              <Lightbulb className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Pesquisas & Inspirações</span>
              <span className="sm:hidden">Inspirações</span>
            </TabsTrigger>
            <TabsTrigger 
              value="briefing" 
              className="gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 md:px-3"
            >
              <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Briefing
            </TabsTrigger>
            <TabsTrigger 
              value="ai" 
              className="gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 md:px-3"
            >
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">IA Criativa</span>
              <span className="sm:hidden">IA</span>
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 md:px-3"
            >
              <Link2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Integrações</span>
              <span className="sm:hidden">Integr.</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="integrations" className="h-full m-0">
            <SocialIntegrationsTab projectId={project.id} />
          </TabsContent>
          
          <TabsContent value="company-info" className="h-full m-0">
            <SocialCompanyInfoTab projectId={project.id} />
          </TabsContent>
          
          <TabsContent value="inspiration" className="h-full m-0">
            <SocialInspirationTab projectId={project.id} />
          </TabsContent>
          
          <TabsContent value="briefing" className="h-full m-0">
            <SocialBriefingTab projectId={project.id} />
          </TabsContent>
          
          <TabsContent value="ai" className="h-full m-0">
            <SocialAITab projectId={project.id} boardId={boardId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
