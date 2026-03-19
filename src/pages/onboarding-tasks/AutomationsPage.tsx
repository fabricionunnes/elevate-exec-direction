import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Zap, History, LayoutTemplate } from "lucide-react";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { AutomationRulesList } from "@/components/automations/AutomationRulesList";
import { AutomationExecutionLog } from "@/components/automations/AutomationExecutionLog";
import { AutomationTemplates } from "@/components/automations/AutomationTemplates";

export default function AutomationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("rules");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/onboarding-tasks")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <NexusHeader showTitle={false} />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-500" />
              Central de Automações
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure regras automáticas entre os módulos do sistema
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rules" className="gap-2">
              <Zap className="h-4 w-4" />
              Regras
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Modelos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <AutomationRulesList />
          </TabsContent>

          <TabsContent value="history">
            <AutomationExecutionLog />
          </TabsContent>

          <TabsContent value="templates">
            <AutomationTemplates onActivated={() => setActiveTab("rules")} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
