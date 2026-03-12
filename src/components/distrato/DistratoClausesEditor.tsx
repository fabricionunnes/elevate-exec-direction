import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RotateCcw, Plus, Trash2, FileEdit, ArrowUp, ArrowDown } from "lucide-react";
import { distratoClauses, type DistratoClause } from "@/data/distratoTemplate";

export interface EditableDistratoClause {
  id: string;
  title: string;
  content: string;
  originalContent: string;
  isDynamic?: boolean;
  isCustom?: boolean;
}

interface DistratoClausesEditorProps {
  clauses: EditableDistratoClause[];
  onChange: (clauses: EditableDistratoClause[]) => void;
}

export function getDefaultDistratoClauses(): EditableDistratoClause[] {
  return distratoClauses.map((c) => ({
    id: c.id,
    title: c.title,
    content: c.content,
    originalContent: c.content,
    isDynamic: c.isDynamic,
  }));
}

export default function DistratoClausesEditor({ clauses, onChange }: DistratoClausesEditorProps) {
  const [openClauses, setOpenClauses] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(openClauses);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenClauses(next);
  };

  const updateClause = (id: string, field: "title" | "content", value: string) => {
    onChange(clauses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const resetClause = (id: string) => {
    onChange(clauses.map((c) => (c.id === id ? { ...c, content: c.originalContent } : c)));
  };

  const moveClause = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= clauses.length) return;
    const updated = [...clauses];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const addCustomClause = () => {
    const nextNum = clauses.length + 1;
    const newClause: EditableDistratoClause = {
      id: `custom_${Date.now()}`,
      title: `CLÁUSULA ${nextNum} – CLÁUSULA ADICIONAL`,
      content: "",
      originalContent: "",
      isCustom: true,
    };
    onChange([...clauses, newClause]);
    setOpenClauses(new Set([...openClauses, newClause.id]));
  };

  const removeClause = (id: string) => {
    onChange(clauses.filter((c) => c.id !== id));
  };

  const isModified = (c: EditableDistratoClause) => c.content !== c.originalContent;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileEdit className="h-4 w-4" /> Cláusulas do Distrato
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addCustomClause} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar Cláusula
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {clauses.map((clause, index) => (
          <Collapsible key={clause.id} open={openClauses.has(clause.id)}>
            <div className="flex items-center gap-1">
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === 0}
                  onClick={() => moveClause(index, "up")}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === clauses.length - 1}
                  onClick={() => moveClause(index, "down")}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <CollapsibleTrigger asChild>
                <button
                  onClick={() => toggle(clause.id)}
                  className={cn(
                    "flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors",
                    isModified(clause) && "border-l-2 border-primary"
                  )}
                >
                  {openClauses.has(clause.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium flex-1">{clause.title}</span>
                  {isModified(clause) && <span className="text-xs text-primary">(editado)</span>}
                  {clause.isCustom && <span className="text-xs text-amber-600">(personalizado)</span>}
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="pl-10 pr-3 pb-3 pt-1 space-y-2">
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={clause.title}
                  onChange={(e) => updateClause(clause.id, "title", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Conteúdo</Label>
                <Textarea
                  value={clause.content}
                  onChange={(e) => updateClause(clause.id, "content", e.target.value)}
                  rows={5}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2">
                {!clause.isCustom && isModified(clause) && (
                  <Button variant="ghost" size="sm" onClick={() => resetClause(clause.id)} className="gap-1 text-xs">
                    <RotateCcw className="h-3 w-3" /> Restaurar Original
                  </Button>
                )}
                {clause.isCustom && (
                  <Button variant="ghost" size="sm" onClick={() => removeClause(clause.id)} className="gap-1 text-xs text-destructive">
                    <Trash2 className="h-3 w-3" /> Remover
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
