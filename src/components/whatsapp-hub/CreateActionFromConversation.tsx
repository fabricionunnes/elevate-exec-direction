import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardCheck, Route } from "lucide-react";
import { toast } from "sonner";
import type { HubConversation } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: HubConversation;
  staffId: string;
}

export const CreateActionFromConversation = ({ open, onOpenChange, conversation, staffId }: Props) => {
  const [actionType, setActionType] = useState<"action" | "task">("action");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(
    `Originado da conversa com ${conversation.contact_name || conversation.contact_phone}`
  );
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Digite um título");
      return;
    }

    setSaving(true);
    try {
      if (actionType === "task" && conversation.project_id) {
        // Create task in the project journey
        const { error } = await supabase.from("onboarding_tasks").insert({
          project_id: conversation.project_id,
          name: title.trim(),
          description: `${description}\n\nContato: ${conversation.contact_phone}`,
          status: "pending",
          created_by: staffId,
        });
        if (error) throw error;
        toast.success("Tarefa criada na Jornada!");
      } else {
        // Create commercial action
        if (!conversation.project_id) {
          toast.error("Vincule esta conversa a um projeto primeiro");
          setSaving(false);
          return;
        }
        const { error } = await supabase.from("commercial_actions").insert({
          project_id: conversation.project_id,
          title: title.trim(),
          description: `${description}\n\nContato: ${conversation.contact_phone}`,
          status: "pending",
          created_by: staffId,
        });
        if (error) throw error;
        toast.success("Ação Comercial criada!");
      }

      setTitle("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Criar a partir da Conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as "action" | "task")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4" />
                    Tarefa na Jornada
                  </div>
                </SelectItem>
                <SelectItem value="action">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Ação Comercial
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              placeholder="Ex: Follow-up com cliente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {!conversation.project_id && (
            <p className="text-xs text-amber-600">
              ⚠️ Vincule esta conversa a um projeto para criar ações/tarefas.
            </p>
          )}

          <Button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="w-full"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar {actionType === "task" ? "Tarefa" : "Ação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
