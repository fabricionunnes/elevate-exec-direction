// Dependência do fundador e concentração da carteira.
// Quanto da receita nova passa pela mão do dono e quanto das mensalidades está
// na mão de poucos clientes. Os dois são risco de "empresa de uma pessoa só".
import type { Ctx } from "./ctx";
import type { Frente } from "./tipos";
import { BarrasPilha, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, brlFull, dataBR, fp, mesCurto, mesLabel, num, plural } from "./fmt";
import { LINK } from "./util";

const COR = { fundador: "#CC1B1B", time: "#3F5F9E", sem: "#6b6b6b" };
const cls = (nivel: string | null | undefined) => (nivel === "vermelho" ? "neg" : nivel === "ambar" ? "warn" : nivel === "verde" ? "pos" : "");

/** cartão da faixa "Pra frente" e leitura rápida */
export function fundadorFrase(f: Frente["fundador"] | undefined): { valor: string; sub: string; cls: string } {
  if (!f) return { valor: "-", sub: "indisponível", cls: "" };
  if (f.pct_receita == null) return { valor: "-", sub: "sem venda fechada no mês", cls: "" };
  const d = f.delta_pp;
  const seta = d == null ? "" : d > 0 ? `subiu ${num(Math.abs(d), 0)} pontos` : d < 0 ? `caiu ${num(Math.abs(d), 0)} pontos` : "igual";
  const n = f.mes?.vendas ?? 0;
  // mês com pouca venda ainda: o percentual pula muito, então a base vai junto
  return { valor: fp(f.pct_receita), cls: cls(f.nivel), sub: `da receita nova fechada por ${f.nome.split(" ")[0]}, em ${n} ${n === 1 ? "venda" : "vendas"} no mês${seta ? `. ${seta[0].toUpperCase()}${seta.slice(1)} contra o mês anterior` : ""}. Referência: abaixo de 30%` };
}

