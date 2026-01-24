import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileEdit, RotateCcw } from "lucide-react";
import { contractClauses, type ContractClause } from "@/data/contractTemplate";

export interface EditableClause {
  id: string;
  title: string;
  content: string;
  originalContent: string;
  isDynamic?: boolean;
}

interface ClausesEditorProps {
  clauses: EditableClause[];
  onChange: (clauses: EditableClause[]) => void;
}

export function getDefaultEditableClauses(): EditableClause[] {
  return contractClauses.map((clause) => ({
    id: clause.id,
    title: clause.title,
    content: clause.content,
    originalContent: clause.content,
    isDynamic: clause.isDynamic,
  }));
}

export default function ClausesEditor({ clauses, onChange }: ClausesEditorProps) {
  const [openClauses, setOpenClauses] = useState<Record<string, boolean>>({});

  const toggleClause = (id: string) => {
    setOpenClauses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateClause = (id: string, newContent: string) => {
    onChange(
      clauses.map((clause) =>
        clause.id === id ? { ...clause, content: newContent } : clause
      )
    );
  };

  const resetClause = (id: string) => {
    onChange(
      clauses.map((clause) =>
        clause.id === id ? { ...clause, content: clause.originalContent } : clause
      )
    );
  };

  const resetAll = () => {
    onChange(clauses.map((clause) => ({ ...clause, content: clause.originalContent })));
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
          Clique em cada cláusula para editar o texto antes de gerar o PDF.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
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
                        Editado
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
      </CardContent>
    </Card>
  );
}
