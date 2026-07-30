import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plug, Plus, Copy, Radar, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

// Integração do projeto com o CRM DO CLIENTE: o CRM avisa quando o lead
// fechou/perdeu → a aba Leads marca o desfecho sozinha e o Purchase volta
// pro pixel do cliente (CAPI). canEdit = staff; cliente só visualiza.

const FN_URL = "https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/client-crm-status";

interface Props { projectId: string; canEdit?: boolean; }

export const ClientCrmIntegrationTab = ({ projectId, canEdit = false }: Props) => {
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [tracking, setTracking] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [capiToken, setCapiToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: ints }, { data: trk }, { data: lg }] = await Promise.all([
        supabase.from("client_crm_integrations" as never).select("*").eq("project_id", projectId).order("created_at"),
        supabase.from("client_tracking" as never).select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("client_crm_sync_log" as never).select("*").eq("project_id", projectId)
          .order("created_at", { ascending: false }).limit(50),
      ]);
      setIntegrations((ints as any[]) || []);
      setTracking(trk || null);
      setLog((lg as any[]) || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const createIntegration = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("client_crm_integrations" as never)
        .insert({ project_id: projectId } as never);
      if (error) throw error;
      toast.success("Conexão criada — cole a URL e o secret no CRM do cliente");
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const toggleIntegration = async (id: string, active: boolean) => {
    await supabase.from("client_crm_integrations" as never).update({ active } as never).eq("id", id);
    load();
  };

  const saveTracking = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("client_tracking" as never).upsert({
        project_id: projectId,
        meta_pixel_id: pixelId ?? tracking?.meta_pixel_id ?? null,
        meta_capi_token: capiToken ?? tracking?.meta_capi_token ?? null,
        send_purchase: true,
        updated_at: new Date().toISOString(),
      } as never);
      if (error) throw error;
      toast.success("Trackeamento salvo");
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${what} copiado`);
  };

  const actionStyle: Record<string, string> = {
    won: "bg-emerald-500/15 text-emerald-600",
    lost: "bg-rose-500/15 text-rose-500",
    capi_sent: "bg-sky-500/15 text-sky-600",
    capi_error: "bg-amber-500/15 text-amber-600",
    not_found: "bg-amber-500/15 text-amber-600",
    error: "bg-rose-500/15 text-rose-500",
  };

  if (loading) {
    return <div className="py-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" /> CRM do cliente (webhook)
            {canEdit && (
              <Button size="sm" className="ml-auto gap-1.5" onClick={createIntegration} disabled={busy}>
                <Plus className="h-3.5 w-3.5" /> Nova conexão
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O CRM do cliente (ou um fluxo n8n/Zapier/Make) chama essa URL quando o lead fecha ou perde.
            O lead é encontrado pelo telefone (com ou sem DDI) ou e-mail, e o desfecho aparece sozinho na aba Leads.
          </p>
          {integrations.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conexão ainda.</p>}
          {integrations.map((it) => {
            const url = `${FN_URL}?id=${it.id}`;
            return (
              <div key={it.id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{it.name}</span>
                  {it.last_event_at && (
                    <span className="text-[11px] text-muted-foreground">
                      último evento: {new Date(it.last_event_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                  <Badge className={cn("ml-auto border-0 text-[10px]", it.active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground")}>
                    {it.active ? "Ativa" : "Pausada"}
                  </Badge>
                  {canEdit && <Switch checked={it.active} onCheckedChange={(v) => toggleIntegration(it.id, v)} />}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono bg-muted/60 rounded-lg px-2.5 py-1.5">
                  <span className="text-muted-foreground shrink-0">POST</span>
                  <span className="truncate flex-1">{url}</span>
                  <button onClick={() => copy(url, "URL")}><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono bg-muted/60 rounded-lg px-2.5 py-1.5">
                  <span className="text-muted-foreground shrink-0">x-secret</span>
                  <span className="truncate flex-1">{canEdit ? it.secret : "••••••••"}</span>
                  {canEdit && <button onClick={() => copy(it.secret, "Secret")}><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>}
                </div>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Exemplo de chamada</summary>
                  <pre className="mt-2 bg-muted/60 rounded-lg p-2.5 overflow-x-auto text-[11px] leading-relaxed">{`// fechou a venda:
{ "status": "won", "phone": "5531999998888", "value": 2500.00 }

// perdeu:
{ "status": "lost", "phone": "5531999998888", "reason": "sem verba" }`}</pre>
                </details>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" /> Trackeamento avançado (Pixel + CAPI)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Com o Pixel e o token da Conversions API do cliente, cada venda confirmada vira um evento de
            Purchase enviado de volta pro Meta — o algoritmo passa a otimizar por quem compra.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Pixel ID do cliente</Label>
              <Input className="mt-1" placeholder="Ex.: 247392077001023" disabled={!canEdit}
                value={pixelId ?? tracking?.meta_pixel_id ?? ""} onChange={(e) => setPixelId(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Token da Conversions API</Label>
              <Input className="mt-1" type="password" placeholder="EAAG..." disabled={!canEdit}
                value={capiToken ?? tracking?.meta_capi_token ?? ""} onChange={(e) => setCapiToken(e.target.value)} />
            </div>
          </div>
          {canEdit && (
            <Button size="sm" onClick={saveTracking} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null} Salvar trackeamento
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" /> Log de sincronização
          </CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada ainda — o primeiro evento do CRM do cliente aparece aqui.</p>
          ) : (
            <div className="space-y-1">
              {log.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs border-b border-border/50 py-1.5">
                  <Badge className={cn("border-0 text-[10px] shrink-0", actionStyle[r.action] || "bg-muted text-muted-foreground")}>
                    {r.action}
                  </Badge>
                  <span className="text-muted-foreground truncate flex-1">{r.detail}</span>
                  <span className="text-muted-foreground/70 shrink-0">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
