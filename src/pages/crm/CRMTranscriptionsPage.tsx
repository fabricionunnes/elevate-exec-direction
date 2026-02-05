import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Search, Settings, Plus, Mic, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useCrmTranscriptions } from "@/hooks/useCrmTranscriptions";
import { TranscriptionsList, RealtimeTranscription } from "@/components/crm/transcriptions";
import { useCRMContext } from "./CRMLayout";

export const CRMTranscriptionsPage = () => {
  const { isAdmin, isMaster } = useCRMContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newRecordingOpen, setNewRecordingOpen] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const { transcriptions, loading, refetch, deleteTranscription } = useCrmTranscriptions();
  
  const canDelete = isAdmin || isMaster;

  // Webhook URL for Tactiq integration
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tactiq-webhook`;

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast.success("URL do webhook copiada!");
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  // Filter transcriptions based on search and tab
  const filteredTranscriptions = transcriptions.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transcription_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    return matchesSearch && t.source === activeTab;
  });

  const transcriptionCounts = {
    all: transcriptions.length,
    tactiq: transcriptions.filter((t) => t.source === "tactiq").length,
    elevenlabs: transcriptions.filter((t) => t.source === "elevenlabs").length,
    manual: transcriptions.filter((t) => t.source === "manual").length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Transcrições
          </h1>
          <p className="text-muted-foreground">
            Gerencie transcrições de reuniões do CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Tactiq
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Integração com Tactiq</DialogTitle>
                <DialogDescription>
                  Configure o Zapier para enviar transcrições do Tactiq automaticamente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Crie um Zap no Zapier</h4>
                  <p className="text-sm text-muted-foreground">
                    Use o trigger "New Transcript" do Tactiq e a action "Webhooks by Zapier" (POST).
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Configure o Webhook URL</h4>
                  <div className="flex items-center gap-2">
                    <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={handleCopyWebhook}>
                      {copiedWebhook ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">3. Mapeie os campos do Tactiq</h4>
                  <div className="bg-muted/50 p-3 rounded-md text-sm font-mono space-y-1">
                    <p><span className="text-primary">transcript</span>: Transcript Text</p>
                    <p><span className="text-primary">meeting_title</span>: Meeting Title</p>
                    <p><span className="text-primary">meeting_url</span>: Meeting URL</p>
                    <p><span className="text-primary">summary</span>: Summary (opcional)</p>
                    <p><span className="text-primary">duration</span>: Duration (opcional)</p>
                  </div>
                </div>
                <div className="bg-primary/10 border border-primary/20 p-3 rounded-md">
                  <p className="text-sm text-primary">
                    <strong>Dica:</strong> Para vincular automaticamente a leads, adicione o campo <code>lead_id</code> ou use a mesma URL de reunião cadastrada no CRM.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open("https://zapier.com/apps/tactiq/integrations", "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Zapier + Tactiq
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={newRecordingOpen} onOpenChange={setNewRecordingOpen}>
            <DialogTrigger asChild>
              <Button>
                <Mic className="h-4 w-4 mr-2" />
                Nova Gravação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Gravar Reunião</DialogTitle>
                <DialogDescription>
                  Grave e transcreva reuniões diretamente no CRM
                </DialogDescription>
              </DialogHeader>
              <RealtimeTranscription
                onTranscriptionSaved={() => {
                  setNewRecordingOpen(false);
                  refetch();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar transcrições..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            Todas
            <Badge variant="secondary" className="ml-1">{transcriptionCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tactiq" className="gap-2">
            Tactiq
            <Badge variant="secondary" className="ml-1">{transcriptionCounts.tactiq}</Badge>
          </TabsTrigger>
          <TabsTrigger value="elevenlabs" className="gap-2">
            Gravações
            <Badge variant="secondary" className="ml-1">{transcriptionCounts.elevenlabs}</Badge>
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            Manuais
            <Badge variant="secondary" className="ml-1">{transcriptionCounts.manual}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <TranscriptionsList
            transcriptions={filteredTranscriptions}
            loading={loading}
            showLeadLink={true}
            onDelete={deleteTranscription}
            canDelete={canDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
