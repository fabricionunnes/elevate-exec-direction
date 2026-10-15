// Onde o lead para no formulário de diagnóstico (UNV Ads, UNV Social, UNV Finance).
// Os formulários públicos avisam cada tela aberta (RPC form_track, tabela crm_form_sessions);
// aqui o funil pergunta a pergunta vem da RPC form_funnel. Abandono = parado há 30 min.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, RefreshCw, AlertTriangle, ExternalLink, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";

type Totais = {
  visitas: number; comecaram: number; enviaram: number; desqualificados: number; cortados_perfil: number;
  cortados_faturamento: number; abandonaram: number; preenchendo_agora: number; erros: number;
  total_perguntas: number | null; mediana_seg_envio: number | null; recuperaveis?: number; recuperaveis_pendentes?: number;
};
type Pergunta = { q: number; nome: string | null; chegaram: number; pararam: number };
type Campanha = { campanha: string; visitas: number; comecaram: number; enviaram: number; abandonaram: number };
type Aparelho = { device: string; visitas: number; enviaram: number };
type Sessao = {
  id: string; started_at: string; updated_at: string; situacao: string; last_step_name: string | null; max_question: number;
  total_questions: number | null; lead_id: string | null; respostas: Record<string, string>; utm_source: string | null;
  utm_campaign: string | null; ad_name: string | null; device: string | null;
  contato_nome?: string | null; contato_whatsapp?: string | null; recuperacao_em?: string | null;
};
type Dados = { totais: Totais; perguntas: Pergunta[]; campanhas: Campanha[]; aparelhos: Aparelho[]; recentes: Sessao[] };

const FORMS: { value: string; label: string; url: string; perguntas: string[] }[] = [
  { value: "unvads", label: "UNV Ads", url: "https://unvholdings.com.br/unvads/forms/",
    perguntas: ["É empresário?", "Nome", "WhatsApp", "E-mail", "Instagram", "Investimento em tráfego", "Maior dificuldade", "Faturamento"] },
  { value: "unvsocial", label: "UNV Social", url: "https://unvholdings.com.br/unvsocial/forms/",
    perguntas: ["Perfil (dono, sócio, prestador)", "Faturamento", "Nome", "WhatsApp", "E-mail", "Instagram", "Gestão das redes hoje", "Motivo de buscar ajuda"] },
  { value: "unvfinance", label: "UNV Finance", url: "https://unvholdings.com.br/unvfinance/forms/",
    perguntas: ["É dono ou sócio?", "Nome", "WhatsApp", "E-mail", "Nome da empresa", "Faturamento", "Maior incômodo no financeiro", "Quem cuida do financeiro"] },
];

const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "90d", label: "Últimos 90 dias" },
];

const SITUACAO: Record<string, { label: string; cls: string }> = {
  enviou: { label: "Enviou", cls: "bg-emerald-600 hover:bg-emerald-600 text-white" },
  desqualificado: { label: "Enviou (desqualificado)", cls: "bg-slate-500 hover:bg-slate-500 text-white" },
  abandonou: { label: "Abandonou", cls: "bg-red-600 hover:bg-red-600 text-white" },
  em_andamento: { label: "Preenchendo", cls: "bg-amber-500 hover:bg-amber-500 text-white" },
  cortado_perfil: { label: "Cortado no perfil", cls: "bg-muted text-muted-foreground hover:bg-muted" },
  cortado_faturamento: { label: "Cortado no faturamento", cls: "bg-muted text-muted-foreground hover:bg-muted" },
  erro_envio: { label: "Erro ao enviar", cls: "bg-orange-600 hover:bg-orange-600 text-white" },
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n || 0);
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function intervalo(p: string): [string, string] {
  const agora = new Date();
  const ini = new Date(agora);
  if (p === "hoje") ini.setHours(0, 0, 0, 0);
  else if (p === "mes") { ini.setDate(1); ini.setHours(0, 0, 0, 0); }
  else ini.setDate(ini.getDate() - (p === "7d" ? 7 : p === "30d" ? 30 : 90));
  const fim = new Date(agora.getTime() + 60_000);
  return [ini.toISOString(), fim.toISOString()];
}

