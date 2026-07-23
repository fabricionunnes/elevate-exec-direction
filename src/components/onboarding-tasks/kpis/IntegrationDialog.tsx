import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plug, Copy, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const INGEST_URL = "https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/project-data-ingest";

interface ApiKey { id: string; name: string; key: string; is_active: boolean; last_used_at: string | null; }
interface EventRow { id: string; status: string; salesperson_ref: string | null; entry_date: string | null; kpis_applied: number; error: string | null; created_at: string; }

function genKey() {
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `unvk_${rnd}`;
}

export function IntegrationDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [kpiNames, setKpiNames] = useState<string[]>([]);
  const [sampleCode, setSampleCode] = useState<string>("CODIGO_DO_VENDEDOR");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [k, kp, sp, ev] = await Promise.all([
      supabase.from("project_api_keys").select("id, name, key, is_active, last_used_at").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("company_kpis").select("name").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
      supabase.from("company_salespeople").select("access_code").eq("company_id", companyId).not("access_code", "is", null).limit(1),
      supabase.from("project_integration_events").select("id, status, salesperson_ref, entry_date, kpis_applied, error, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(15),
    ]);
    setKeys((k.data as ApiKey[]) || []);
    setKpiNames(((kp.data as any[]) || []).map((x) => x.name));
    if (sp.data?.[0]?.access_code) setSampleCode(sp.data[0].access_code);
    setEvents((ev.data as EventRow[]) || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const createKey = async () => {
    const key = genKey();
    const { error } = await supabase.from("project_api_keys").insert({ company_id: companyId, name: "Integração", key });
    if (error) { toast.error(error.message); return; }
    toast.success("Chave criada");
    load();
  };

  const removeKey = async (id: string) => {
    if (!confirm("Revogar esta chave? As integrações que a usam vão parar de enviar.")) return;
    const { error } = await supabase.from("project_api_keys").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Chave revogada");
    load();
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };

  const kpiSample = kpiNames.length ? kpiNames.slice(0, 3) : ["Vendas", "Atendimentos", "Agendamentos"];
  const activeKey = keys.find((k) => k.is_active)?.key || "SUA_CHAVE";
  const curl = `curl -X POST "${INGEST_URL}" \\
  -H "x-api-key: ${activeKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "salesperson": "${sampleCode}",
    "date": "2026-07-22",
    "kpis": { ${kpiSample.map((n) => `"${n}": 0`).join(", ")} }
  }'`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plug className="h-4 w-4" /> Integração via API
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> Integração via API</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <p className="text-muted-foreground">
            Deixe o sistema do cliente (ou o N8N) enviar os números pra cá automaticamente — vendas,
            atendimentos, agendamentos e qualquer KPI cadastrado. O lançamento manual continua funcionando.
          </p>

          {/* Chaves */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Chaves de acesso</h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
                <Button size="sm" onClick={createKey} className="gap-1.5"><Plus className="h-4 w-4" /> Nova chave</Button>
              </div>
            </div>
            {keys.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma chave ainda. Crie uma pra começar.</p>
            ) : (
              <div className="space-y-1.5">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-center gap-2 rounded-md border p-2">
                    <code className="text-xs flex-1 truncate">{k.key}</code>
                    {k.last_used_at && <Badge variant="secondary" className="text-[10px]">usada</Badge>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(k.key)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeKey(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Endpoint + exemplo */}
          <div>
            <h4 className="font-semibold mb-1">Endereço (endpoint)</h4>
            <div className="flex items-center gap-2 rounded-md border p-2 mb-3">
              <code className="text-xs flex-1 truncate">{INGEST_URL}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(INGEST_URL)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold">Exemplo de envio</h4>
              <Button variant="ghost" size="sm" onClick={() => copy(curl)} className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Copiar</Button>
            </div>
            <pre className="rounded-md bg-muted p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">{curl}</pre>
          </div>

          {/* KPIs disponíveis */}
          <div>
            <h4 className="font-semibold mb-1">Nomes de KPI pra enviar</h4>
            <p className="text-xs text-muted-foreground mb-2">Mande exatamente com estes nomes (o resto é ignorado):</p>
            <div className="flex flex-wrap gap-1.5">
              {kpiNames.length ? kpiNames.map((n) => <Badge key={n} variant="outline" className="text-[11px]">{n}</Badge>)
                : <span className="text-xs text-muted-foreground">Nenhum KPI cadastrado ainda.</span>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              O campo <code>salesperson</code> pode ser o código de acesso, e-mail, telefone ou nome do vendedor.
              Sem <code>date</code>, entra no dia de hoje.
            </p>
          </div>

          {/* Log */}
          <div>
            <h4 className="font-semibold mb-1">Últimos recebimentos</h4>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nada recebido ainda.</p>
            ) : (
              <div className="space-y-1">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-xs rounded border p-1.5">
                    <Badge variant={e.status === "ok" ? "secondary" : "destructive"} className="text-[10px]">{e.status}</Badge>
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="truncate">{e.salesperson_ref} · {e.kpis_applied} KPI(s){e.error ? ` · ${e.error}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
