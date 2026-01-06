import { useState, forwardRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

interface AnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
}

export const AnnouncementDialog = forwardRef<HTMLDivElement, AnnouncementDialogProps>(({
  open,
  onOpenChange,
  staffId,
}, ref) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState<"cs" | "consultant" | "all">("all");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha o título e a mensagem");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from("onboarding_announcements")
        .insert({
          title: title.trim(),
          message: message.trim(),
          target_role: targetRole,
          created_by: staffId,
        });

      if (error) throw error;

      toast.success("Comunicado enviado com sucesso!");
      setTitle("");
      setMessage("");
      setTargetRole("all");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending announcement:", error);
      toast.error(error.message || "Erro ao enviar comunicado");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar Comunicado
          </DialogTitle>
          <DialogDescription>
            Envie um aviso para toda a equipe. Eles receberão imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="target">Destinatários</Label>
            <Select value={targetRole} onValueChange={(v) => setTargetRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (CS + Consultores)</SelectItem>
                <SelectItem value="cs">Apenas CS</SelectItem>
                <SelectItem value="consultant">Apenas Consultores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião importante amanhã"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite o conteúdo do comunicado..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/1000
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

AnnouncementDialog.displayName = "AnnouncementDialog";
