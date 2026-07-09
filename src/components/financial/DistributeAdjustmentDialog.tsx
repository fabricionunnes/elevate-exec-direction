import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";

export type DistributeKind = "payable" | "receivable";

export interface AdjustmentRow {
  id: string;
  description: string;
  amount: number;
}

export interface ExistingAccount {
  id: string;
  description: string;
  amount: number;
  party: string | null;
  due_date?: string | null;
  paid?: number;
}

const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface NewLine {
  key: string;
  description: string;
  amount: number;
  category_id: string;
  party: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: DistributeKind;
  adjustment: AdjustmentRow | null;
  categories: { id: string; name: string; color?: string }[];
  existingAccounts: ExistingAccount[];
  onDone: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

let keySeq = 0;
const newLine = (): NewLine => ({
  key: `l${++keySeq}`,
  description: "",
  amount: 0,
  category_id: "",
  party: "",
});

export function DistributeAdjustmentDialog({
  open,
  onOpenChange,
  kind,
  adjustment,
  categories,
  existingAccounts,
  onDone,
}: Props) {
  const [lines, setLines] = useState<NewLine[]>([newLine()]);
  const [pickedAmounts, setPickedAmounts] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(currentMonthStr());
  const [includeOverdue, setIncludeOverdue] = useState(true);

  const filteredExisting = useMemo(() => {
    const q = existingSearch.trim().toLowerCase();
    const today = todayStr();
    return existingAccounts.filter((a) => {
      const matchesText = !q || (a.description || "").toLowerCase().includes(q) || (a.party || "").toLowerCase().includes(q);
      if (!matchesText) return false;
      // Buscando: procura em TODOS os meses (ignora filtro de mês/atrasadas).
      if (q) return true;
      const due = a.due_date || "";
      const inMonth = !!due && due.slice(0, 7) === monthFilter;
      const overdue = includeOverdue && !!due && due < today;
      return inMonth || overdue;
    });
  }, [existingAccounts, existingSearch, monthFilter, includeOverdue]);

  const partyLabel = kind === "payable" ? "Fornecedor" : "Recebedor";
  const total = adjustment?.amount || 0;

  const openOf = (a: ExistingAccount) => Math.round((Number(a.amount || 0) - Number(a.paid || 0)) * 100) / 100;

  const existingSum = useMemo(
    () => Array.from(pickedAmounts.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0),
    [pickedAmounts]
  );
  const newSum = useMemo(
    () => lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0),
    [lines]
  );
  const allocated = Math.round((existingSum + newSum) * 100) / 100;
  const remaining = Math.round((total - allocated) * 100) / 100;

  const validNewLines = lines.filter((l) => l.amount > 0 && l.description.trim());
  const canSave =
    !saving &&
    allocated > 0 &&
    remaining >= -0.005 &&
    lines.every((l) => (l.amount > 0 ? !!l.description.trim() : true));

  const reset = () => {
    setLines([newLine()]);
    setPickedAmounts(new Map());
    setSaving(false);
    setExistingSearch("");
    setMonthFilter(currentMonthStr());
    setIncludeOverdue(true);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const togglePicked = (a: ExistingAccount) => {
    setPickedAmounts((prev) => {
      const next = new Map(prev);
      if (next.has(a.id)) {
        next.delete(a.id);
        return next;
      }
      const curExisting = Array.from(next.values()).reduce((s, v) => s + v, 0);
      const free = Math.max(0, Math.round((total - curExisting - newSum) * 100) / 100);
      const open = openOf(a);
      next.set(a.id, free > 0 ? Math.min(open, free) : open);
      return next;
    });
  };

  const updatePickedAmount = (id: string, val: number, max: number) => {
    setPickedAmounts((prev) => {
      const next = new Map(prev);
      next.set(id, Math.min(Math.max(0, val), max));
      return next;
    });
  };

  const updateLine = (key: string, patch: Partial<NewLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const handleSave = async () => {
    if (!adjustment) return;
    if (allocated <= 0) {
      toast.error("Distribua ao menos um valor");
      return;
    }
    if (remaining < -0.005) {
      toast.error("O total distribuído passou do valor do ajuste");
      return;
    }
    setSaving(true);
    try {
      const p_new_lines = validNewLines.map((l) => ({
        description: l.description.trim(),
        amount: l.amount,
        category_id: l.category_id || null,
        party: l.party.trim() || null,
      }));
      const p_existing = Array.from(pickedAmounts.entries())
        .filter(([, amt]) => amt > 0)
        .map(([id, amount]) => ({ id, amount }));

      const { data, error } = await supabase.rpc("distribute_asaas_adjustment", {
        p_kind: kind,
        p_adjustment_id: adjustment.id,
        p_new_lines: p_new_lines,
        p_existing: p_existing,
      });
      if (error) throw error;

      const res = (data || {}) as { new_count?: number; existing_count?: number; remaining?: number };
      const parts: string[] = [];
      if (res.new_count) parts.push(`${res.new_count} nova(s)`);
      if (res.existing_count) parts.push(`${res.existing_count} existente(s)`);
      const remTxt =
        (res.remaining || 0) > 0.005
          ? ` Restou ${fmt(res.remaining || 0)} no ajuste.`
          : " Ajuste zerado e removido.";
      toast.success(`Ajuste distribuído: ${parts.join(" + ") || "ok"}.${remTxt}`);
      close();
      onDone();
    } catch (e: any) {
      console.error("distribute error", e);
      toast.error(e?.message || "Erro ao distribuir o ajuste");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Distribuir ajuste do Asaas</DialogTitle>
          <DialogDescription className="break-words">
            {adjustment?.description} — total {fmt(total)}. Distribua esse valor em contas reais
            (sem alterar o saldo do banco). Sobra fica no ajuste.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <p className="text-[11px] text-muted-foreground">Ajuste</p>
            <p className="font-bold">{fmt(total)}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-[11px] text-muted-foreground">Distribuído</p>
            <p className="font-bold text-emerald-600">{fmt(allocated)}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-[11px] text-muted-foreground">Restante</p>
            <p className={`font-bold ${remaining < -0.005 ? "text-red-600" : "text-amber-600"}`}>
              {fmt(remaining)}
            </p>
          </div>
        </div>

        {/* Novas contas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Novas contas</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, newLine()])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-4">
                <Input
                  placeholder="Descrição (ex: Pagamento Fabrício)"
                  value={l.description}
                  onChange={(e) => updateLine(l.key, { description: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Input
                  placeholder={partyLabel}
                  value={l.party}
                  onChange={(e) => updateLine(l.key, { party: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Select value={l.category_id} onValueChange={(v) => updateLine(l.key, { category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <CurrencyInput
                  value={l.amount}
                  onChange={(v) => updateLine(l.key, { amount: v })}
                  placeholder="0,00"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Contas existentes */}
        {existingAccounts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Puxar contas já lançadas — {filteredExisting.length} {filteredExisting.length === 1 ? "conta" : "contas"}{existingSearch.trim() ? " (busca em todos os meses)" : ""} (dá baixa e abate do ajuste)
            </Label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mês:</span>
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <Checkbox checked={includeOverdue} onCheckedChange={(v) => setIncludeOverdue(!!v)} />
                Incluir atrasadas
              </label>
            </div>
            <Input
              placeholder="Pesquisar conta pelo nome ou fornecedor..."
              value={existingSearch}
              onChange={(e) => setExistingSearch(e.target.value)}
            />
            <div
              className="max-h-64 overflow-y-scroll rounded-lg border"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,0.6) transparent" }}
            >
              <div className="divide-y">
                {filteredExisting.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conta encontrada.</p>
                ) : filteredExisting.map((a) => {
                  const checked = pickedAmounts.has(a.id);
                  const open = openOf(a);
                  const partial = Number(a.paid || 0) > 0;
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                      <Checkbox checked={checked} onCheckedChange={() => togglePicked(a)} />
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => togglePicked(a)}>
                        <p className="text-sm truncate">{a.description}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {a.party ? `${a.party} · ` : ""}
                          {partial ? `falta ${fmt(open)} de ${fmt(a.amount)}` : fmt(a.amount)}
                        </p>
                      </div>
                      {checked ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-muted-foreground">abater</span>
                          <div className="w-28">
                            <CurrencyInput
                              value={pickedAmounts.get(a.id) || 0}
                              onChange={(v) => updatePickedAmount(a.id, v, open)}
                              className="h-8 text-right"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm font-medium shrink-0">{fmt(open)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Distribuir {allocated > 0 ? fmt(allocated) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
