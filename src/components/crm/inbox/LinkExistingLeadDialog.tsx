import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, Search, Link2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LinkExistingLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  channel: "whatsapp" | "instagram";
  currentLeadId?: string | null;
  contactPhone?: string | null;
  contactInstagram?: string | null;
  onLinked?: (leadId: string) => void;
}

interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  stage_color: string | null;
  owner_name: string | null;
  segment: string | null;
  estimated_revenue: string | null;
  employee_count: string | null;
  main_pain: string | null;
  city: string | null;
  state: string | null;
  urgency: string | null;
  fit_score: number | null;
  role: string | null;
  document: string | null;
  notes: string | null;
}

// Campos que o servidor completa no lead escolhido quando estão vazios lá
const CAMPOS: { key: keyof LeadRow; label: string }[] = [
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "instagram", label: "Instagram" },
  { key: "company", label: "Empresa" },
  { key: "role", label: "Cargo" },
  { key: "segment", label: "Segmento" },
  { key: "estimated_revenue", label: "Faturamento" },
  { key: "employee_count", label: "Funcionários" },
  { key: "main_pain", label: "Principal dor" },
  { key: "urgency", label: "Urgência" },
  { key: "fit_score", label: "Fit score" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "document", label: "Documento" },
  { key: "notes", label: "Observações" },
];

const LABEL_POR_CAMPO: Record<string, string> = Object.fromEntries(CAMPOS.map((c) => [c.key, c.label]));

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

export function LinkExistingLeadDialog({
  open,
  onOpenChange,
  conversationId,
  channel,
  currentLeadId,
  contactPhone,
  contactInstagram,
  onLinked,
}: LinkExistingLeadDialogProps) {
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState("all");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LeadRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LeadRow | null>(null);
  const [currentLead, setCurrentLead] = useState<LeadRow | null>(null);
  const [deleteSource, setDeleteSource] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
    setSelected(null);
    setPipelineId("all");
    setDeleteSource(true);
    (async () => {
      const { data } = await supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name");
      setPipelines(data || []);
    })();
  }, [open]);

  // Lead hoje vinculado à conversa (de onde saem os dados a mesclar)
  useEffect(() => {
    if (!open || !currentLeadId) {
      setCurrentLead(null);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("crm_leads")
        .select("id, name, company, phone, email, instagram, pipeline_id, segment, estimated_revenue, employee_count, main_pain, city, state, urgency, fit_score, role, document, notes")
        .eq("id", currentLeadId)
        .maybeSingle();
      setCurrentLead(data || null);
    })();
  }, [open, currentLeadId]);

  // Busca com espera curta enquanto digita
  useEffect(() => {
    if (!open) return;
    const termo = search.trim();
    if (termo.length < 2 && pipelineId === "all") {
      setResults([]);
      return;
    }
    let ativo = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await (supabase as any).rpc("crm_search_leads_for_link", {
        p_search: termo || null,
        p_pipeline: pipelineId === "all" ? null : pipelineId,
        p_exclude: currentLeadId || null,
        p_limit: 30,
      });
      if (!ativo) return;
      setSearching(false);
      if (error) {
        toast.error(error.message || "Erro ao buscar leads");
        return;
      }
      setResults((data || []) as LeadRow[]);
    }, 350);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [search, pipelineId, open, currentLeadId]);

  // Prévia do que vai ser completado no lead escolhido
  const preenchimentos = useMemo(() => {
    if (!selected) return [];
    const origem: Partial<LeadRow> = { ...(currentLead || {}) };
    if (vazio(origem.phone) && contactPhone && contactPhone.replace(/\D/g, "").length >= 8) origem.phone = contactPhone;
    if (vazio(origem.instagram) && contactInstagram) origem.instagram = contactInstagram;
    return CAMPOS.filter((c) => vazio(selected[c.key]) && !vazio(origem[c.key])).map((c) => ({
      label: c.label,
      valor: String(origem[c.key]),
    }));
  }, [selected, currentLead, contactPhone, contactInstagram]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("crm_link_conversation_lead", {
      p_conversation_id: conversationId,
      p_channel: channel,
      p_target: selected.id,
      p_source: currentLeadId || null,
      p_delete_source: !!currentLead && deleteSource,
      p_phone: contactPhone || null,
      p_instagram: contactInstagram || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erro ao vincular o lead");
      return;
    }
    const filled: string[] = (data as any)?.filled || [];
    const nomes = filled.map((f) => LABEL_POR_CAMPO[f] || f);
    toast.success(
      nomes.length
        ? `Conversa vinculada a ${selected.name}. Completado: ${nomes.join(", ")}`
        : `Conversa vinculada a ${selected.name}`
    );
    onLinked?.(selected.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Vincular a lead existente</DialogTitle>
          <DialogDescription>
            Busque o lead pelo funil, nome, telefone ou Instagram. Os dados que faltarem nele são completados com os desta conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <SearchableSelect
            value={pipelineId}
            onValueChange={setPipelineId}
            options={[{ value: "all", label: "Todos os funis" }, ...pipelines.map((p) => ({ value: p.id, label: p.name }))]}
            placeholder="Funil"
            emptyMessage="Nenhum funil encontrado."
          />
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-8"
              placeholder="Nome, telefone ou @instagram"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-[8rem] max-h-72 overflow-y-auto rounded-md border">
          {searching ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.trim().length < 2 && pipelineId === "all" ? "Digite pelo menos 2 caracteres ou escolha um funil" : "Nenhum lead encontrado"}
            </p>
          ) : (
            results.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => setSelected(lead)}
                className={cn(
                  "w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 transition-colors flex items-start gap-2",
                  selected?.id === lead.id && "bg-primary/10"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {lead.name}
                    {lead.company ? <span className="text-muted-foreground font-normal"> · {lead.company}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {lead.stage_color && (
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: lead.stage_color }} />
                    )}
                    {lead.pipeline_name || "Sem funil"}
                    {lead.stage_name ? ` · ${lead.stage_name}` : ""}
                    {lead.owner_name ? ` · ${lead.owner_name}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[lead.phone, lead.email, lead.instagram ? `@${lead.instagram.replace(/^@/, "")}` : null].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                  </p>
                </div>
                {selected?.id === lead.id && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="rounded-md bg-muted/50 p-3 space-y-2 text-xs">
            {preenchimentos.length > 0 ? (
              <div>
                <p className="font-medium mb-1">Vai completar em {selected.name}:</p>
                <ul className="space-y-0.5">
                  {preenchimentos.map((p) => (
                    <li key={p.label} className="truncate">
                      <span className="text-muted-foreground">{p.label}:</span> {p.valor}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground">
                {selected.name} já tem esses dados. A conversa só vai ser vinculada a ele.
              </p>
            )}
            {currentLead && (
              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <Checkbox checked={deleteSource} onCheckedChange={(v) => setDeleteSource(v === true)} className="mt-0.5" />
                <span>
                  Excluir o lead atual <strong>{currentLead.name}</strong> depois de mesclar. Etiquetas, atividades, histórico e
                  conversas passam para {selected.name}.
                </span>
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
            {currentLead || preenchimentos.length ? "Vincular e mesclar" : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
