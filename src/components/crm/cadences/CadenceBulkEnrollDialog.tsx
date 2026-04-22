import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Search, UsersRound } from "lucide-react";

interface Cadence {
  id: string;
  name: string;
  scope: string;
  pipeline_id: string | null;
  stage_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cadences: Cadence[];
}

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  stage_id: string | null;
  pipeline_id: string | null;
}

export function CadenceBulkEnrollDialog({ open, onOpenChange, cadences }: Props) {
  const [cadenceId, setCadenceId] = useState<string>("");
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [filterPipeline, setFilterPipeline] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch("");
    supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setPipelines(data || []));
  }, [open]);

  useEffect(() => {
    if (filterPipeline === "all") { setStages([]); setFilterStage("all"); return; }
    supabase.from("crm_stages").select("id, name").eq("pipeline_id", filterPipeline).order("sort_order")
      .then(({ data }) => setStages(data || []));
  }, [filterPipeline]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      let q = supabase.from("crm_leads").select("id, name, phone, company, stage_id, pipeline_id").order("created_at", { ascending: false }).limit(300);
      if (filterPipeline !== "all") q = q.eq("pipeline_id", filterPipeline);
      if (filterStage !== "all") q = q.eq("stage_id", filterStage);
      const { data } = await q;
      setLeads((data as Lead[]) || []);
      setLoading(false);
    };
    load();
  }, [open, filterPipeline, filterStage]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const s = search.toLowerCase();
    return leads.filter((l) => l.name?.toLowerCase().includes(s) || l.phone?.includes(s) || l.company?.toLowerCase().includes(s));
  }, [leads, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  };

  const handleEnroll = async () => {
    if (!cadenceId) { toast.error("Selecione uma cadência"); return; }
    if (selected.size === 0) { toast.error("Selecione ao menos um lead"); return; }
    setEnrolling(true);
    try {
      const { data, error } = await supabase.rpc("enroll_leads_in_cadence", {
        p_cadence_id: cadenceId,
        p_lead_ids: Array.from(selected),
      });
      if (error) throw error;
      const result = (data as any[])?.[0];
      toast.success(`${result?.enrolled_count || 0} leads inscritos${result?.skipped_count ? ` (${result.skipped_count} já estavam)` : ""}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao inscrever");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" />
            Inscrição manual em massa
          </DialogTitle>
          <DialogDescription>
            Selecione leads e adicione-os a uma cadência específica, sem precisar mudar de etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2">
            <Label>Cadência</Label>
            <Select value={cadenceId} onValueChange={setCadenceId}>
              <SelectTrigger><SelectValue placeholder="Escolha a cadência" /></SelectTrigger>
              <SelectContent>
                {cadences.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Funil</Label>
              <Select value={filterPipeline} onValueChange={setFilterPipeline}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Etapa</Label>
              <Select value={filterStage} onValueChange={setFilterStage} disabled={filterPipeline === "all"}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, telefone, empresa..." />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button className="hover:text-foreground underline" onClick={toggleAll}>
              {selected.size === filtered.length && filtered.length > 0 ? "Limpar seleção" : "Selecionar todos visíveis"}
            </button>
            <Badge variant="secondary">{selected.size} selecionado(s) / {filtered.length} visíveis</Badge>
          </div>

          <ScrollArea className="h-[320px] border rounded-md">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum lead encontrado</p>
            ) : (
              <div className="divide-y">
                {filtered.map((l) => {
                  const checked = selected.has(l.id);
                  return (
                    <label key={l.id} className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (v) n.add(l.id); else n.delete(l.id);
                            return n;
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{l.name || "(sem nome)"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {l.phone || "sem telefone"}{l.company ? ` • ${l.company}` : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enrolling}>Cancelar</Button>
          <Button onClick={handleEnroll} disabled={enrolling || !cadenceId || selected.size === 0}>
            {enrolling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Inscrever {selected.size} lead{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
