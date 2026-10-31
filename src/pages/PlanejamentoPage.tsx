// Planejamento anual (31/10/2026): o plano do ano lado a lado com o que o
// sistema já realizou. Serve qualquer ano; o planejado é editável e as contas
// refazem na hora. Só o master vê, igual ao Painel de Controle.
//
// Premissas, as mesmas do Painel de Controle: regime de CAIXA — receita é
// company_invoices e financial_receivables pagas (paid_at / paid_date), despesa
// é financial_payables paga (paid_date). Mês sem lançamento mostra "-", nunca
// zero falso. O realizado é lido do banco, nunca digitado.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { toast } from "sonner";
import "@/components/painel-controle/painel.css";
import "@/components/planejamento/planejamento.css";
import { brl, fp } from "@/components/painel-controle/fmt";
import { Combo, Panel, Tile } from "@/components/painel-controle/ui";
import { Grade, planejadoDe, realizadoDa, receitaPlanejadaMes, soma, type Visao } from "@/components/planejamento/Grade";
import { BarrasPlano } from "@/components/planejamento/BarrasPlano";
import { GRUPOS, type Ano, type Linha, type Realizado } from "@/components/planejamento/tipos";
import { Participacao, type SocioConfig, type Trimestre } from "@/components/planejamento/Participacao";
import { PlanoSetores, type Acao } from "@/components/planejamento/PlanoSetores";

const VISOES: { k: Visao; rot: string }[] = [
  { k: "ambos", rot: "Planejado e realizado" },
  { k: "planejado", rot: "Só o planejado" },
  { k: "realizado", rot: "Só o realizado" },
];

