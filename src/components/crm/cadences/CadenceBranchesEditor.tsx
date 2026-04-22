import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GitBranch } from "lucide-react";

export interface Branch {
  operator: "contains" | "equals" | "starts_with" | "any";
  keywords?: string[];
  goto: number | "complete"; // sort_order do step alvo, ou "complete" para encerrar
}

interface Props {
  branches: Branch[];
  onChange: (b: Branch[]) => void;
  totalSteps: number;
  currentSortOrder: number;
}

export function CadenceBranchesEditor({ branches, onChange, totalSteps, currentSortOrder }: Props) {
  const update = (idx: number, patch: Partial<Branch>) => {
    onChange(branches.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };
  const add = () => onChange([...branches, { operator: "contains", keywords: [], goto: "complete" }]);
  const remove = (idx: number) => onChange(branches.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2 border-l-2 border-primary/30 pl-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <Label className="text-xs font-medium">Ramificações condicionais (avaliam a última resposta do lead)</Label>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={add}>
          <Plus className="h-3 w-3 mr-1" />Regra
        </Button>
      </div>

      {branches.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Sem regras: a cadência segue a ordem normal. Adicione regras para desviar quando o lead responder algo específico.
        </p>
      )}

      {branches.map((b, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 bg-muted/20 rounded">
          <div className="col-span-3">
            <Label className="text-xs">Se a resposta</Label>
            <Select value={b.operator} onValueChange={(v: any) => update(idx, { operator: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="equals">É igual a</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
                <SelectItem value="any">Qualquer resposta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {b.operator !== "any" && (
            <div className="col-span-5">
              <Label className="text-xs">Palavras (separadas por vírgula)</Label>
              <Input
                className="h-8"
                value={(b.keywords || []).join(", ")}
                onChange={(e) => update(idx, { keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
                placeholder="sim, quero, agora"
              />
            </div>
          )}
          <div className={b.operator === "any" ? "col-span-7" : "col-span-3"}>
            <Label className="text-xs">Então pular para</Label>
            <Select value={String(b.goto)} onValueChange={(v) => update(idx, { goto: v === "complete" ? "complete" : parseInt(v) })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="complete">Encerrar cadência</SelectItem>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  i !== currentSortOrder && (
                    <SelectItem key={i} value={String(i)}>Mensagem #{i + 1}</SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(idx)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
