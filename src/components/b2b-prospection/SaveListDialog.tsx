import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import type { B2BLead } from "@/types/b2bProspection";

interface SaveListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: B2BLead[];
  onSave: (name: string, leads: B2BLead[], description?: string) => Promise<any>;
}

export function SaveListDialog({ open, onOpenChange, leads, onSave }: SaveListDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), leads, description.trim() || undefined);
    setSaving(false);
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar Lista</DialogTitle>
          <DialogDescription>
            Salve {leads.length} leads em uma lista para acesso posterior
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Lista</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ex: "Dentistas SP Zona Sul"'
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Observações sobre esta lista..."
            />
          </div>
          <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : `Salvar ${leads.length} leads`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
