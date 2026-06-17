import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, DollarSign, CalendarCheck, Wallet, Target, Loader2, UserPlus, Copy } from "lucide-react";

const brl = (v: number | string) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DialerClientsAdmin() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing_portal">("new");
  const [form, setForm] = useState({ name: "", email: "", planPricePerUser: "997", initialCredit: "0" });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data: d } = await supabase.functions.invoke("dialer-clients-admin", { body: { days: range } });
    if (d && !d.error) setData(d);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const submit = async () => {
    setSaving(true);
    setResult(null);
    const body: any = {
      mode,
      name: form.name || undefined,
      email: form.email || undefined,
      planPricePerUser: form.planPricePerUser ? Number(form.planPricePerUser) : undefined,
      initialCredit: form.initialCredit ? Number(form.initialCredit) : undefined,
    };
    const { data: r, error } = await supabase.functions.invoke("dialer-provision-client", { body });
    setSaving(false);
    if (error || r?.error) return toast.error(r?.error || error?.message);
    setResult(r);
    toast.success("Cliente cadastrado.");
    load();
  };

  const t = data?.totals;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base font-semibold mr-2">Clientes do discador</span>
        {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={range === d ? "default" : "outline"} onClick={() => setRange(d)}>{d}d</Button>)}
        <Button size="sm" className="gap-2 ml-auto" onClick={() => { setResult(null); setForm({ name: "", email: "", planPricePerUser: "997", initialCredit: "0" }); setOpen(true); }}>
          <UserPlus className="h-4 w-4" /> Cadastrar cliente
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi icon={Users} label="Clientes" value={t?.clients ?? 0} />
            <Kpi icon={DollarSign} label="MRR estimado" value={brl(t?.mrr ?? 0)} highlight />
            <Kpi icon={CalendarCheck} label="Agendamentos" value={t?.agendamentos ?? 0} sub="via discador" />
            <Kpi icon={Target} label="Qualificados" value={t?.qualificados ?? 0} />
            <Kpi icon={Wallet} label="Saldo total (carteiras)" value={brl(t?.balance ?? 0)} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Carteira, plano e resultado por cliente</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Plano (R$/usuário)</TableHead>
                    <TableHead className="text-right">Usuários ativos</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Saldo carteira</TableHead>
                    <TableHead className="text-right">Minutos</TableHead>
                    <TableHead className="text-right">Agendou</TableHead>
                    <TableHead className="text-right">Qualif.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.clients || []).map((c: any) => (
                    <TableRow key={c.tenant_id}>
                      <TableCell className="font-medium">{c.name} {c.status !== "active" && <Badge variant="secondary" className="ml-1 text-[9px]">{c.status}</Badge>}</TableCell>
                      <TableCell className="text-right">{brl(c.plan_price_per_user)}</TableCell>
                      <TableCell className="text-right">{c.active_users}</TableCell>
                      <TableCell className="text-right font-medium">{brl(c.mrr)}</TableCell>
                      <TableCell className={`text-right ${c.balance <= 2 ? "text-red-500" : ""}`}>{brl(c.balance)}</TableCell>
                      <TableCell className="text-right">{c.minutes}</TableCell>
                      <TableCell className="text-right text-blue-500">{c.agendamentos}</TableCell>
                      <TableCell className="text-right text-emerald-500">{c.qualificados}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.clients || data.clients.length === 0) && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum cliente do discador ainda</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar cliente do discador</DialogTitle></DialogHeader>
          {!result ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>Cliente novo</Button>
                <Button size="sm" variant={mode === "existing_portal" ? "default" : "outline"} onClick={() => setMode("existing_portal")}>Cliente existente (portal)</Button>
              </div>
              {mode === "new" ? (
                <>
                  <div><Label>Nome / Empresa</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>E-mail de login</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                </>
              ) : (
                <div><Label>E-mail do cliente já existente no portal</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="ele acessa o discador no mesmo login" /></div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Plano (R$/usuário/mês)</Label><Input type="number" value={form.planPricePerUser} onChange={(e) => setForm((f) => ({ ...f, planPricePerUser: e.target.value }))} /></div>
                <div><Label>Crédito inicial (R$)</Label><Input type="number" value={form.initialCredit} onChange={(e) => setForm((f) => ({ ...f, initialCredit: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Cadastrar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-emerald-600 font-medium">Cliente cadastrado!</p>
              {result.login && <Row label="Login" value={result.login} />}
              {result.tempPassword && <Row label="Senha temporária" value={result.tempPassword} copy />}
              {result.apiKey && <Row label="API key (import de leads)" value={result.apiKey} copy />}
              {result.message && <p className="text-muted-foreground">{result.message}</p>}
              <div className="flex justify-end pt-2"><Button onClick={() => setOpen(false)}>Fechar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
      <div className="min-w-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xs font-mono truncate">{value}</p></div>
      {copy && <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}><Copy className="h-3.5 w-3.5" /></Button>}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, highlight }: { icon: any; label: string; value: number | string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-emerald-500/40" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <p className={`text-xl font-bold mt-1 ${highlight ? "text-emerald-500" : ""}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
