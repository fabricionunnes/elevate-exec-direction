import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

interface GeneratePlaybookButtonProps {
  projectId: string;
  churnPredictionId?: string;
  onSuccess?: () => void;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export const GeneratePlaybookButton = ({
  projectId,
  churnPredictionId,
  onSuccess,
  size = "sm",
  variant = "outline",
}: GeneratePlaybookButtonProps) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-rescue-playbook", {
        body: { projectId, churnPredictionId },
      });

      if (error) throw error;
      
      toast.success(`Playbook gerado! ${data.tasksCreated} tarefas criadas.`);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error generating playbook:", error);
      toast.error(error.message || "Erro ao gerar playbook");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleGenerate}
      disabled={generating}
    >
      {generating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <Shield className="h-4 w-4 mr-2" />
          Gerar Playbook
        </>
      )}
    </Button>
  );
};
