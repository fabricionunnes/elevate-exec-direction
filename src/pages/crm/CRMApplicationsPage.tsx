import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Mail, Phone, Building2, ExternalLink, RefreshCw, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Pipeline { id: string; name: string; }
interface Stage { id: string; name: string; pipeline_id: string; sort_order: number; color?: string | null; }

type AppType = "mastermind" | "diagnostic";

interface UnifiedApplication {
  id: string;
  type: AppType;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  notes: string | null;
  raw: Record<string, any>;
}

const typeLabels: Record<AppType, { label: string; className: string }> = {
  mastermind: { label: "Mastermind", className: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  diagnostic: { label: "Diagnóstico", className: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30" },
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  reviewing: "Em análise",
  contacted: "Contatado",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const statusOptions = Object.keys(statusLabels);

export default function CRMApplicationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UnifiedApplication[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AppType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<UnifiedApplication | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState("");

  // Send to pipeline
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [chosenPipelineId, setChosenPipelineId] = useState<string>("");
  const [chosenStageId, setChosenStageId] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.from("crm_pipelines").select("id, name").order("name").then(({ data }) => {
      setPipelines(data || []);
    });
    supabase.from("crm_stages").select("id, name, pipeline_id, sort_order, color").order("sort_order").then(({ data }) => {
      setStages((data || []) as Stage[]);
    });
  }, []);

  const stagesForChosenPipeline = useMemo(
    () => stages.filter((s) => s.pipeline_id === chosenPipelineId),
    [stages, chosenPipelineId]
  );

  // Build a human-readable summary of the application form responses
  const buildNotes = (a: UnifiedApplication): string => {
    const skip = new Set(["id", "created_at", "updated_at", "full_name", "email", "phone", "company", "status", "notes"]);
    const labelMap: Record<string, string> = {
      monthly_revenue: "Faturamento mensal",
      team_size: "Tamanho do time",
      product_interest: "Produto de interesse",
      main_challenge: "Principal desafio",
      website: "Website",
      role: "Cargo",
      role_other: "Outro cargo",
      company_age: "Tempo de empresa",
      employees_count: "Nº de funcionários",
      salespeople_count: "Nº de vendedores",
      upcoming_decision: "Próxima decisão estratégica",
      energy_drain: "O que mais drena energia",
      feels_alone: "Sente-se sozinho",
      willing_to_share_numbers: "Disposto a compartilhar números",
      reaction_to_confrontation: "Reação a confrontação",
      contribution_to_group: "Contribuição ao grupo",
      validation_or_confrontation: "Busca validação ou confrontação",
      available_for_meetings: "Disponível para encontros",
      understands_mansion_costs: "Entende custos da Mansão",
      agrees_confidentiality: "Concorda com confidencialidade",
      aware_of_investment: "Ciente do investimento",
      why_right_moment: "Por que é o momento certo",
      success_definition: "Definição de sucesso",
      is_decision_maker: "É decisor",
      understands_not_operational: "Entende que não é operacional",
      understands_may_be_refused: "Entende que pode ser recusado",
      commits_confidentiality: "Compromisso de confidencialidade",
      accepted_terms: "Aceitou termos",
    };
    const lines: string[] = [];
    lines.push(`📋 APLICAÇÃO ${a.type === "mastermind" ? "MASTERMIND" : "DIAGNÓSTICO"}`);
    lines.push(`Recebida em: ${format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`);
    lines.push("");
    lines.push("RESPOSTAS:");
    Object.entries(a.raw).forEach(([k, v]) => {
      if (skip.has(k)) return;
      if (v === null || v === undefined || v === "") return;
      const label = labelMap[k] || k.replace(/_/g, " ");
      const value = typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v);
      lines.push(`• ${label}: ${value}`);
    });
    if (a.notes) {
      lines.push("");
      lines.push("OBSERVAÇÕES INTERNAS:");
      lines.push(a.notes);
    }
    return lines.join("\n");
  };

  const sendToPipeline = async () => {
    if (!selected || !chosenPipelineId || !chosenStageId) return;
    setSending(true);

    const productInterest = selected.raw.product_interest || null;
    const compiledNotes = buildNotes(selected);

    const { data: lead, error: insertError } = await supabase
      .from("crm_leads")
      .insert({
        name: selected.full_name,
        email: selected.email,
        phone: selected.phone,
        company: selected.company,
        role: selected.raw.role || null,
        pipeline_id: chosenPipelineId,
        stage_id: chosenStageId,
        origin: selected.type === "mastermind" ? "Aplicação Mastermind" : "Aplicação Diagnóstico",
        estimated_revenue: selected.raw.monthly_revenue || null,
        employee_count: selected.raw.employees_count ? String(selected.raw.employees_count) : (selected.raw.team_size || null),
        main_pain: selected.raw.main_challenge || selected.raw.energy_drain || null,
        notes: compiledNotes,
        entered_pipeline_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !lead) {
      console.error(insertError);
      setSending(false);
      toast.error("Erro ao criar lead no funil");
      return;
    }

    // Mark application as contacted
    const table = selected.type === "mastermind" ? "mastermind_applications" : "diagnostic_applications";
    await supabase.from(table).update({ status: "contacted" }).eq("id", selected.id);
    setItems((prev) => prev.map((x) => (x.id === selected.id && x.type === selected.type ? { ...x, status: "contacted" } : x)));

    setSending(false);
    setSendDialogOpen(false);
    toast.success("Lead criado no funil");
    navigate(`/crm/leads/${lead.id}`);
  };


  const load = async () => {
    setLoading(true);
    const [mm, dg] = await Promise.all([
      supabase.from("mastermind_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("diagnostic_applications").select("*").order("created_at", { ascending: false }),
    ]);

    const unified: UnifiedApplication[] = [];

    if (mm.error) {
      console.error(mm.error);
      toast.error("Erro ao carregar aplicações Mastermind");
    } else {
      (mm.data || []).forEach((a: any) => unified.push({
        id: a.id,
        type: "mastermind",
        created_at: a.created_at,
        full_name: a.full_name,
        email: a.email,
        phone: a.phone,
        company: a.company,
        status: a.status,
        notes: a.notes,
        raw: a,
      }));
    }

    if (dg.error) {
      console.error(dg.error);
      toast.error("Erro ao carregar aplicações de Diagnóstico");
    } else {
      (dg.data || []).forEach((a: any) => unified.push({
        id: a.id,
        type: "diagnostic",
        created_at: a.created_at,
        full_name: a.full_name,
        email: a.email,
        phone: a.phone,
        company: a.company,
        status: a.status,
        notes: a.notes,
        raw: a,
      }));
    }

    unified.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setItems(unified);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!s) return true;
      return (
        a.full_name?.toLowerCase().includes(s) ||
        a.email?.toLowerCase().includes(s) ||
        a.phone?.toLowerCase().includes(s) ||
        a.company?.toLowerCase().includes(s)
      );
    });
  }, [items, search, typeFilter, statusFilter]);

  const counts = useMemo(() => {
    const byType: Record<string, number> = { all: items.length, mastermind: 0, diagnostic: 0 };
    items.forEach((i) => { byType[i.type]++; });
    return byType;
  }, [items]);

  const updateStatus = async (a: UnifiedApplication, newStatus: string) => {
    const table = a.type === "mastermind" ? "mastermind_applications" : "diagnostic_applications";
    const { error } = await supabase.from(table).update({ status: newStatus }).eq("id", a.id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === a.id && x.type === a.type ? { ...x, status: newStatus } : x)));
    if (selected?.id === a.id && selected?.type === a.type) {
      setSelected({ ...selected, status: newStatus });
    }
    toast.success("Status atualizado");
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    const table = selected.type === "mastermind" ? "mastermind_applications" : "diagnostic_applications";
    const { error } = await supabase.from(table).update({ notes: draftNotes }).eq("id", selected.id);
    setSavingNotes(false);
    if (error) {
      toast.error("Erro ao salvar observações");
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === selected.id && x.type === selected.type ? { ...x, notes: draftNotes } : x)));
    setSelected({ ...selected, notes: draftNotes });
    toast.success("Observações salvas");
  };

  const openDetail = (a: UnifiedApplication) => {
    setSelected(a);
    setDraftNotes(a.notes || "");
  };

  return (
    <div className="container-premium py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Aplicações</h1>
          <p className="text-muted-foreground">Aplicações recebidas via site (Mastermind e Diagnóstico)</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{counts.all}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mastermind</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-amber-500">{counts.mastermind}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Diagnóstico</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-500">{counts.diagnostic}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email, telefone, empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="mastermind">Mastermind</SelectItem>
                <SelectItem value="diagnostic">Diagnóstico</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Nenhuma aplicação encontrada</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={`${a.type}-${a.id}`} className="cursor-pointer" onClick={() => openDetail(a)}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeLabels[a.type].className}>{typeLabels[a.type].label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{a.full_name}</TableCell>
                      <TableCell>{a.company}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{a.email}</span>
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={(v) => updateStatus(a, v)}>
                          <SelectTrigger className="h-8 w-[140px]" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(a); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className={typeLabels[selected.type].className}>{typeLabels[selected.type].label}</Badge>
                  <span className="flex-1">{selected.full_name}</span>
                  <Button size="sm" variant="hero" onClick={() => { setChosenPipelineId(""); setChosenStageId(""); setSendDialogOpen(true); }}>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar para Funil
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Email</p><p>{selected.email}</p></div></div>
                  <div className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Telefone</p><p>{selected.phone}</p></div></div>
                  <div className="flex items-start gap-2"><Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Empresa</p><p>{selected.company}</p></div></div>
                  <div><p className="text-xs text-muted-foreground">Recebida em</p><p>{format(new Date(selected.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p></div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Detalhes da Aplicação</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(selected.raw).map(([k, v]) => {
                      if (["id", "created_at", "updated_at", "full_name", "email", "phone", "company", "status", "notes"].includes(k)) return null;
                      if (v === null || v === "") return null;
                      const display = typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v);
                      return (
                        <div key={k} className="text-sm">
                          <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
                          <p className="break-words">{display}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Label>Observações internas</Label>
                  <Textarea rows={4} value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} placeholder="Anotações sobre essa aplicação..." />
                  <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                    {savingNotes ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Salvar observações
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Send to Pipeline dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar para Funil do CRM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Um novo lead será criado com todas as informações da aplicação preenchidas. Todas as respostas do formulário serão adicionadas como observações.
            </p>
            <div className="space-y-2">
              <Label>Escolha o funil de destino</Label>
              <Select value={chosenPipelineId} onValueChange={(v) => { setChosenPipelineId(v); setChosenStageId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um funil..." /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa do funil</Label>
              <Select value={chosenStageId} onValueChange={setChosenStageId} disabled={!chosenPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder={chosenPipelineId ? "Selecione uma etapa..." : "Escolha um funil primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {stagesForChosenPipeline.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {s.color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />}
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                  {chosenPipelineId && stagesForChosenPipeline.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Este funil não possui etapas</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={sending}>Cancelar</Button>
              <Button onClick={sendToPipeline} disabled={!chosenPipelineId || !chosenStageId || sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Criar Lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
