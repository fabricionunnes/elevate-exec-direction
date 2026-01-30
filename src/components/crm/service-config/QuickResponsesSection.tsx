import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  Search,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

interface QuickResponse {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  category: string | null;
  is_active: boolean;
}

interface QuickResponsesSectionProps {
  onBack: () => void;
}

export const QuickResponsesSection = ({ onBack }: QuickResponsesSectionProps) => {
  const [responses, setResponses] = useState<QuickResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showDialog, setShowDialog] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<QuickResponse | null>(null);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("crm_quick_responses")
        .select("*")
        .order("sort_order");
      setResponses(data || []);
    } catch (error) {
      console.error("Error loading responses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Preencha o título e conteúdo");
      return;
    }

    setSaving(true);
    try {
      if (selectedResponse) {
        const { error } = await supabase
          .from("crm_quick_responses")
          .update({
            title: title.trim(),
            content: content.trim(),
            shortcut: shortcut.trim() || null,
          })
          .eq("id", selectedResponse.id);
        if (error) throw error;
        toast.success("Resposta atualizada");
      } else {
        const { error } = await supabase
          .from("crm_quick_responses")
          .insert({
            title: title.trim(),
            content: content.trim(),
            shortcut: shortcut.trim() || null,
            sort_order: responses.length,
          });
        if (error) throw error;
        toast.success("Resposta criada");
      }
      
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (response: QuickResponse) => {
    if (!confirm("Excluir esta resposta rápida?")) return;
    
    try {
      const { error } = await supabase
        .from("crm_quick_responses")
        .delete()
        .eq("id", response.id);
      if (error) throw error;
      toast.success("Resposta excluída");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    }
  };

  const openEdit = (response: QuickResponse) => {
    setSelectedResponse(response);
    setTitle(response.title);
    setContent(response.content);
    setShortcut(response.shortcut || "");
    setShowDialog(true);
  };

  const resetForm = () => {
    setSelectedResponse(null);
    setTitle("");
    setContent("");
    setShortcut("");
  };

  const filtered = responses.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={onBack} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Configurações
        </button>
        <span>/</span>
        <span className="text-foreground">Respostas rápidas</span>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Respostas rápidas</h2>
        <p className="text-sm text-muted-foreground">
          Ajuste as respostas mais usadas pelo seu time
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova resposta
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>TÍTULO</TableHead>
            <TableHead>ATALHO</TableHead>
            <TableHead>PRÉVIA</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((response) => (
            <TableRow key={response.id}>
              <TableCell className="font-medium">{response.title}</TableCell>
              <TableCell>
                {response.shortcut && (
                  <code className="px-2 py-1 bg-muted rounded text-xs">
                    /{response.shortcut}
                  </code>
                )}
              </TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground">
                {response.content}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(response)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(response)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhuma resposta rápida cadastrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); resetForm(); } else setShowDialog(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedResponse ? "Editar resposta" : "Nova resposta rápida"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Boas-vindas, Horário de funcionamento..."
              />
            </div>
            <div className="space-y-2">
              <Label>Atalho (opcional)</Label>
              <Input
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="Ex: ola, horario"
              />
              <p className="text-xs text-muted-foreground">
                Digite /{shortcut || "atalho"} para usar rapidamente
              </p>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo da mensagem</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Digite o conteúdo da resposta..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