export default function PlanejamentoPage() {
  const navigate = useNavigate();
  const { loading: authLoading, isMaster } = useStaffPermissions();

  const [anos, setAnos] = useState<Ano[]>([]);
  const [ano, setAno] = useState<number>(new Date().getFullYear() + 1);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [realizado, setRealizado] = useState<Realizado>({});
  const [visao, setVisao] = useState<Visao>("ambos");
  const [editando, setEditando] = useState(false);
  const [sujo, setSujo] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<"plano" | "acoes" | "socio">("plano");
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [socio, setSocio] = useState<{ config: SocioConfig; trimestres: Trimestre[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const hoje = new Date();
  const anoCorrente = ano === hoje.getFullYear();
  const mesAtual = anoCorrente ? hoje.getMonth() : -1;

  // lista de anos disponíveis
  useEffect(() => {
    if (authLoading || !isMaster) return;
    (async () => {
      const { data, error } = await (supabase as any).from("planejamento_anos").select("*").order("ano", { ascending: false });
      if (error) { setErro(error.message); return; }
      const lista = (data ?? []) as Ano[];
      setAnos(lista);
      if (lista.length && !lista.some((a) => a.ano === ano)) setAno(lista[0].ano);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isMaster]);

  const carregar = useCallback(async (a: number) => {
    setCarregando(true);
    setErro(null);
    const [ls, rz] = await Promise.all([
      (supabase as any).from("planejamento_linhas").select("*").eq("ano", a).order("grupo").order("ordem"),
      (supabase as any).rpc("planejamento_realizado", { p_ano: a }),
    ]);
    if (ls.error) { setErro(ls.error.message); setCarregando(false); return; }
    setLinhas((ls.data ?? []).map((l: any) => ({ ...l, valores: (l.valores ?? []).map(Number) })) as Linha[]);
    // o realizado é extra: se falhar, o plano ainda serve
    if (rz.error) toast.error("Não consegui carregar o realizado: " + rz.error.message);
    setRealizado((rz.data ?? {}) as Realizado);
    // a participação é opcional: ano sem regra cadastrada simplesmente não mostra a aba
    setSocio(pt.error || !pt.data?.config ? null : (pt.data as { config: SocioConfig; trimestres: Trimestre[] }));
    setAcoes((ac.error ? [] : ac.data ?? []) as Acao[]);
    setSujo(new Set());
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (authLoading || !isMaster) return;
    carregar(ano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, authLoading, isMaster]);

  const mudarValor = (id: string, mes: number, valor: number) => {
    setLinhas((ls) => ls.map((l) => {
      if (l.id !== id) return l;
      const v = [...l.valores];
      v[mes] = Number.isFinite(valor) ? valor : 0;
      return { ...l, valores: v };
    }));
    setSujo((s) => new Set(s).add(id));
  };

  const salvar = async () => {
    if (!sujo.size) { setEditando(false); return; }
    setSalvando(true);
    const alterar = linhas.filter((l) => sujo.has(l.id));
    const erros: string[] = [];
    for (const l of alterar) {
      const { error } = await (supabase as any).from("planejamento_linhas").update({ valores: l.valores }).eq("id", l.id);
      if (error) erros.push(`${l.linha}: ${error.message}`);
    }
    setSalvando(false);
    if (erros.length) { toast.error(`Não salvou ${erros.length} linha(s)`); return; }
    toast.success(`${alterar.length} linha(s) salva(s)`);
    setSujo(new Set());
    setEditando(false);
  };

  // status da ação salva na hora: é um clique, não precisa de modo de edição
  const mudarStatus = async (id: string, status: Acao["status"]) => {
    const antes = acoes;
    setAcoes((as) => as.map((a) => (a.id === id ? { ...a, status } : a)));
    const { error } = await (supabase as any).from("planejamento_acoes").update({ status }).eq("id", id);
    if (error) { setAcoes(antes); toast.error("Não consegui salvar: " + error.message); }
  };

  const descartar = () => { setEditando(false); carregar(ano); };

  const criarAno = async () => {
    const novo = (anos[0]?.ano ?? hoje.getFullYear()) + 1;
    const { error } = await (supabase as any).from("planejamento_anos").insert({ ano: novo, titulo: `Planejamento ${novo}` });
    if (error) { toast.error(error.message); return; }
    // copia a estrutura do ano atual, zerada: o esqueleto é o mesmo todo ano
    if (linhas.length) {
      const base = linhas.map((l) => ({
        ano: novo, grupo: l.grupo, linha: l.linha, fonte: l.fonte, unidade: l.unidade,
        ordem: l.ordem, acumulacao: l.acumulacao, valores: Array(12).fill(0), observacao: l.observacao,
      }));
      const { error: e2 } = await (supabase as any).from("planejamento_linhas").insert(base);
      if (e2) toast.error("Ano criado, mas as linhas não copiaram: " + e2.message);
    }
    toast.success(`Planejamento de ${novo} criado com as mesmas linhas, zerado`);
    setAnos((a) => [{ ano: novo, titulo: `Planejamento ${novo}`, observacao: null, atualizado_em: new Date().toISOString() }, ...a]);
    setAno(novo);
  };

  // ---------------------------------------------------------------- resumos
  const resumo = useMemo(() => {
    const porGrupo = (g: string) => linhas.filter((l) => l.grupo === g);
    const receitaMes = receitaPlanejadaMes(linhas);
    // imposto e filantropia são percentual da receita: têm que acompanhar a edição
    const planMes = (ls: Linha[]) => Array.from({ length: 12 }, (_, i) =>
      ls.reduce((a, l) => a + planejadoDe(l, receitaMes)[i], 0));
    const rzMes = (ls: Linha[]) => Array.from({ length: 12 }, (_, i) => {
      const vs = ls.map((l) => realizadoDa(l, realizado)[i]).filter((v): v is number => v != null);
      return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
    });

    const rec = porGrupo("receita"), cus = porGrupo("custo"), res = porGrupo("reserva");
    const recP = planMes(rec), recR = rzMes(rec);
    const cusP = planMes(cus), cusR = rzMes(cus);
    const resP = planMes(res);
    const somaN = (v: (number | null)[]) => v.filter((x): x is number => x != null).reduce((a, b) => a + b, 0);

    const recPA = soma(recP), recRA = somaN(recR);
    const cusPA = soma(cusP), cusRA = somaN(cusR);
    const lucroP = recPA - cusPA - soma(resP);
    const lucroR = recRA - cusRA;

    // meses já encerrados: é contra eles que o realizado deve ser medido
    const fechados = anoCorrente ? hoje.getMonth() : ano < hoje.getFullYear() ? 12 : 0;
    const recPAte = recP.slice(0, fechados).reduce((a, b) => a + b, 0);
    const recRAte = somaN(recR.slice(0, fechados));

    return { recP, recR, cusP, cusR, recPA, recRA, cusPA, cusRA, lucroP, lucroR, fechados, recPAte, recRAte };
  }, [linhas, realizado, ano, anoCorrente]);

  if (authLoading) return null;
  if (!isMaster) return <Navigate to="/" replace />;

  const semPlano = !carregando && linhas.length === 0;

  return (
    <div className="pc">
      <div className="wrap">
        <div className="top">
          <button type="button" className="brand" onClick={() => navigate("/onboarding-tasks")} title="Voltar ao Nexus">
            <div className="lg">UNV</div>
            <div className="wm">NEXUS<small>PLANEJAMENTO</small></div>
          </button>
          <div className="sep" />
          <div className="ttl">Planejado contra realizado<b>{anos.find((a) => a.ano === ano)?.titulo ?? `Planejamento ${ano}`}</b></div>
          <div className="ctl">
            <Combo
              k="ano"
              label="Ano"
              value={String(ano)}
              opts={anos.map((a) => ({ value: String(a.ano), label: String(a.ano) }))}
              onChange={(v) => { if (editando) { toast.error("Salve ou descarte a edição antes de trocar de ano"); return; } setAno(Number(v)); }}
            />
            {editando ? (
              <>
                <button type="button" className="back acc" onClick={salvar} disabled={salvando} style={{ marginTop: 14 }}>
                  {salvando ? "Salvando..." : sujo.size ? `Salvar ${sujo.size} linha(s)` : "Salvar"}
                </button>
                <button type="button" className="back" onClick={descartar} disabled={salvando} style={{ marginTop: 14 }}>Descartar</button>
              </>
            ) : (
              <>
                <button type="button" className="back acc" onClick={() => setEditando(true)} style={{ marginTop: 14 }}>Editar o planejado</button>
                <button type="button" className="back" onClick={criarAno} style={{ marginTop: 14 }} title="Cria o próximo ano com as mesmas linhas, zerado">Novo ano</button>
              </>
            )}
            <button type="button" className="back" onClick={() => navigate("/onboarding-tasks")} style={{ marginTop: 14 }}>Voltar ao Nexus</button>
          </div>
          <div className="src">
            <span className={`dot ${erro ? "r" : "g"}`} />
            {erro ? erro : "realizado lido do banco, em regime de caixa"}
            <br />receita por data de pagamento, despesa por data de baixa
          </div>
        </div>

        {carregando && <div className="p"><div className="sub">Carregando...</div></div>}

        {semPlano && (
          <div className="p">
            <div className="h"><b>Nenhuma linha em {ano}</b></div>
            <div className="sub">Esse ano ainda não tem plano. Use "Novo ano" a partir de um ano que já tenha as linhas, ou crie as linhas no banco.</div>
          </div>
        )}

        {!carregando && !semPlano && (socio || acoes.length > 0) && (
          <div className="pl-abas">
            <button type="button" className={aba === "plano" ? "on" : ""} onClick={() => setAba("plano")}>Os números</button>
            {acoes.length > 0 && <button type="button" className={aba === "acoes" ? "on" : ""} onClick={() => setAba("acoes")}>Plano por setor</button>}
            <button type="button" className={aba === "socio" ? "on" : ""} onClick={() => setAba("socio")}>Minha participação</button>
          </div>
        )}

        {!carregando && !semPlano && aba === "acoes" && (
          <PlanoSetores acoes={acoes} onStatus={mudarStatus} />
        )}

        {!carregando && !semPlano && aba === "socio" && socio && (
          <Participacao
            config={socio.config}
            trimestres={socio.trimestres}
            ano={ano}
            proLabore={proLaboreAno}
          />
        )}

        {!carregando && !semPlano && aba === "plano" && (
          <>
            <div className="grid k5">
              <Tile
                main
                label={`Receita planejada ${ano}`}
                valor={brl(resumo.recPA)}
                sub={<>realizado {brl(resumo.recRA)} · {fp(resumo.recPA ? resumo.recRA / resumo.recPA : null)} do ano</>}
              />
              <Tile
                label="No que já fechou"
                valor={resumo.fechados ? fp(resumo.recPAte ? resumo.recRAte / resumo.recPAte : null) : "-"}
                sub={resumo.fechados
                  ? <>{brl(resumo.recRAte)} de {brl(resumo.recPAte)} em {resumo.fechados} {resumo.fechados === 1 ? "mês" : "meses"}</>
                  : "o ano ainda não começou"}
                cls={resumo.fechados && resumo.recPAte && resumo.recRAte / resumo.recPAte < 0.9 ? "neg" : resumo.fechados ? "pos" : undefined}
              />
              <Tile label="Custos planejados" valor={brl(resumo.cusPA)} sub={<>realizado {brl(resumo.cusRA)}</>} />
              <Tile
                label="Lucro planejado"
                valor={brl(resumo.lucroP)}
                sub={<>{fp(resumo.recPA ? resumo.lucroP / resumo.recPA : null)} da receita</>}
              />
              <Tile
                label="Lucro realizado"
                valor={resumo.recRA || resumo.cusRA ? brl(resumo.lucroR) : "-"}
                sub={resumo.recRA || resumo.cusRA ? <>receita menos despesa paga</> : "sem lançamento no ano"}
                cls={resumo.lucroR < 0 ? "neg" : "pos"}
              />
            </div>

            <div className="grid g2">
              <Panel titulo="Receita mês a mês" sub="moldura é o plano, barra é o que entrou">
                <BarrasPlano plan={resumo.recP} real={resumo.recR} fmt={(v) => (v == null ? "-" : brl(v))} />
              </Panel>
              <Panel titulo="Custos mês a mês" sub="passar do plano aqui é ruim">
                <BarrasPlano plan={resumo.cusP} real={resumo.cusR} fmt={(v) => (v == null ? "-" : brl(v))} bomSubir={false} />
              </Panel>
            </div>

            <Panel
              titulo="O plano linha por linha"
              sub={editando ? "clique numa célula e digite; o total refaz na hora" : `${linhas.length} linhas`}
            >
              <div className="pl-abas" style={{ marginBottom: 12 }}>
                {VISOES.map((v) => (
                  <button key={v.k} type="button" className={visao === v.k ? "on" : ""} onClick={() => setVisao(v.k)}>{v.rot}</button>
                ))}
              </div>
              <Grade
                linhas={linhas}
                realizado={realizado}
                visao={visao}
                editando={editando}
                mesAtual={mesAtual}
                anoCorrente={anoCorrente}
                onValor={mudarValor}
                onDetalhe={(l) => toast.message(l.linha, { description: l.observacao ?? (l.fonte ? `realizado vem de ${l.fonte}` : "linha só do plano") })}
              />
              <div className="pl-aviso">
                <b>De onde vem o realizado:</b> receita é fatura e recebível com status pago, pela data do pagamento.
                Despesa é conta a pagar baixada, pela data da baixa. White-label fica de fora dos dois.
                É o mesmo regime de caixa do Painel de Controle; a receita aqui soma também os recebíveis avulsos,
                que o card "Recebido" do painel não conta, igual ao DRE gerencial.
                Linha marcada como "só no plano" não tem conta equivalente no sistema e fica sem realizado.
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
