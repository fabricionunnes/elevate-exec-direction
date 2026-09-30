import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, CheckCircle2, ClipboardList, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  completePendingActivity,
  saveGateFieldValues,
  loadGateSelectOptions,
  type LeadGateResult,
  type GateSelectOptions,
  type MissingField,
} from "@/lib/crm/stageGate";

interface StageGateDialogProps {
  open: boolean;
  gate: LeadGateResult | null;
  targetStageName: string;
  /** master/admin: pode mover mesmo com pendência (fica no histórico) */
  canOverride: boolean;
  onCancel: () => void;
  /** tudo resolvido: quem chamou refaz a movimentação (e checa de novo) */
  onResolved: () => void;
  onOverride: () => void;
}

/**
 * "Resolva as pendências pra concluir a movimentação": lista as atividades obrigatórias
 * da etapa atual ainda pendentes (com Concluir na linha) e os campos exigidos pela etapa
 * de destino (com o campo pra preencher ali mesmo).
 */
export function StageGateDialog({ open, gate, targetStageName, canOverride, onCancel, onResolved, onOverride }: StageGateDialogProps) {
  const [pending, setPending] = useState(gate?.pendingActivities || []);
  const [values, setValues] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<GateSelectOptions | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPending(gate?.pendingActivities || []);
    const init: Record<string, string> = {};
    for (const m of gate?.missingFields || []) init[m.def.key] = m.current || "";
    setValues(init);
  }, [gate]);

  useEffect(() => {
    if (!open || !gate) return;
    const precisa = gate.missingFields.some((m) => ["staff", "origin", "product", "loss_reason"].includes(m.def.type));
    if (precisa && !options) loadGateSelectOptions().then(setOptions).catch(() => setOptions({ staff: [], origins: [], products: [], lossReasons: [] }));
  }, [open, gate, options]);

  if (!gate) return null;

  const missing = gate.missingFields;
  const faltando = missing.filter((m) => {
    const v = (values[m.def.key] || "").trim();
    return m.def.key === "opportunity_value" ? !(Number(v.replace(",", ".")) > 0) : v === "";
  });
  const tudoResolvido = pending.length === 0 && faltando.length === 0;

  const concluir = async (id: string) => {
    setBusy(id);
    try {
      await completePendingActivity(id);
      setPending((prev) => prev.filter((p) => p.id !== id));
      toast.success("Atividade concluída");
    } catch (e: any) {
      toast.error(e.message || "Erro ao concluir atividade");
    } finally {
      setBusy(null);
    }
  };

  const corrigirEMover = async () => {
    if (pending.length > 0) {
      toast.error("Conclua as atividades pendentes antes de mover");
      return;
    }
    if (faltando.length > 0) {
      toast.error(`Preencha: ${faltando.map((m) => m.def.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      if (missing.length) await saveGateFieldValues(gate.leadId, values);
      onResolved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar os campos");
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (m: MissingField) => {
    const key = m.def.key;
    const val = values[key] || "";
    const set = (v: string) => setValues((prev) => ({ ...prev, [key]: v }));
    if (m.def.options?.length) {
      return (
        <SearchableSelect value={val} onValueChange={set} placeholder="Selecionar" className="h-9 text-sm"
          options={m.def.options.map((o) => ({ value: o, label: o }))} />
      );
    }
    switch (m.def.type) {
      case "staff":
      case "origin":
      case "product":
      case "loss_reason": {
        const opts = !options ? [] : m.def.type === "staff" ? options.staff : m.def.type === "origin" ? options.origins : m.def.type === "product" ? options.products : options.lossReasons;
        return (
          <SearchableSelect value={val} onValueChange={set} placeholder={options ? "Selecionar" : "Carregando..."}
            className="h-9 text-sm" options={opts} emptyMessage="Nenhum resultado." />
        );
      }
      case "number":
        return <Input type="number" min={0} step="0.01" value={val} onChange={(e) => set(e.target.value)} className="h-9" placeholder="0" />;
      case "textarea":
        return <Textarea value={val} onChange={(e) => set(e.target.value)} rows={2} />;
      default:
        return <Input value={val} onChange={(e) => set(e.target.value)} className="h-9" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onCancel(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Resolva as pendências pra concluir a movimentação
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{gate.leadName}</strong> vai para <strong className="text-foreground">{targetStageName}</strong>.
        </p>

        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Atividades obrigatórias da etapa atual
            </p>
            {pending.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.scheduled_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Prazo: {format(new Date(a.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={() => concluir(a.id)} disabled={busy === a.id}>
                  {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Concluir
                </Button>
              </div>
            ))}
          </div>
        )}

        {missing.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campos exigidos pela etapa {targetStageName}
            </p>
            {missing.map((m) => (
              <div key={m.def.key}>
                <Label className="text-xs">{m.def.label} *</Label>
                <div className="mt-1">{renderInput(m)}</div>
              </div>
            ))}
          </div>
        )}

        {tudoResolvido && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Tudo resolvido. Pode mover.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          {canOverride && !tudoResolvido && (
            <Button variant="ghost" onClick={onOverride} disabled={saving} title="Fica registrado no histórico do lead que passou por cima das pendências">
              Mover mesmo assim
            </Button>
          )}
          <Button onClick={corrigirEMover} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Corrigir e mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
