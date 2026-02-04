import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, FileText, Copy, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface LeadTranscriptionTabProps {
  leadId: string;
  leadName: string;
  companyName: string | null;
  onBriefingGenerated: () => void;
}

export const LeadTranscriptionTab = ({
  leadId,
  leadName,
  companyName,
  onBriefingGenerated,
}: LeadTranscriptionTabProps) => {
  const [transcription, setTranscription] = useState("");
  const [generatedBriefing, setGeneratedBriefing] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateBriefing = async () => {
    if (!transcription.trim()) {
      toast.error("Cole a transcrição da reunião primeiro");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-crm-briefing", {
        body: {
          transcription: transcription.trim(),
          leadName,
          companyName,
        },
      });

      if (error) throw error;

      if (data?.briefing) {
        setGeneratedBriefing(data.briefing);
        toast.success("Briefing gerado com sucesso!");
      } else {
        throw new Error("Briefing não retornado");
      }
    } catch (error) {
      console.error("Error generating briefing:", error);
      toast.error("Erro ao gerar briefing. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveBriefing = async () => {
    if (!generatedBriefing.trim()) {
      toast.error("Gere o briefing primeiro");
      return;
    }

    setIsSaving(true);
    try {
      // Find the briefing field in crm_custom_fields
      const { data: briefingField, error: fieldError } = await supabase
        .from("crm_custom_fields")
        .select("id")
        .eq("field_name", "briefing")
        .eq("context", "deal")
        .single();

      if (fieldError || !briefingField) {
        // Field doesn't exist, try updating the notes field directly on the lead
        const { error: updateError } = await supabase
          .from("crm_leads")
          .update({ notes: generatedBriefing.trim() })
          .eq("id", leadId);

        if (updateError) throw updateError;
      } else {
        // Save to custom field
        const { error: upsertError } = await supabase
          .from("crm_custom_field_values")
          .upsert(
            {
              lead_id: leadId,
              field_id: briefingField.id,
              value: generatedBriefing.trim(),
            },
            {
              onConflict: "lead_id,field_id",
            }
          );

        if (upsertError) throw upsertError;
      }

      toast.success("Briefing salvo no negócio!");
      onBriefingGenerated();
      
      // Clear the form after successful save
      setTranscription("");
      setGeneratedBriefing("");
    } catch (error) {
      console.error("Error saving briefing:", error);
      toast.error("Erro ao salvar briefing");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyBriefing = async () => {
    try {
      await navigator.clipboard.writeText(generatedBriefing);
      setCopied(true);
      toast.success("Briefing copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Transcrição da Reunião
          </CardTitle>
          <CardDescription>
            Cole a transcrição completa da reunião para gerar um briefing automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transcription">Transcrição</Label>
            <Textarea
              id="transcription"
              placeholder="Cole aqui a transcrição da reunião..."
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              className="min-h-[200px] resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {transcription.length > 0 
                ? `${transcription.split(/\s+/).filter(Boolean).length} palavras` 
                : "Dica: Você pode usar ferramentas como Otter.ai, Google Meet ou Zoom para gerar transcrições automáticas"}
            </p>
          </div>

          <Button
            onClick={handleGenerateBriefing}
            disabled={isGenerating || !transcription.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando briefing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Briefing com IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Briefing Section */}
      {generatedBriefing && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Briefing Gerado
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyBriefing}
                className="h-8"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <CardDescription>
              Revise o briefing antes de salvar no campo de negócio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={generatedBriefing}
                onChange={(e) => setGeneratedBriefing(e.target.value)}
                className="min-h-[250px] resize-none"
              />
            </div>

            <Button
              onClick={handleSaveBriefing}
              disabled={isSaving}
              className="w-full"
              variant="default"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Salvar no Briefing do Negócio
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
