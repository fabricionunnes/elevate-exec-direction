import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnvelopeCreator } from "@/components/signatures/EnvelopeCreator";
import { EnvelopesList } from "@/components/signatures/EnvelopesList";
import { EnvelopeDetail } from "@/components/signatures/EnvelopeDetail";
import { FileSignature, List, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignaturesAdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("lista");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreated = (envelopeId: string) => {
    setRefreshTrigger(p => p + 1);
    setSelectedEnvelopeId(envelopeId);
    setActiveTab("detalhe");
  };

  const handleViewDetail = (envelopeId: string) => {
    setSelectedEnvelopeId(envelopeId);
    setActiveTab("detalhe");
  };

  const handleBackToList = () => {
    setSelectedEnvelopeId(null);
    setActiveTab("lista");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <FileSignature className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Assinaturas Eletrônicas</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie envelopes de assinatura — MP 2.200-2/2001 e Lei 14.063/2020</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="lista" className="flex items-center gap-1.5">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="novo" className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Novo Documento
          </TabsTrigger>
          <TabsTrigger value="detalhe" disabled={!selectedEnvelopeId} className="flex items-center gap-1.5">
            <FileSignature className="h-4 w-4" />
            Detalhe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <EnvelopesList onViewDetail={handleViewDetail} refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="novo">
          <EnvelopeCreator onCreated={handleCreated} />
        </TabsContent>

        <TabsContent value="detalhe">
          {selectedEnvelopeId && (
            <EnvelopeDetail envelopeId={selectedEnvelopeId} onBack={handleBackToList} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
