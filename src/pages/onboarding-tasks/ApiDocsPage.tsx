import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code2, DollarSign, Target, Briefcase, MessageSquare, Video, BarChart3 } from "lucide-react";
import { FinancialApiDocs } from "@/components/financial-api/FinancialApiDocs";
import { CrmApiDocs } from "@/components/financial-api/CrmApiDocs";
import { ProductApiDocs } from "@/components/financial-api/ProductApiDocs";
import { ConversationsApiDocs } from "@/components/financial-api/ConversationsApiDocs";
import { ProjectMeetingsApiDocs } from "@/components/financial-api/ProjectMeetingsApiDocs";
import { CRMTrafficApiDocs } from "@/components/crm/traffic/CRMTrafficApiDocs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ApiDocsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/onboarding-tasks")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Nexus
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Documentação da API
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="crm" className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="crm" className="gap-2">
              <Target className="h-4 w-4" />
              CRM Comercial
            </TabsTrigger>
            <TabsTrigger value="project_meetings" className="gap-2">
              <Video className="h-4 w-4" />
              Reuniões
            </TabsTrigger>
            <TabsTrigger value="product" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Produto
            </TabsTrigger>
            <TabsTrigger value="conversations" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial">
            <FinancialApiDocs />
          </TabsContent>

          <TabsContent value="crm">
            <CrmApiDocs />
          </TabsContent>

          <TabsContent value="product">
            <ProductApiDocs />
          </TabsContent>

          <TabsContent value="project_meetings">
            <ProjectMeetingsApiDocs />
          </TabsContent>

          <TabsContent value="conversations">
            <ConversationsApiDocs />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
