import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileEdit, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface EditableEmployeeClause {
  id: string;
  title: string;
  content: string;
  originalContent: string;
  isDynamic?: boolean;
}

interface EmployeeClausesEditorProps {
  clauses: EditableEmployeeClause[];
  onChange: (clauses: EditableEmployeeClause[]) => void;
}

export default function EmployeeClausesEditor({ clauses, onChange }: EmployeeClausesEditorProps) {
  // The "objeto" clause starts open by default since it's the dynamic one
  const [openClauses, setOpenClauses] = useState<Record<string, boolean>>({ objeto: true, pagamento: true });

  const toggleClause = (id: string) => {
    setOpenClauses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateClause = (id: string, newContent: string) => {
    onChange(
      clauses.map((c) => (c.id === id ? { ...c, content: newContent } : c))
    );
  };

  const resetClause = (id: string) => {
    onChange(
      clauses.map((c) => (c.id === id ? { ...c, content: c.originalContent } : c))
    );
  };

  const resetAll = () => {
    onChange(clauses.map((c) => ({ ...c, content: c.originalContent })));
  };

  const hasChanges = clauses.some((c) => c.content !== c.originalContent);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileEdit className="h-5 w-5" />
            Cláusulas do Contrato
          </CardTitle>
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Restaurar Todas
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          A Cláusula Primeira muda automaticamente conforme o cargo. Todas são editáveis.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {clauses.map((clause) => {
          const isOpen = openClauses[clause.id] || false;
          const isModified = clause.content !== clause.originalContent;

          return (
            <Collapsible key={clause.id} open={isOpen} onOpenChange={() => toggleClause(clause.id)}>
              <CollapsibleTrigger asChild>
                <div
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    isOpen ? "bg-primary/10 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium text-sm">{clause.title}</span>
                    {isModified && (
                      <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-xs">
                        Editado
                      </Badge>
                    )}
                    {clause.isDynamic && (
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-700 border-blue-500/30 text-xs">
                        Dinâmica por Cargo
                      </Badge>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4 px-3">
                <div className="space-y-2">
                  {clause.isDynamic && (
                    <p className="text-xs text-muted-foreground italic">
                      Esta cláusula é preenchida automaticamente com base no cargo selecionado. Você pode editar livremente.
                    </p>
                  )}
                  <Textarea
                    value={clause.content}
                    onChange={(e) => updateClause(clause.id, e.target.value)}
                    rows={clause.isDynamic ? 16 : 8}
                    className="font-mono text-sm"
                  />
                  {isModified && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => resetClause(clause.id)}>
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
      </CardContent>
    </Card>
  );
}
