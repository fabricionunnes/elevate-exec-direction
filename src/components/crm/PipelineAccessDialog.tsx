import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PipelinePerm } from "@/hooks/useCRMPipelinePermissions";
import { PIPELINE_PERM_OPEN } from "@/hooks/useCRMPipelinePermissions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  pipelineName: string;
}

interface StaffRow {
  id: string | null; // null = todos
  name: string;
  role: string;
}

type PermMap = Record<string, PipelinePerm>; // chave: staff id ou "all"

const ROLE_LABEL: Record<string, string> = {
  master: "Master", admin: "Admin", head_comercial: "Head Comercial", closer: "Closer", sdr: "SDR", social_setter: "Social Setter", bdr: "BDR",
};
const BYPASS_ROLES = ["master", "admin", "head_comercial"];

const COLS: { key: keyof PipelinePerm; label: string; hint: string }[] = [
  { key: "can_view", label: "Ver", hint: "Enxerga o funil e os leads dele" },
  { key: "can_create", label: "Criar", hint: "Pode criar e importar leads neste funil" },
  { key: "can_delete", label: "Excluir", hint: "Pode excluir leads deste funil" },
  { key: "can_change_owner", label: "Trocar dono", hint: "Pode mudar o responsável do lead" },
  { key: "only_own_leads", label: "Só os meus", hint: "Vê apenas os leads em que é o responsável" },
];

const keyOf = (staffId: string | null) => staffId ?? "all";
const isOpen = (p: PipelinePerm) => COLS.every((c) => p[c.key] === PIPELINE_PERM_OPEN[c.key]);

/**
 * Acessos do funil (crm_pipeline_permissions): linha "Todos" + uma por pessoa.
 * A linha da pessoa tem prioridade sobre "Todos". Master, admin e head comercial ignoram.
 */
export function PipelineAccessDialog({ open, onOpenChange, pipelineId, pipelineName }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [perms, setPerms] = useState<PermMap>({});
  const [original, setOriginal] = useState<PermMap>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !pipelineId) return;
    (async () => {
      setLoading(true);
      try {
        const [staffRes, permRes] = await Promise.all([
          supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true)
            .in("role", ["master", "admin", "head_comercial", "closer", "sdr", "social_setter", "bdr"]).order("name"),
          (supabase.from("crm_pipeline_permissions" as any) as any)
            .select("staff_id, can_view, can_create, can_delete, can_change_owner, only_own_leads")
            .eq("pipeline_id", pipelineId),
        ]);
        if (staffRes.error) throw staffRes.error;
        if (permRes.error) throw permRes.error;
        setStaff([{ id: null, name: "Todos", role: "all" }, ...((staffRes.data || []) as any[])]);
        const map: PermMap = {};
        for (const r of (permRes.data || []) as any[]) {
          map[keyOf(r.staff_id)] = {
            can_view: !!r.can_view, can_create: !!r.can_create, can_delete: !!r.can_delete,
            can_change_owner: !!r.can_change_owner, only_own_leads: !!r.only_own_leads,
          };
        }
        setPerms(map);
        setOriginal(JSON.parse(JSON.stringify(map)));
      } catch (e: any) {
        toast.error(e.message || "Erro ao carregar acessos do funil");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, pipelineId]);

  const permOf = (staffId: string | null): PipelinePerm => perms[keyOf(staffId)] || PIPELINE_PERM_OPEN;
  const hasOwnRow = (staffId: string | null) => !!perms[keyOf(staffId)];

  const toggle = (staffId: string | null, key: keyof PipelinePerm) => {
    setPerms((prev) => {
      const cur = prev[keyOf(staffId)] || { ...PIPELINE_PERM_OPEN };
      return { ...prev, [keyOf(staffId)]: { ...cur, [key]: !cur[key] } };
    });
  };
  const resetRow = (staffId: string | null) => {
    setPerms((prev) => {
      const next = { ...prev };
      delete next[keyOf(staffId)];
      return next;
    });
  };

  const dirty = JSON.stringify(perms) !== JSON.stringify(original);

  const save = async () => {
    setSaving(true);
    try {
      const keys = new Set([...Object.keys(perms), ...Object.keys(original)]);
      for (const k of keys) {
        const staffId = k === "all" ? null : k;
        const cur = perms[k];
        const was = original[k];
        const table = supabase.from("crm_pipeline_permissions" as any) as any;
        const where = (q: any) => (staffId ? q.eq("staff_id", staffId) : q.is("staff_id", null));
        if (!cur || isOpen(cur)) {
          // sem restrição = sem linha (default é liberado)
          if (was) {
            const { error } = await where(table.delete().eq("pipeline_id", pipelineId));
            if (error) throw error;
          }
          continue;
        }
        if (JSON.stringify(cur) === JSON.stringify(was)) continue;
        if (was) {
          const { error } = await where(table.update({ ...cur, updated_at: new Date().toISOString() }).eq("pipeline_id", pipelineId));
          if (error) throw error;
        } else {
          const { error } = await table.insert({ pipeline_id: pipelineId, staff_id: staffId, ...cur });
          if (error) throw error;
        }
      }
      // normaliza: linhas liberadas somem do estado
      const clean: PermMap = {};
      for (const [k, v] of Object.entries(perms)) if (!isOpen(v)) clean[k] = v;
      setPerms(clean);
      setOriginal(JSON.parse(JSON.stringify(clean)));
      toast.success("Acessos do funil salvos");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar acessos");
    } finally {
      setSaving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = staff.filter((s) => !q || s.name.toLowerCase().includes(q) || s.id === null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Acessos do funil: {pipelineName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          "Todos" vale pra quem não tem linha própria. Master, admin e head comercial ignoram estas regras.
          Sem nada marcado aqui, o funil fica liberado como sempre foi.
        </p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pessoa..." className="h-8 pl-8 text-sm" />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Pessoa</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="text-center font-medium px-2 py-2 text-xs" title={c.hint}>{c.label}</th>
                  ))}
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const bypass = s.id !== null && BYPASS_ROLES.includes(s.role);
                  const p = permOf(s.id);
                  const custom = hasOwnRow(s.id) && !isOpen(p);
                  return (
                    <tr key={keyOf(s.id)} className={cn("border-t border-border/60", s.id === null && "bg-primary/5 font-medium", bypass && "opacity-60")}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{s.name}</span>
                          {s.id !== null && <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[s.role] || s.role}</Badge>}
                          {bypass && <span className="text-[10px] text-muted-foreground">ignora as regras</span>}
                          {!bypass && s.id !== null && !custom && <span className="text-[10px] text-muted-foreground">segue "Todos"</span>}
                        </div>
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className="text-center px-2 py-2">
                          <Switch
                            checked={!!p[c.key]}
                            disabled={bypass}
                            onCheckedChange={() => toggle(s.id, c.key)}
                            className="scale-90"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right">
                        {custom && !bypass && (
                          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => resetRow(s.id)}>
                            {s.id === null ? "Liberar" : "Seguir Todos"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fechar</Button>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar acessos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