export function Fundador({ c }: { c: Ctx }) {
  const { mes } = c;
  const f = c.d.frente?.fundador, co = c.d.frente?.concentracao;
  if (!f || !co) return <div className="err">Esse bloco não veio do banco. Recarregue o painel.</div>;
  const m = f.mes;
  const primeiro = f.nome.split(" ")[0];
  const fr = fundadorFrase(f);
  const maxTop = Math.max(...co.top10.map((t) => t.valor), 1);
  const sem = m?.vendas == null;

  return (
    <>
      <div className="kg">
        <Tile label="Dependência do fundador" valor={fr.valor} cls={fr.cls} sub={fr.sub} onClick={() => c.det("vendas_grupo", { grupo: "fundador" }, `Vendas fechadas por ${primeiro}`)} />
        <Tile label={`Receita fechada por ${primeiro}`} valor={sem ? "-" : brl(m.receita_fundador)} sub={sem ? "sem venda no mês" : `de ${brl(m.receita)} vendidos no mês`} onClick={() => c.det("vendas_grupo", { grupo: "fundador" }, `Vendas fechadas por ${primeiro}`)} />
        <Tile label="Receita fechada pelo time" valor={sem ? "-" : brl(m.receita_time)} sub={sem ? "sem venda no mês" : `${plural(m.vendas_time ?? 0, "venda", "vendas")} · ${fp(m.receita ? (m.receita_time ?? 0) / m.receita : null)} da receita`} onClick={() => c.det("vendas_grupo", { grupo: "time" }, "Vendas fechadas pelo time")} />
        <Tile label="Vendas fechadas por ele" valor={sem ? "-" : fp(m.pct_vendas)} sub={sem ? "sem venda no mês" : `${m.vendas_fundador} de ${m.vendas} vendas${m.vendas_sem_fechador ? ` · ${m.vendas_sem_fechador} sem fechador (site)` : ""}`} onClick={() => c.det("vendas_grupo", {}, "Vendas do mês por quem fechou")} />
        <Tile label="Reuniões realizadas por ele" valor={m?.reunioes == null ? "-" : fp(m.pct_reunioes)} sub={m?.reunioes == null ? "sem reunião realizada no mês" : `${m.reunioes_fundador} de ${m.reunioes} realizadas`} onClick={() => c.det("reunioes", { tipo: "realizadas" }, "Reuniões realizadas")} />
        <Tile label="Maior cliente" valor={co.maior ? fp(co.maior.pct) : "-"} cls={co.maior && co.maior.pct > 0.15 ? "warn" : ""} sub={co.maior ? `${co.maior.empresa}: ${brl(co.maior.valor)} por mês. Alerta acima de 15%` : "sem mensalidade faturando"} onClick={() => c.det("mrr_clientes", { grupo: "base" }, "Mensalidade por cliente")} />
        <Tile label="5 maiores clientes" valor={fp(co.top5_pct)} cls={co.top5_pct != null && co.top5_pct > 0.5 ? "warn" : ""} sub={`${brl(co.top5_valor)} de ${brl(co.mrr_base)} por mês. Alerta acima de 50%`} onClick={() => c.det("mrr_clientes", { grupo: "base" }, "Mensalidade por cliente")} />
      </div>

      <Panel titulo="Receita nova por quem fechou" sub={`últimos 12 meses. Vermelho: ${primeiro}. Azul: time. Cinza: sem fechador (venda do site). Clique num mês pra trocar o painel.`}>
        <BarrasPilha ativo={mes} fmt={(v) => brl(v).replace("R$ ", "")} onItem={c.setMes}
          itens={f.serie.map((s) => ({
            k: s.mes, rot: mesCurto(s.mes),
            partes: s.receita == null ? null : [{ v: s.receita_fundador ?? 0, cor: COR.fundador, nome: primeiro }, { v: s.receita_time ?? 0, cor: COR.time, nome: "time" }, { v: s.receita_sem_fechador ?? 0, cor: COR.sem, nome: "sem fechador" }],
            sub: s.pct_receita == null ? "" : fp(s.pct_receita),
            tip: s.receita == null ? `${mesLabel(s.mes)}: sem venda registrada` : `${mesLabel(s.mes)}: ${brl(s.receita_fundador)} de ${brl(s.receita)} com ${primeiro} (${fp(s.pct_receita)})`,
          }))} />
        <div className="note">Embaixo de cada mês, a parte da receita fechada por {primeiro}. Quem fechou = closer do lead ganho; se vazio, o dono do lead. Abaixo de 30% a empresa vende sem ele; de 30 a 60% depende; acima de 60% para se ele parar.</div>
      </Panel>

      <div className="grid g2">
        <Panel titulo={`Quem fechou em ${mesLabel(mes)}`} sub="clique na linha pra ver as vendas">
          <Tabela cols={[{ h: "Fechador", tl: true }, "Vendas", "Receita", "% da receita", "Ticket médio"]}
            onRow={(i) => { const x = f.por_fechador[i]; c.det("vendas_grupo", { grupo: x.grupo }, x.grupo === "time" ? "Vendas fechadas pelo time" : `Vendas · ${x.nome}`); }}
            rows={f.por_fechador.map((x) => [
              <span><span className="dot" style={{ background: x.grupo === "fundador" ? COR.fundador : x.grupo === "time" ? COR.time : COR.sem }} />{x.nome}</span>,
              num(x.vendas, 0), brlFull(x.receita), fp(m?.receita ? x.receita / m.receita : null), brl(x.vendas ? x.receita / x.vendas : null),
            ])} vazio="Nenhuma venda fechada neste mês." />
        </Panel>
        <Panel titulo="Reuniões realizadas por ele" sub="parte das reuniões do mês em que o dono do lead era o fundador">
          <BarrasPilha ativo={mes} fmt={(v) => num(v, 0)} onItem={c.setMes}
            itens={f.serie.map((s) => ({
              k: s.mes, rot: mesCurto(s.mes),
              partes: s.reunioes == null ? null : [{ v: s.reunioes_fundador ?? 0, cor: COR.fundador, nome: primeiro }, { v: (s.reunioes ?? 0) - (s.reunioes_fundador ?? 0), cor: COR.time, nome: "time" }],
              sub: s.pct_reunioes == null ? "" : fp(s.pct_reunioes),
              tip: s.reunioes == null ? `${mesLabel(s.mes)}: sem reunião realizada` : `${mesLabel(s.mes)}: ${s.reunioes_fundador} de ${s.reunioes} com ${primeiro}`,
            }))} />
        </Panel>
      </div>

      <Panel titulo="Concentração da carteira" sub={`${co.clientes} clientes faturando ${brl(co.mrr_base)} por mês. Clique no cliente pra abrir a ficha.`} cls="wide">
        <Tabela cols={["#", { h: "Cliente", tl: true }, "Mensalidade", "% das mensalidades", "Parcelas geradas até", "Fim do contrato", "Consultor", "Situação"]}
          onRow={(i) => c.abrir(LINK.empresa(co.top10[i].company_id))}
          rows={co.top10.map((t) => [
            t.pos, <Lk ext onClick={() => c.abrir(LINK.empresa(t.company_id))}>{t.empresa}</Lk>, brlFull(t.valor),
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="tr" style={{ width: 90, height: 10 }}><i className={t.pct > 0.15 ? "bad" : ""} style={{ width: `${Math.max((t.valor / maxTop) * 100, 2)}%` }} /></span>{fp(t.pct)}</span>,
            t.parcelas_ate ? dataBR(t.parcelas_ate) : <Nd />, t.contrato_fim ? dataBR(t.contrato_fim) : <Nd>sem data</Nd>, t.consultor ?? <Nd />,
            <St ok={t.pct <= 0.1} warn={t.pct <= 0.15} tg="ok" tw="de olho" tb="acima de 15%" />,
          ])} vazio="Nenhuma mensalidade faturando." />
        <div className="note">
          Base: cobrança recorrente ativa, de empresa ativa e com fatura a vencer. <Lk onClick={() => c.det("mrr_clientes", { grupo: "base" }, "Mensalidade por cliente")}>Ver os {co.clientes} clientes</Lk>.
          {co.fora_n > 0 && <> O MRR do topo do painel ({brl(co.mrr_todas_ativas)}) ainda conta {plural(co.fora_n, "cobrança", "cobranças")} que não fatura mais ({brl(co.fora_valor)}: avulsa de parcela única, plano encerrado ou empresa inativa). <Lk onClick={() => c.det("mrr_clientes", { grupo: "fora" }, "Cobranças ativas que não faturam mais")}>Ver quais são</Lk> e desative no Financeiro.</>}
        </div>
      </Panel>

    </>
  );
}
