import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoutineOverview } from "./RoutineOverview";
import { RoutineFormConfig } from "./RoutineFormConfig";
import { RoutineResponses } from "./RoutineResponses";
import { RoutineAIAdjust } from "./RoutineAIAdjust";
import { RoutineContractsList } from "./RoutineContractsList";

interface Props {
  projectId: string;
  companyId?: string | null;
  isAdmin: boolean;
}

export const RoutineContractPanel = ({ projectId, companyId, isAdmin }: Props) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const handleGenerateFromResponse = (responseId: string) => {
    setSelectedResponseId(responseId);
    setActiveTab("ai-adjust");
  };

  const handleViewContract = (contractId: string) => {
    setSelectedContractId(contractId);
    setActiveTab("contracts");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">📋 Contrato de Rotina</h2>
        <p className="text-sm text-muted-foreground">
          Defina e documente as rotinas operacionais de cada colaborador
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="config">Formulário</TabsTrigger>
          <TabsTrigger value="responses">Respostas</TabsTrigger>
          {isAdmin && <TabsTrigger value="ai-adjust">Ajuste IA</TabsTrigger>}
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <RoutineOverview projectId={projectId} />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <RoutineFormConfig projectId={projectId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="responses" className="mt-6">
          <RoutineResponses
            projectId={projectId}
            isAdmin={isAdmin}
            onGenerateContract={handleGenerateFromResponse}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="ai-adjust" className="mt-6">
            <RoutineAIAdjust
              projectId={projectId}
              selectedResponseId={selectedResponseId}
              onContractCreated={handleViewContract}
            />
          </TabsContent>
        )}

        <TabsContent value="contracts" className="mt-6">
          <RoutineContractsList
            projectId={projectId}
            isAdmin={isAdmin}
            selectedContractId={selectedContractId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
