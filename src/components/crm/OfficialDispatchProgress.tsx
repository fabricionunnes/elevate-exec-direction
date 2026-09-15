// Aviso flutuante (canto inferior direito do CRM) com o andamento dos disparos
// da API oficial que o usuário iniciou. O envio roda no servidor
// (official-campaign-dispatch), então dá pra trabalhar normalmente no CRM.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, PauseCircle, ShieldCheck, X, CheckCircle2 } from "lucide-react";

const CAMP = "whatsapp_official_campaigns";
const REC = "whatsapp_official_campaign_recipients";

interface Andamento {
  id: string;
  template_name: string;
  status: string;
  notes: string | null;
  total: number;
  pendentes: number;
  enviados: number;
  falhas: number;
}

export async function cancelarDisparo(campaignId: string) {
  await supabase.from(CAMP as any).update({ status: "canceled", finished_at: new Date().toISOString() } as any).eq("id", campaignId).in("status", ["sending", "paused"]);
  await supabase.from(REC as any).update({ status: "skipped", error_text: "Disparo cancelado antes do envio" } as any).eq("campaign_id", campaignId).eq("status", "pending");
  window.dispatchEvent(new CustomEvent("official-dispatch-started"));
}

export async function retomarDisparo(campaignId: string) {
  const { error } = await supabase.from(CAMP as any).update({ status: "sending", notes: null, resumed_at: new Date().toISOString() } as any).eq("id", campaignId).eq("status", "paused");
  if (error) { toast.error("Não consegui retomar o disparo"); return; }
  const { error: invErr } = await supabase.functions.invoke("official-campaign-dispatch", { body: { campaign_id: campaignId } });
  if (invErr) toast.error("O disparo não reiniciou. Tente de novo em instantes.");
  else toast.success("Disparo retomado");
  window.dispatchEvent(new CustomEvent("official-dispatch-started"));
}

export function OfficialDispatchProgress() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<Andamento[]>([]);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const staffIdRef = useRef<string | null>(null);
  const statusAnterior = useRef<Map<string, string>>(new Map());
  const concluidosEm = useRef<Map<string, number>>(new Map());

  const carregar = useCallback(async () => {
    try {
      if (!staffIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: st } = await supabase.from("onboarding_staff").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        if (!st) return;
        staffIdRef.current = st.id;
      }
      const desde = new Date(Date.now() - 24 * 3600e3).toISOString();
      const { data: camps } = await supabase.from(CAMP as any)
        .select("id, template_name, status, notes")
        .eq("created_by_staff_id", staffIdRef.current)
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(10);

      const agora = Date.now();
      const relevantes = ((camps || []) as any[]).filter((c) => {
        const antes = statusAnterior.current.get(c.id);
        if (c.status === "sending" || c.status === "paused") return true;
        if (antes === "sending" || antes === "paused") return true; // acabou de terminar
        const fim = concluidosEm.current.get(c.id);
        return !!fim && agora - fim < 60_000;
      });

      const lista: Andamento[] = [];
      for (const c of relevantes) {
        const { data: recs } = await supabase.from(REC as any).select("status").eq("campaign_id", c.id).limit(10000);
        let total = 0, pendentes = 0, enviados = 0, falhas = 0;
        for (const r of (recs || []) as any[]) {
          if (r.status === "skipped") continue;
          total++;
          if (r.status === "pending" || r.status === "processing") pendentes++;
          else if (r.status === "error" || r.status === "failed") falhas++;
          else enviados++;
        }
        const antes = statusAnterior.current.get(c.id);
        if (antes && antes !== c.status) {
          if (c.status === "done") {
            concluidosEm.current.set(c.id, agora);
            toast.success(`Disparo concluído: ${enviados} enviados${falhas ? `, ${falhas} com falha` : ""}`, {
              action: { label: "Ver", onClick: () => navigate(`/crm/disparos/${c.id}`) },
            });
          } else if (c.status === "paused") {
            toast.error(c.notes || "Disparo pausado");
          }
        }
        statusAnterior.current.set(c.id, c.status);
        lista.push({ id: c.id, template_name: c.template_name, status: c.status, notes: c.notes, total, pendentes, enviados, falhas });
      }
      setItens(lista);
    } catch (e) {
      console.error("andamento disparos:", e);
    }
  }, [navigate]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 5000);
    const h = () => carregar();
    window.addEventListener("official-dispatch-started", h);
    return () => { clearInterval(t); window.removeEventListener("official-dispatch-started", h); };
  }, [carregar]);

  const visiveis = itens.filter((i) => !ocultos.has(i.id));
  if (!visiveis.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {visiveis.map((i) => {
        const feitos = i.total - i.pendentes;
        const pct = i.total ? Math.round((feitos / i.total) * 100) : 0;
        const titulo = i.status === "sending" ? "Disparo em andamento" : i.status === "paused" ? "Disparo pausado" : i.status === "canceled" ? "Disparo cancelado" : "Disparo concluído";
        return (
          <div key={i.id} className="rounded-lg border bg-card p-3 shadow-lg">
            <div className="flex items-center gap-2">
              {i.status === "sending" ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                : i.status === "paused" ? <PauseCircle className="h-4 w-4 text-amber-600" />
                : i.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <ShieldCheck className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm font-semibold">{titulo}</span>
              <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setOcultos((s) => new Set(s).add(i.id))} title="Esconder">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{i.template_name.replace(/_/g, " ")}</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full ${i.status === "paused" ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 text-xs tabular-nums">
              {feitos} de {i.total} · <span className="text-emerald-700 dark:text-emerald-400">{i.enviados} enviados</span>
              {i.falhas > 0 && <> · <span className="text-red-600">{i.falhas} com falha</span></>}
            </div>
            {i.status === "paused" && i.notes && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{i.notes}</p>}
            <div className="mt-2 flex gap-1.5">
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link to={`/crm/disparos/${i.id}`}>Ver disparo</Link>
              </Button>
              {i.status === "sending" && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => {
                  if (window.confirm("Cancelar o disparo? Quem ainda não recebeu fica de fora.")) cancelarDisparo(i.id);
                }}>Cancelar</Button>
              )}
              {i.status === "paused" && (
                <>
                  <Button size="sm" className="h-7 text-xs" onClick={() => retomarDisparo(i.id)}>Retomar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => {
                    if (window.confirm("Cancelar o disparo? Quem ainda não recebeu fica de fora.")) cancelarDisparo(i.id);
                  }}>Cancelar</Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
