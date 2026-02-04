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
  const [activeTab, setActiveTab] = useState("integrations");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <h2 className="text-xl font-semibold">Base Estratégica do Social Media</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fundamentos e referências para toda a produção de conteúdo
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b bg-card px-4">
          <TabsList className="h-12 bg-transparent gap-2">
            <TabsTrigger 
              value="integrations" 
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <Link2 className="h-4 w-4" />
              Integrações
            </TabsTrigger>
            <TabsTrigger 
              value="company-info" 
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <Building2 className="h-4 w-4" />
              Informações da Empresa
            </TabsTrigger>
            <TabsTrigger 
              value="inspiration" 
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <Lightbulb className="h-4 w-4" />
              Pesquisas & Inspirações
            </TabsTrigger>
            <TabsTrigger 
              value="briefing" 
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <FileText className="h-4 w-4" />
              Briefing
            </TabsTrigger>
            <TabsTrigger 
              value="ai" 
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <Sparkles className="h-4 w-4" />
              IA Criativa
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
