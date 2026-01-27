import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { Flag, Loader2 } from "lucide-react";

interface ReportContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: "post" | "comment" | "listing" | "story" | "profile";
  contentId: string;
  reportedProfileId?: string;
}

const reportReasons = [
  { value: "spam", label: "Spam ou links suspeitos" },
  { value: "harassment", label: "Assédio ou bullying" },
  { value: "inappropriate", label: "Conteúdo inapropriado" },
  { value: "fraud", label: "Fraude ou golpe" },
  { value: "other", label: "Outro motivo" },
];

export function ReportContentDialog({
  open,
  onOpenChange,
  contentType,
  contentId,
  reportedProfileId,
}: ReportContentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useCircleCurrentProfile();
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Not authenticated");
      if (!reason) throw new Error("Selecione um motivo");

      const { error } = await supabase.from("circle_reports").insert({
        reporter_profile_id: profile.id,
        reported_profile_id: reportedProfileId || null,
        content_type: contentType,
        content_id: contentId,
        reason,
        description: description.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Denúncia enviada",
        description: "Obrigado por ajudar a manter a comunidade segura.",
      });
      onOpenChange(false);
      setReason("");
      setDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar denúncia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const contentTypeLabels: Record<string, string> = {
    post: "publicação",
    comment: "comentário",
    listing: "anúncio",
    story: "story",
    profile: "perfil",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Denunciar {contentTypeLabels[contentType]}
          </DialogTitle>
          <DialogDescription>
            Sua denúncia será analisada pela nossa equipe de moderação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Motivo da denúncia *</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reportReasons.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Detalhes adicionais (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema com mais detalhes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => reportMutation.mutate()}
            disabled={!reason || reportMutation.isPending}
            variant="destructive"
          >
            {reportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Denúncia"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
