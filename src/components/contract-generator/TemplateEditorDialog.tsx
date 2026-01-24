import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RotateCcw, Save, Loader2, Settings, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { contractClauses, type ContractClause } from "@/data/contractTemplate";

interface TemplateClause {
  id: string;
  title: string;
  content: string;
  originalContent: string;
  originalTitle: string;
  isDynamic?: boolean;
  isNew?: boolean; // Track if this is a newly added clause
}

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export default function TemplateEditorDialog({ open, onOpenChange, onSave }: TemplateEditorDialogProps) {
  const [clauses, setClauses] = useState<TemplateClause[]>([]);
  const [openClauses, setOpenClauses] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newClauseTitle, setNewClauseTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Load saved template clauses from database
  const loadTemplateFromDB = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("contract_template_clauses")
        .select("*");

      if (error) throw error;

      // Create a map of saved clauses
      const savedClausesMap = new Map(data?.map((c) => [c.id, c]) || []);

      // Merge default clauses with saved ones
      const mergedClauses: TemplateClause[] = contractClauses.map((defaultClause) => {
        const saved = savedClausesMap.get(defaultClause.id);
        return {
          id: defaultClause.id,
          title: saved?.title || defaultClause.title,
          content: saved?.content || defaultClause.content,
          originalContent: defaultClause.content,
          originalTitle: defaultClause.title,
          isDynamic: saved?.is_dynamic ?? defaultClause.isDynamic,
          isNew: false,
        };
      });

      // Add any custom clauses that aren't in defaults
      const defaultIds = new Set(contractClauses.map(c => c.id));
      const customClauses = (data || [])
        .filter(c => !defaultIds.has(c.id))
        .map(c => ({
          id: c.id,
          title: c.title,
          content: c.content,
          originalContent: c.content,
          originalTitle: c.title,
          isDynamic: c.is_dynamic || false,
          isNew: false,
        }));

      setClauses([...mergedClauses, ...customClauses]);
    } catch (error) {
      console.error("Erro ao carregar template:", error);
      toast.error("Erro ao carregar template do contrato");
      // Fallback to default clauses
      setClauses(
        contractClauses.map((c) => ({
          id: c.id,
          title: c.title,
          content: c.content,
          originalContent: c.content,
          originalTitle: c.title,
          isDynamic: c.isDynamic,
          isNew: false,
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplateFromDB();
      setShowAddForm(false);
      setNewClauseTitle("");
    }
  }, [open]);

  const toggleClause = (id: string) => {
    setOpenClauses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateClauseContent = (id: string, newContent: string) => {
    setClauses(
      clauses.map((clause) =>
        clause.id === id ? { ...clause, content: newContent } : clause
      )
    );
  };

  const updateClauseTitle = (id: string, newTitle: string) => {
    setClauses(
      clauses.map((clause) =>
        clause.id === id ? { ...clause, title: newTitle } : clause
      )
    );
  };

  const resetClause = (id: string) => {
    setClauses(
      clauses.map((clause) =>
        clause.id === id 
          ? { ...clause, content: clause.originalContent, title: clause.originalTitle } 
          : clause
      )
    );
  };

  const resetAll = () => {
    // Reset default clauses and remove custom ones
    const defaultIds = new Set(contractClauses.map(c => c.id));
    setClauses(
      clauses
        .filter(c => defaultIds.has(c.id))
        .map((clause) => ({ 
          ...clause, 
          content: clause.originalContent,
          title: clause.originalTitle,
        }))
    );
  };

  const addNewClause = () => {
    if (!newClauseTitle.trim()) {
      toast.error("Digite um título para a nova cláusula");
      return;
    }

    const clauseNumber = clauses.length + 1;
    const newId = `custom_${Date.now()}`;
    const formattedTitle = newClauseTitle.toUpperCase().startsWith("CLÁUSULA") 
      ? newClauseTitle 
      : `CLÁUSULA ${clauseNumber}ª - ${newClauseTitle.toUpperCase()}`;

    const newClause: TemplateClause = {
      id: newId,
      title: formattedTitle,
      content: "Digite o conteúdo da cláusula aqui...",
      originalContent: "",
      originalTitle: "",
      isDynamic: false,
      isNew: true,
    };

    setClauses([...clauses, newClause]);
    setOpenClauses((prev) => ({ ...prev, [newId]: true }));
    setNewClauseTitle("");
    setShowAddForm(false);
    toast.success("Nova cláusula adicionada");
  };

  const deleteClause = (id: string) => {
    // Only allow deleting custom clauses
    const defaultIds = new Set(contractClauses.map(c => c.id));
    if (defaultIds.has(id)) {
      toast.error("Não é possível excluir cláusulas padrão");
      return;
    }

    setClauses(clauses.filter(c => c.id !== id));
    toast.success("Cláusula removida");
  };

  const hasChanges = clauses.some(
    (c) => c.content !== c.originalContent || c.title !== c.originalTitle || c.isNew
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get clauses that need to be saved (modified or new)
      const clausesToSave = clauses.filter(
        (c) => c.content !== c.originalContent || c.title !== c.originalTitle || c.isNew
      );

      if (clausesToSave.length === 0) {
        toast.info("Nenhuma alteração para salvar");
        onOpenChange(false);
        return;
      }

      // Upsert each modified/new clause
      for (const clause of clausesToSave) {
        const { error } = await supabase
          .from("contract_template_clauses")
          .upsert({
            id: clause.id,
            title: clause.title,
            content: clause.content,
            is_dynamic: clause.isDynamic || false,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Remove clauses that were reset to original and are default clauses
      const defaultIds = new Set(contractClauses.map(c => c.id));
      const resetClauses = clauses.filter(
        (c) => defaultIds.has(c.id) && c.content === c.originalContent && c.title === c.originalTitle
      );
      for (const clause of resetClauses) {
        await supabase
          .from("contract_template_clauses")
          .delete()
          .eq("id", clause.id);
      }

      // Delete removed custom clauses from DB
      const currentIds = new Set(clauses.map(c => c.id));
      const { data: dbClauses } = await supabase
        .from("contract_template_clauses")
        .select("id");
      
      for (const dbClause of dbClauses || []) {
        if (!currentIds.has(dbClause.id) && !defaultIds.has(dbClause.id)) {
          await supabase
            .from("contract_template_clauses")
            .delete()
            .eq("id", dbClause.id);
        }
      }

      toast.success("Template salvo com sucesso!");
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template. Verifique suas permissões.");
    } finally {
      setIsSaving(false);
    }
  };

  const defaultIds = new Set(contractClauses.map(c => c.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Editar Template Padrão
          </DialogTitle>
          <DialogDescription>
            Edite títulos e conteúdos das cláusulas ou adicione novas. Alterações afetam todos os novos contratos.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2 py-4">
            {clauses.map((clause) => {
              const isOpen = openClauses[clause.id] || false;
              const isModified = clause.content !== clause.originalContent || clause.title !== clause.originalTitle;
              const isCustom = !defaultIds.has(clause.id);

              return (
                <Collapsible
                  key={clause.id}
                  open={isOpen}
                  onOpenChange={() => toggleClause(clause.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        isOpen
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">{clause.title}</span>
                        {isModified && (
                          <span className="text-xs bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded flex-shrink-0">
                            Modificado
                          </span>
                        )}
                        {clause.isDynamic && (
                          <span className="text-xs bg-blue-500/20 text-blue-700 px-2 py-0.5 rounded flex-shrink-0">
                            Dinâmica
                          </span>
                        )}
                        {isCustom && (
                          <span className="text-xs bg-green-500/20 text-green-700 px-2 py-0.5 rounded flex-shrink-0">
                            Personalizada
                          </span>
                        )}
                      </div>
                      {isCustom && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClause(clause.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 pb-4 px-3">
                    <div className="space-y-3">
                      {/* Title Editor */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Título da Cláusula</Label>
                        <Input
                          value={clause.title}
                          onChange={(e) => updateClauseTitle(clause.id, e.target.value)}
                          className="font-medium"
                        />
                      </div>

                      {/* Content Editor */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Conteúdo</Label>
                        {clause.isDynamic && (
                          <p className="text-xs text-muted-foreground italic">
                            Esta cláusula inclui conteúdo dinâmico (entregáveis do produto) que será
                            adicionado automaticamente.
                          </p>
                        )}
                        <Textarea
                          value={clause.content}
                          onChange={(e) => updateClauseContent(clause.id, e.target.value)}
                          rows={8}
                          className="font-mono text-sm"
                        />
                      </div>

                      {isModified && !isCustom && (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetClause(clause.id)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restaurar Original
                          </Button>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {/* Add New Clause Section */}
            {showAddForm ? (
              <div className="border border-dashed border-primary/50 rounded-lg p-4 space-y-3 bg-primary/5">
                <Label>Título da Nova Cláusula</Label>
                <Input
                  placeholder="Ex: CONFIDENCIALIDADE ADICIONAL"
                  value={newClauseTitle}
                  onChange={(e) => setNewClauseTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNewClause();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button onClick={addNewClause} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Nova Cláusula
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasChanges && (
            <Button variant="ghost" onClick={resetAll} disabled={isSaving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Todas
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Template
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