function Tile({ label, valor, sub, tom }: { label: string; valor: string; sub?: string; tom?: "bom" | "ruim" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold tabular-nums ${tom === "bom" ? "text-emerald-600" : tom === "ruim" ? "text-red-600" : ""}`}>{valor}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function FormulariosTab() {
  const navigate = useNavigate();
  const [form, setForm] = useState("unvads");
  const [periodo, setPeriodo] = useState("30d");
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroSit, setFiltroSit] = useState("todas");

  const cfg = FORMS.find((f) => f.value === form)!;

  const carregar = async () => {
    setCarregando(true); setErro(null);
    const [de, ate] = intervalo(periodo);
    const { data, error } = await (supabase as any).rpc("form_funnel", { p_form: form, p_from: de, p_to: ate });
    if (error) setErro(error.message); else setDados(data as Dados);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [form, periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const nomePergunta = (q: number) => cfg.perguntas[q - 1] || `Pergunta ${q}`;
  const t = dados?.totais;

  // onde mais gente para: maior número de abandonos numa pergunta
  const pior = useMemo(() => {
    const ps = (dados?.perguntas || []).filter((p) => p.pararam > 0);
    return ps.sort((a, b) => b.pararam - a.pararam)[0] || null;
  }, [dados]);

  const recentes = (dados?.recentes || []).filter((s) =>
    filtroSit === "todas" ? true
      : filtroSit === "recuperaveis" ? (s.situacao === "abandonou" && !!s.contato_whatsapp)
      : s.situacao === filtroSit);
  const pendentes = (dados?.recentes || []).filter((s) => s.situacao === "abandonou" && s.contato_whatsapp && !s.recuperacao_em);

  const linkWhats = (s: Sessao) => {
    const d = String(s.contato_whatsapp || "").replace(/\D/g, "");
    const num = d.startsWith("55") ? d : `55${d}`;
    const primeiro = (s.contato_nome || "").trim().split(/\s+/)[0] || "";
    const texto = `Oi${primeiro ? ` ${primeiro}` : ""}, tudo bem? Aqui é da ${cfg.label}. Vi que você começou o diagnóstico e parou no meio. Posso te ajudar a terminar ou tirar alguma dúvida?`;
    return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  };
  const marcarChamado = async (s: Sessao) => {
    const { error } = await (supabase as any).rpc("form_session_recuperado", { p_session: s.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Marcado como chamado");
    carregar();
  };
  const enviaramTotal = (t?.enviaram || 0) + (t?.desqualificados || 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <div className="mb-1 text-xs text-muted-foreground">Formulário</div>
          <SearchableSelect value={form} onValueChange={setForm} options={FORMS.map((f) => ({ value: f.value, label: f.label }))} placeholder="Formulário" />
        </div>
        <div className="w-48">
          <div className="mb-1 text-xs text-muted-foreground">Período</div>
          <SearchableSelect value={periodo} onValueChange={setPeriodo} options={PERIODOS} placeholder="Período" />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={carregar} disabled={carregando}>
          {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Atualizar
        </Button>
        <a href={cfg.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          Abrir o formulário <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {erro && <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">Não consegui carregar: {erro}</div>}
      {carregando && !dados && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {t && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            <Tile label="Visitas" valor={num(t.visitas)} sub="abriram o formulário" />
            <Tile label="Começaram" valor={num(t.comecaram)} sub={`${pct(t.comecaram, t.visitas)}% das visitas`} />
            <Tile label="Enviaram" valor={num(enviaramTotal)} sub={`${pct(enviaramTotal, t.comecaram)}% de quem começou`} tom="bom" />
            <Tile label="Abandonaram" valor={num(t.abandonaram)} sub={`${pct(t.abandonaram, t.comecaram)}% de quem começou`} tom={t.abandonaram ? "ruim" : undefined} />
            <Tile label="Cortados" valor={num(t.cortados_perfil + t.cortados_faturamento)} sub={`${num(t.cortados_perfil)} perfil · ${num(t.cortados_faturamento)} faturamento`} />
            <Tile label="Recuperáveis" valor={num(t.recuperaveis || 0)} sub={`abandonaram com WhatsApp · ${num(t.recuperaveis_pendentes || 0)} sem chamar`} tom={(t.recuperaveis_pendentes || 0) > 0 ? "ruim" : undefined} />
            <Tile label="Preenchendo agora" valor={num(t.preenchendo_agora)} sub="mexeram nos últimos 30 min" />
            <Tile label="Tempo até enviar" valor={t.mediana_seg_envio ? `${Math.round(t.mediana_seg_envio / 60 * 10) / 10} min` : "-"} sub="mediana" />
          </div>

          {pior && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>
                Onde mais gente para: <b>pergunta {pior.q}, {nomePergunta(pior.q)}</b>. {num(pior.pararam)} pessoa{pior.pararam === 1 ? "" : "s"} chegaram nela e não seguiram
                ({pct(pior.pararam, pior.chegaram)}% de quem chegou).
              </span>
            </div>
          )}
          {t.erros > 0 && (
            <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-sm">
              {num(t.erros)} envio{t.erros === 1 ? "" : "s"} deram erro no período: a pessoa preencheu tudo e o lead pode não ter entrado no CRM.
            </div>
          )}

          {pendentes.length > 0 && (
            <Card className="border-amber-500/50">
              <CardContent className="p-4">
                <h3 className="mb-1 font-semibold">Pra recuperar agora</h3>
                <p className="mb-3 text-xs text-muted-foreground">Abandonaram depois de deixar o WhatsApp e ninguém chamou ainda. O botão abre o WhatsApp com a mensagem pronta.</p>
                <div className="space-y-2">
                  {pendentes.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{s.contato_nome || "Sem nome"} <span className="font-normal text-muted-foreground">· {s.contato_whatsapp}</span></div>
                        <div className="text-xs text-muted-foreground">
                          Parou na pergunta {s.max_question}: {nomePergunta(s.max_question)} · {quando(s.updated_at)}{s.utm_campaign ? ` · ${s.utm_campaign}` : ""}
                        </div>
                      </div>
                      <Button asChild size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <a href={linkWhats(s)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" />Chamar no WhatsApp</a>
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => marcarChamado(s)}><Check className="h-3.5 w-3.5" />Já chamei</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="mb-1 flex items-baseline justify-between">
                <h3 className="font-semibold">Funil pergunta a pergunta</h3>
                <span className="text-xs text-muted-foreground">barra = quem chegou na pergunta, sobre quem começou</span>
              </div>
              {t.comecaram === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Ninguém começou o formulário nesse período.</p>
              ) : (
                <>
                  {dados!.perguntas.map((p, i) => {
                    const ant = i === 0 ? t.comecaram : dados!.perguntas[i - 1].chegaram;
                    const passou = pct(p.chegaram, ant);
                    const ehPior = pior?.q === p.q;
                    return (
                      <div key={p.q} className={`rounded-md p-2 ${ehPior ? "bg-red-500/10" : ""}`}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate"><span className="text-muted-foreground">{p.q}.</span> {nomePergunta(p.q)}</span>
                          <span className="shrink-0 tabular-nums text-xs">
                            <b>{num(p.chegaram)}</b> chegaram
                            {i > 0 && <span className={passou < 70 ? "text-red-600" : "text-muted-foreground"}> · {passou}% da anterior</span>}
                            {p.pararam > 0 && <span className="text-red-600"> · {num(p.pararam)} pararam aqui</span>}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${ehPior ? "bg-red-500" : "bg-primary"}`} style={{ width: `${pct(p.chegaram, t.comecaram)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="rounded-md p-2">
                    <div className="mb-1 flex items-center justify-between text-sm font-medium">
                      <span>Enviaram</span>
                      <span className="tabular-nums text-xs"><b>{num(enviaramTotal)}</b> · {pct(enviaramTotal, t.comecaram)}% de quem começou</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct(enviaramTotal, t.comecaram)}%` }} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="p-4">
                <h3 className="mb-2 font-semibold">Por campanha</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-2">Campanha / origem</th><th className="px-2 text-right">Visitas</th><th className="px-2 text-right">Começaram</th>
                      <th className="px-2 text-right">Enviaram</th><th className="px-2 text-right">Conversão</th><th className="pl-2 text-right">Abandonaram</th>
                    </tr></thead>
                    <tbody>
                      {dados!.campanhas.map((c) => (
                        <tr key={c.campanha} className="border-b last:border-0">
                          <td className="max-w-[260px] truncate py-1.5 pr-2" title={c.campanha}>{c.campanha}</td>
                          <td className="px-2 text-right tabular-nums">{num(c.visitas)}</td>
                          <td className="px-2 text-right tabular-nums">{num(c.comecaram)}</td>
                          <td className="px-2 text-right tabular-nums">{num(c.enviaram)}</td>
                          <td className="px-2 text-right tabular-nums">{pct(c.enviaram, c.comecaram)}%</td>
                          <td className="pl-2 text-right tabular-nums text-red-600">{num(c.abandonaram)}</td>
                        </tr>
                      ))}
                      {!dados!.campanhas.length && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sem visitas no período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 font-semibold">Por aparelho</h3>
                <div className="space-y-2 text-sm">
                  {dados!.aparelhos.map((a) => (
                    <div key={a.device} className="flex items-center justify-between">
                      <span className="capitalize">{a.device}</span>
                      <span className="tabular-nums text-xs">{num(a.visitas)} visitas · {num(a.enviaram)} enviaram · <b>{pct(a.enviaram, a.visitas)}%</b></span>
                    </div>
                  ))}
                  {!dados!.aparelhos.length && <p className="text-muted-foreground">Sem visitas no período.</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Visitas recentes</h3>
                <div className="w-56">
                  <SearchableSelect value={filtroSit} onValueChange={setFiltroSit}
                    options={[{ value: "todas", label: "Todas as situações" }, { value: "recuperaveis", label: "Recuperáveis (abandonou com WhatsApp)" }, ...Object.entries(SITUACAO).map(([v, s]) => ({ value: v, label: s.label }))]}
                    placeholder="Situação" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2">Quando</th><th className="px-2">Situação</th><th className="px-2">Parou em</th>
                    <th className="px-2">Respostas</th><th className="px-2">Origem</th><th className="pl-2">Aparelho</th>
                  </tr></thead>
                  <tbody>
                    {recentes.map((s) => {
                      const sit = SITUACAO[s.situacao] || { label: s.situacao, cls: "" };
                      return (
                        <tr key={s.id} className="border-b align-top last:border-0">
                          <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">{quando(s.started_at)}</td>
                          <td className="px-2">
                            <Badge className={`text-[10px] ${sit.cls}`}>{sit.label}</Badge>
                            {s.lead_id && (
                              <button type="button" className="ml-1 text-xs text-primary hover:underline" onClick={() => navigate(`/crm/leads/${s.lead_id}`)}>ver lead</button>
                            )}
                          </td>
                          <td className="px-2 text-xs">
                            {s.max_question > 0 ? <>Pergunta {s.max_question}: {nomePergunta(s.max_question)}</> : <span className="text-muted-foreground">Só abriu</span>}
                            {s.contato_whatsapp && s.situacao !== "enviou" && s.situacao !== "desqualificado" && (
                              <div className="mt-0.5">
                                {s.contato_nome || "Sem nome"} · <a className="text-emerald-600 hover:underline" href={linkWhats(s)} target="_blank" rel="noreferrer">{s.contato_whatsapp}</a>
                                {s.recuperacao_em && <span className="text-muted-foreground"> · chamado {quando(s.recuperacao_em)}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-2">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(s.respostas || {}).map(([k, v]) => (
                                <Badge key={k} variant="outline" className="text-[10px] font-normal">{k}: {v}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="max-w-[200px] truncate px-2 text-xs" title={s.ad_name || s.utm_campaign || ""}>
                            {s.utm_campaign || s.utm_source || <span className="text-muted-foreground">direto</span>}
                          </td>
                          <td className="pl-2 text-xs capitalize">{s.device || "-"}</td>
                        </tr>
                      );
                    })}
                    {!recentes.length && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nenhuma visita nesse filtro.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Abandonou = parou há mais de 30 minutos sem enviar. Nome e WhatsApp só ficam guardados de quem passou da pergunta do WhatsApp; e-mail nunca.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
