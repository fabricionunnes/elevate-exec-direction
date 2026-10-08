import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Search, CalendarCheck, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";
import {
  iaDb, fmtDateTime, fmtDate, PLAN_LABEL, SUB_STATUS_LABEL, CALL_STATUS_LABEL, type IaSubscription,
} from "@/lib/academy/iaAcademy";

// Admin dos assinantes do UNV IA Academy: lista, status de pagamento, MRR e
// a agenda da sessão individual de planejamento (agendar, link, plano entregue).

export const AcademyAdminSubscribersPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [subs, setSubs] = useState<IaSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [callFilter, setCallFilter] = useState<string>("all");
  const [editing, setEditing] = useState<IaSubscription | null>(null);
  const [callForm, setCallForm] = useState({ status: "scheduled", at: "", url: "", notes: "", plan_md: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await iaDb.from("ia_academy_subscriptions").select("*").order("created_at", { ascending: false });
      setSubs((data as IaSubscription[]) || []);
    } finally {
      setLoading(false);
    }
  };

  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openCall = (s: IaSubscription) => {
    setEditing(s);
    setCallForm({
      status: s.onboarding_call_status === "pending" || s.onboarding_call_status === "requested" ? "scheduled" : s.onboarding_call_status,
      at: toLocalInput(s.onboarding_call_at),
      url: s.onboarding_call_meeting_url || "",
      notes: s.onboarding_call_notes || "",
      plan_md: s.onboarding_call_plan_md || "",
    });
  };

  const saveCall = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await iaDb
        .from("ia_academy_subscriptions")
        .update({
          onboarding_call_status: callForm.status,
          onboarding_call_at: callForm.at ? new Date(callForm.at).toISOString() : null,
          onboarding_call_meeting_url: callForm.url.trim() || null,
          onboarding_call_notes: callForm.notes.trim() || null,
          onboarding_call_plan_md: callForm.plan_md.trim() || null,
        })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("Sessão atualizada");
      setEditing(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subs.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (callFilter !== "all" && s.onboarding_call_status !== callFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.company_name || "").toLowerCase().includes(q);
    });
  }, [subs, search, statusFilter, callFilter]);

  const kpis = useMemo(() => {
    const active = subs.filter((s) => s.status === "active");
    const mrr = active.reduce((acc, s) => acc + (s.plan === "annual" ? s.amount_cents / 12 : s.amount_cents), 0) / 100;
    return {
      active: active.length,
      annual: active.filter((s) => s.plan === "annual").length,
      monthly: active.filter((s) => s.plan === "monthly").length,
      mrr,
      callsPending: active.filter((s) => ["pending", "requested"].includes(s.onboarding_call_status)).length,
      pastDue: subs.filter((s) => s.status === "past_due").length,
    };
  }, [subs]);

  if (!userContext.isAdmin) {
    return <div className="p-4 md:p-6"><Card className="p-12 text-center"><h3 className="font-semibold">Acesso negado</h3></Card></div>;
  }

  const wa = (s: IaSubscription) => {
    const d = (s.whatsapp || "").replace(/\D/g, "");
    return d ? `https://wa.me/${d.startsWith("55") ? d : "55" + d}` : null;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><CreditCard className="h-7 w-7 text-primary" /> Assinantes IA Academy</h1>
        <p className="text-muted-foreground mt-1">Quem assinou, como está o pagamento e a agenda da sessão individual.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: "Ativos", v: kpis.active },
          { l: "Anual / Mensal", v: `${kpis.annual} / ${kpis.monthly}` },
          { l: "MRR equivalente", v: `R$ ${kpis.mrr.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` },
          { l: "Sessões 1:1 a agendar", v: kpis.callsPending },
          { l: "Em atraso", v: kpis.pastDue },
        ].map((k) => (
          <Card key={k.l}><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{k.l}</p><p className="text-2xl font-bold">{k.v}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Nome, e-mail ou empresa" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(SUB_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={callFilter} onValueChange={setCallFilter}>
          <SelectTrigger className="w-full md:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sessão 1:1: todas</SelectItem>
            {Object.entries(CALL_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhum assinante com esse filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Assinante</TableHead>
                  <TableHead className="hidden md:table-cell">Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Período até</TableHead>
                  <TableHead className="hidden sm:table-cell">Sessão 1:1</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="min-w-[160px]">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-none">{s.email}{s.company_name ? ` · ${s.company_name}` : ""}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{PLAN_LABEL[s.plan]}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : s.status === "pending" ? "secondary" : "destructive"}>{SUB_STATUS_LABEL[s.status]}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{fmtDate(s.current_period_end)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="text-sm">{CALL_STATUS_LABEL[s.onboarding_call_status]}</div>
                      {s.onboarding_call_status === "requested" && s.onboarding_call_preferences && (
                        <div className="text-xs text-muted-foreground max-w-[220px] truncate" title={s.onboarding_call_preferences}>{s.onboarding_call_preferences}</div>
                      )}
                      {s.onboarding_call_status === "scheduled" && <div className="text-xs text-muted-foreground">{fmtDateTime(s.onboarding_call_at)}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {wa(s) && (
                          <Button size="icon" variant="ghost" asChild title="WhatsApp">
                            <a href={wa(s)!} target="_blank" rel="noopener noreferrer"><MessageSquare className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {s.asaas_invoice_url && (
                          <Button size="icon" variant="ghost" asChild title="Cobrança no Asaas">
                            <a href={s.asaas_invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openCall(s)}><CalendarCheck className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Sessão</span></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sessão individual · {editing?.name}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              {editing.onboarding_call_preferences && (
                <p className="text-sm rounded-md bg-muted px-3 py-2"><span className="text-muted-foreground">Horários do aluno:</span> {editing.onboarding_call_preferences}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <Select value={callForm.status} onValueChange={(v) => setCallForm({ ...callForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Agendada</SelectItem>
                      <SelectItem value="done">Realizada</SelectItem>
                      <SelectItem value="requested">Solicitada (aguardando)</SelectItem>
                      <SelectItem value="skipped">Dispensada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data e hora</Label>
                  <Input type="datetime-local" value={callForm.at} onChange={(e) => setCallForm({ ...callForm, at: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Link da sala</Label>
                  <Input value={callForm.url} onChange={(e) => setCallForm({ ...callForm, url: e.target.value })} placeholder="https://meet.google.com/..." />
                </div>
                <div className="sm:col-span-2">
                  <Label>Anotações internas</Label>
                  <Textarea rows={3} value={callForm.notes} onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Plano de IA entregue ao aluno (markdown, aparece pra ele)</Label>
                  <Textarea rows={8} className="font-mono text-xs" value={callForm.plan_md} onChange={(e) => setCallForm({ ...callForm, plan_md: e.target.value })}
                    placeholder={"## Primeira implementação\n- Agente SDR no WhatsApp (Trilha 3)\n\n## 90 dias\n- Mês 1: ...\n- Mês 2: ...\n- Mês 3: ..."} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveCall} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyAdminSubscribersPage;
