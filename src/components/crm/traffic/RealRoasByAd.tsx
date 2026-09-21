// ROAS real por anúncio (pedido do Fabrício, 21/09/2026).
// A Meta só credita venda ao anúncio até 7 dias depois do clique; o ciclo de venda da UNV passa disso em mais
// da metade dos casos. Aqui o gasto de cada anúncio (Meta) é cruzado com as vendas que o CRM atribui a ele,
// sem limite de dias, e mostra lado a lado o que a Meta consegue enxergar.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, EyeOff } from "lucide-react";

interface Row {
  ad_name: string; campaign_name: string | null; thumb: string | null; spend: number; meta_leads: number;
  leads: number; reunioes: number; vendas: number; receita: number; vendas_7d: number; receita_7d: number; ciclo_medio: number | null;
}
const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const roas = (rec: number, gasto: number) => (gasto > 0 ? rec / gasto : null);
const fmtRoas = (r: number | null) => (r === null ? "—" : `${r.toFixed(2).replace(".", ",")}x`);

export function RealRoasByAd() {
  const [dias, setDias] = useState("90");
  const [rows, setRows] = useState<Row[]>([]);
  const [semAnuncio, setSemAnuncio] = useState<{ vendas: number; receita: number; de_trafego: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true); setErro("");
      const ate = new Date(); const de = new Date(); de.setDate(de.getDate() - Number(dias));
      const { data, error } = await (supabase as any).rpc("crm_ad_real_roas", { p_from: ymd(de), p_to: ymd(ate) });
      if (error) { setErro(error.message || "Não consegui carregar."); setLoading(false); return; }
      setRows(((data?.anuncios || []) as any[]).map((r) => ({ ...r, spend: Number(r.spend), receita: Number(r.receita), receita_7d: Number(r.receita_7d) })));
      setSemAnuncio(data?.sem_anuncio || null);
      setLoading(false);
    })();
  }, [dias]);

  const tot = useMemo(() => rows.reduce((a, r) => ({
    spend: a.spend + r.spend, receita: a.receita + r.receita, receita7: a.receita7 + r.receita_7d,
    vendas: a.vendas + r.vendas, vendas7: a.vendas7 + r.vendas_7d, leads: a.leads + r.leads, reunioes: a.reunioes + r.reunioes,
  }), { spend: 0, receita: 0, receita7: 0, vendas: 0, vendas7: 0, leads: 0, reunioes: 0 }), [rows]);
  const invisivel = tot.receita - tot.receita7;

  return (
    <Card className="overflow-hidden border-border/40 shadow-md">
      <div className="h-1 bg-gradient-to-r from-amber-500 to-red-600" />
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 shadow-md"><TrendingUp className="h-4 w-4 text-white" /></div>
            ROAS real por anúncio
          </CardTitle>
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[["30", "Últimos 30 dias"], ["60", "Últimos 60 dias"], ["90", "Últimos 90 dias"], ["180", "Últimos 180 dias"], ["365", "Últimos 12 meses"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Gasto de cada anúncio na Meta cruzado com as vendas que o CRM atribui a ele, sem limite de dias. A Meta só credita venda até 7 dias depois do clique — a coluna "A Meta vê" mostra quanto disso aparece no gerenciador.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : erro ? (
          <p className="text-sm text-destructive py-6 text-center">{erro}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                ["Investido", brl(tot.spend)],
                ["Vendido (real)", `${brl(tot.receita)} · ${tot.vendas} venda${tot.vendas === 1 ? "" : "s"}`],
                ["ROAS real", fmtRoas(roas(tot.receita, tot.spend))],
                ["ROAS que a Meta vê", fmtRoas(roas(tot.receita7, tot.spend))],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground">{l}</p>
                  <p className="text-base font-semibold">{v}</p>
                </div>
              ))}
            </div>
            {invisivel > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <EyeOff className="h-4 w-4 shrink-0 mt-0.5" />
                <span><strong>{brl(invisivel)}</strong> em {tot.vendas - tot.vendas7} venda{tot.vendas - tot.vendas7 === 1 ? "" : "s"} fecharam mais de 7 dias depois do clique e não aparecem no gerenciador de anúncios.</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                    <th className="py-2 pr-3">Anúncio</th><th className="py-2 px-2 text-right">Investido</th><th className="py-2 px-2 text-right">Leads</th>
                    <th className="py-2 px-2 text-right">Reuniões</th><th className="py-2 px-2 text-right">Vendas</th><th className="py-2 px-2 text-right">Vendido</th>
                    <th className="py-2 px-2 text-right">ROAS real</th><th className="py-2 px-2 text-right">A Meta vê</th><th className="py-2 pl-2 text-right">Ciclo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const real = roas(r.receita, r.spend); const meta = roas(r.receita_7d, r.spend);
                    return (
                      <tr key={r.ad_name} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {r.thumb ? (
                              <img src={r.thumb} alt="" loading="lazy" className="h-9 w-9 rounded object-cover shrink-0 bg-muted"
                                onError={(e) => { const el = e.currentTarget; el.onerror = null; el.style.visibility = "hidden"; }} />
                            ) : <div className="h-9 w-9 rounded bg-muted shrink-0" />}
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[260px]" title={r.ad_name}>{r.ad_name}</p>
                              {r.campaign_name && <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">{r.campaign_name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{brl(r.spend)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{r.leads}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{r.reunioes}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{r.vendas}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-medium">{brl(r.receita)}</td>
                        <td className={`py-2 px-2 text-right tabular-nums font-semibold ${real === null ? "" : real >= 1 ? "text-emerald-600" : "text-red-600"}`}>{fmtRoas(real)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{r.vendas_7d} · {fmtRoas(meta)}</td>
                        <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">{r.ciclo_medio === null || r.ciclo_medio === undefined ? "—" : `${Math.round(Number(r.ciclo_medio))} d`}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Nenhum anúncio com gasto ou lead nesse período.</td></tr>}
                </tbody>
              </table>
            </div>
            {semAnuncio && semAnuncio.vendas > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Fora desta tabela: <strong>{semAnuncio.vendas}</strong> venda{semAnuncio.vendas === 1 ? "" : "s"} ({brl(Number(semAnuncio.receita))}) fechadas no período sem anúncio identificado no lead
                {semAnuncio.de_trafego > 0 ? ` — ${semAnuncio.de_trafego} delas vieram de tráfego, mas sem o nome do anúncio` : ""}. São indicação, prospecção, base antiga ou lead que entrou sem rastreio.
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Investido e leads contam pelo período escolhido; a venda conta na data em que fechou, do lead que veio daquele anúncio em qualquer data. Venda = etapa marcada como ganho.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
