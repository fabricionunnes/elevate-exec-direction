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
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RotateCcw, Save, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { contractClauses, type ContractClause } from "@/data/contractTemplate";

interface TemplateClause {
  id: string;
  title: string;
  content: string;
  originalContent: string;
  isDynamic?: boolean;
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
      const mergedClauses = contractClauses.map((defaultClause) => {
        const saved = savedClausesMap.get(defaultClause.id);
        return {
          id: defaultClause.id,
          title: saved?.title || defaultClause.title,
          content: saved?.content || defaultClause.content,
          originalContent: defaultClause.content,
          isDynamic: saved?.is_dynamic ?? defaultClause.isDynamic,
        };
      });

      setClauses(mergedClauses);
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
          isDynamic: c.isDynamic,
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplateFromDB();
    }
  }, [open]);

  const toggleClause = (id: string) => {
    setOpenClauses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateClause = (id: string, newContent: string) => {
    setClauses(
      clauses.map((clause) =>
        clause.id === id ? { ...clause, content: newContent } : clause
      )
    );
  };

  const resetClause = (id: string) => {
    setClauses(
      clauses.map((clause) =>
        clause.id === id ? { ...clause, content: clause.originalContent } : clause
      )
    );
  };

  const resetAll = () => {
    setClauses(clauses.map((clause) => ({ ...clause, content: clause.originalContent })));
  };

  const hasChanges = clauses.some((c) => c.content !== c.originalContent);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get only modified clauses
      const modifiedClauses = clauses.filter((c) => c.content !== c.originalContent);
      
      if (modifiedClauses.length === 0) {
        toast.info("Nenhuma alteração para salvar");
        onOpenChange(false);
        return;
      }

      // Upsert each modified clause
      for (const clause of modifiedClauses) {
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

      // Remove clauses that were reset to original (no longer customized)
      const resetClauses = clauses.filter((c) => c.content === c.originalContent);
      for (const clause of resetClauses) {
        await supabase
          .from("contract_template_clauses")
          .delete()
          .eq("id", clause.id);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Editar Template Padrão
          </DialogTitle>
          <DialogDescription>
            Edite as cláusulas do contrato padrão. Essas alterações afetarão todos os novos contratos gerados.
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
              const isModified = clause.content !== clause.originalContent;

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
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">{clause.title}</span>
                        {isModified && (
                          <span className="text-xs bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded">
                            Modificado
                          </span>
                        )}
                        {clause.isDynamic && (
                          <span className="text-xs bg-blue-500/20 text-blue-700 px-2 py-0.5 rounded">
                            Dinâmica
                          </span>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 pb-4 px-3">
                    <div className="space-y-2">
                      {clause.isDynamic && (
                        <p className="text-xs text-muted-foreground italic">
                          Esta cláusula inclui conteúdo dinâmico (entregáveis do produto) que será
                          adicionado automaticamente.
                        </p>
                      )}
                      <Textarea
                        value={clause.content}
                        onChange={(e) => updateClause(clause.id, e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                      {isModified && (
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
