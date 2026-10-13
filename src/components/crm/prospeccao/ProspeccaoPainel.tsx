// Prospecção B2B > aba "Painel" (pedido do Fabrício em 13/10/2026, igual ao do UNV Sales e no
// molde do painel de Disparos): o que as empresas prospectadas viraram em resposta, reunião e
// venda. No Nexus a prospecção é uso interno e não é cobrada, então o custo é de referência.
// Os números vêm de uma consulta só: crm_prospect_dashboard(de, até, custo por empresa).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Wallet, Building2, CalendarCheck, Trophy, MessageSquare, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { FunilVendas3D } from "@/components/crm/disparos/FunilVendas3D";

// mesma paleta do painel de Disparo API (validada pro daltonismo)
const C = { empresas: "#2a78d6", responderam: "#eda100", reunioes: "#4a3aa7", vendas: "#eb6834", investido: "#1baf7a" };

const n = (v: unknown) => Number(v || 0);
const brlCents = (c: unknown) => (n(c) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v: unknown) => n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0).replace(".", ",")}%` : "-");
const diaCurto = (s: string) => { const [, m, d] = String(s).split("-"); return `${d}/${m}`; };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PERIODOS = [
  { key: "7", label: "7 dias", dias: 7 },
  { key: "30", label: "30 dias", dias: 30 },
  { key: "90", label: "90 dias", dias: 90 },
  { key: "tudo", label: "Tudo", dias: 0 },
] as const;

function Kpi({ titulo, valor, detalhe, icone: Icone, cor }: { titulo: string; valor: string; detalhe?: string; icone: any; cor: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{titulo}</p>
          <Icone className="h-4 w-4 shrink-0" style={{ color: cor }} />
        </div>
        <p className="text-2xl font-bold mt-1 tabular-nums">{valor}</p>
        {detalhe && <p className="text-xs text-muted-foreground mt-0.5">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export function ProspeccaoPainel() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["key"]>("30");
  const [dados, setDados] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // custo de referência por empresa (padrão: preço de tabela do UNV Sales), só pra CAC e retorno
  const [custoRef, setCustoRef] = useState("1,20");
  const custoCents = Math.max(0, Math.round(Number(custoRef.replace(/\./g, "").replace(",", ".")) * 100) || 0);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const p = PERIODOS.find((x) => x.key === periodo)!;
    const hoje = new Date();
    const de = p.dias ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (p.dias - 1)) : new Date(2020, 0, 1);
    const { data, error } = await (supabase as any).rpc("crm_prospect_dashboard", { p_from: iso(de), p_to: iso(hoje), p_custo_cents: custoCents });
    if (error) setErro(error.message); else setDados(data);
    setCarregando(false);
  }, [periodo, custoCents]);
  useEffect(() => { const t = setTimeout(carregar, 350); return () => clearTimeout(t); }, [carregar]);

  const r = dados?.resumo ?? {};
  const empresas = n(r.empresas);
  const funil = useMemo(() => ([
    { etapa: "Empresas entregues", valor: empresas, cor: C.empresas },
    { etapa: "Responderam", valor: n(r.responderam), cor: C.responderam },
    { etapa: "Reunião marcada", valor: n(r.reunioes), cor: C.reunioes },
    { etapa: "Vendas", valor: n(r.vendas), cor: C.vendas },
  ]), [empresas, r.responderam, r.reunioes, r.vendas]);
  const porDia = (dados?.por_dia ?? []).map((d: any) => ({ ...d, dia: diaCurto(d.dia) }));
  const porEtapa: any[] = dados?.por_etapa ?? [];

  if (carregando && !dados) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (erro) return <Card><CardContent className="py-10 text-center text-sm text-destructive">Não foi possível carregar o painel: {erro}</CardContent></Card>;

  return (
    <div className="space-y-4">
      {/* no Nexus não tem crédito: uso interno, sem cobrança */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Créditos</p>
              <p className="text-xl font-bold">Uso interno da UNV, sem custo</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Custo de referência por empresa (R$)</p>
            <Input className="h-8 w-28 mt-0.5" inputMode="decimal" value={custoRef} onChange={(e) => setCustoRef(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground basis-full">
            Aqui ninguém paga pelas empresas. O custo de referência (padrão R$ 1,20, o preço de tabela do UNV Sales) serve só pra dar noção de investimento, CAC e retorno.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => (
          <Button key={p.key} size="sm" variant={periodo === p.key ? "default" : "outline"} onClick={() => setPeriodo(p.key)}>{p.label}</Button>
        ))}
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className="text-xs text-muted-foreground ml-auto">Conta as empresas entregues no período e o que aconteceu com elas até hoje.</span>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Empresas entregues" valor={empresas.toLocaleString("pt-BR")} detalhe={`${n(r.lotes)} lote(s)`} icone={Building2} cor={C.empresas} />
        <Kpi titulo="Investido (referência)" valor={brlCents(r.investido_cents)} detalhe={`${brlCents(custoCents)} por empresa`} icone={Wallet} cor={C.investido} />
        <Kpi titulo="Responderam" valor={n(r.responderam).toLocaleString("pt-BR")} detalhe={`${pct(n(r.responderam), empresas)} das entregues`} icone={MessageSquare} cor={C.responderam} />
        <Kpi titulo="Reuniões marcadas" valor={n(r.reunioes).toLocaleString("pt-BR")} detalhe={r.custo_por_reuniao_cents != null ? `${brlCents(r.custo_por_reuniao_cents)} por reunião · ${n(r.realizadas)} realizada(s)` : `${n(r.realizadas)} realizada(s)`} icone={CalendarCheck} cor={C.reunioes} />
        <Kpi titulo="Vendas" valor={n(r.vendas).toLocaleString("pt-BR")} detalhe={`${pct(n(r.vendas), empresas)} das entregues`} icone={Trophy} cor={C.vendas} />
        <Kpi titulo="Valor de vendas" valor={brl(r.valor_vendas)} detalhe={n(r.vendas) > 0 ? `ticket médio ${brl(n(r.valor_vendas) / n(r.vendas))}` : undefined} icone={TrendingUp} cor={C.vendas} />
        <Kpi titulo="CAC" valor={r.cac_cents != null ? brlCents(r.cac_cents) : "-"} detalhe="custo de referência ÷ vendas" icone={Wallet} cor={C.investido} />
        <Kpi titulo="Retorno" valor={r.roas != null && n(r.investido_cents) > 0 ? `${n(r.roas).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "-"} detalhe="valor vendido ÷ custo de referência" icone={TrendingUp} cor={C.vendas} />
      </div>

      {empresas === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma empresa prospectada nesse período. Faça uma busca na aba "Buscar empresas" e os números aparecem aqui.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Funil da prospecção</p>
                <p className="text-xs text-muted-foreground mb-2">Das empresas entregues até a venda</p>
                <FunilVendas3D etapas={funil} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Onde os negócios estão hoje</p>
                <p className="text-xs text-muted-foreground mb-2">Etapa atual das empresas entregues</p>
                <div style={{ height: Math.max(180, porEtapa.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porEtapa} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="etapa" width={150} tick={{ fontSize: 11 }} />
                      <RTooltip formatter={(v: any) => [`${v} empresa(s)`, "Quantidade"]} />
                      <Bar dataKey="qtd" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11 }}>
                        {porEtapa.map((e, i) => <Cell key={i} fill={e.final === "won" ? C.vendas : e.final === "lost" ? "#94a3b8" : C.empresas} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold">Entregas por dia</p>
              <p className="text-xs text-muted-foreground mb-2">Empresas que entraram no funil, reuniões e vendas</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={porDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEmp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.empresas} stopOpacity={0.35} /><stop offset="95%" stopColor={C.empresas} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                    <RTooltip formatter={(v: any, nome: any) => (nome === "investido" ? [brl(v), "Investido"] : [v, nome === "empresas" ? "Empresas" : nome === "reunioes" ? "Reuniões" : "Vendas"])} />
                    <Area type="monotone" dataKey="empresas" stroke={C.empresas} fill="url(#gEmp)" strokeWidth={2} />
                    <Area type="monotone" dataKey="reunioes" stroke={C.reunioes} fill="none" strokeWidth={2} />
                    <Area type="monotone" dataKey="vendas" stroke={C.vendas} fill="none" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-2">Por segmento</p>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Segmento</TableHead><TableHead className="text-right">Empresas</TableHead>
                    <TableHead className="text-right">Reuniões</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Valor</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(dados?.por_segmento ?? []).map((s: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm max-w-[140px] truncate" title={s.segmento}>{s.segmento}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(s.empresas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(s.reunioes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(s.vendas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(s.valor_vendas)}</TableCell>
                      </TableRow>
                    ))}
                    {(dados?.por_segmento ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-2">Por cidade</p>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Cidade</TableHead><TableHead className="text-right">Empresas</TableHead>
                    <TableHead className="text-right">Reuniões</TableHead><TableHead className="text-right">Vendas</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(dados?.por_cidade ?? []).map((c: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{c.cidade}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(c.empresas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(c.reunioes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(c.vendas)}</TableCell>
                      </TableRow>
                    ))}
                    {(dados?.por_cidade ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">Resultado por lote (dia e funil)</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Dia</TableHead><TableHead>Funil</TableHead><TableHead className="text-right">Empresas</TableHead>
                    <TableHead className="text-right">Custo ref.</TableHead><TableHead className="text-right">Responderam</TableHead>
                    <TableHead className="text-right">Reuniões</TableHead><TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">CAC</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(dados?.lotes ?? []).map((p: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm whitespace-nowrap">{String(p.dia).split("-").reverse().join("/")}</TableCell>
                        <TableCell className="text-sm">{p.funil}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(p.empresas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brlCents(p.investido_cents)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(p.responderam)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(p.reunioes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(p.vendas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(p.valor_vendas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(p.vendas) > 0 ? brlCents(n(p.investido_cents) / n(p.vendas)) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
