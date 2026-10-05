// Saúde da receita recorrente: os dois números de MRR lado a lado, a ponte mês a
// mês (novo, expansão, contração, churn), LTV e CAC, e as renovações que vêm aí.
// Carregado ao abrir a tela (painel_bloco 'receita').
import type { Ctx } from "./ctx";
import type { ReceitaBloco } from "./tipos";
import { useBloco } from "./bloco";
import { BarrasItens, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, brlFull, dataBR, fp, mesCurto, mesLabel, num, plural } from "./fmt";
import { LINK } from "./util";

export function Receita({ c }: { c: Ctx }) {
  const { mes } = c;
  const { dado: r, erro } = useBloco<ReceitaBloco>("receita", mes);
  if (erro) return <div className="err">Não consegui carregar a receita recorrente: {erro}</div>;
  if (!r) return <div className="load">Carregando a receita recorrente...</div>;

  const m = r.mrr, l = r.ltv, rn = r.renovacoes;
  const comDado = r.ponte.filter((p) => p.tem_dado);
  const pm = r.ponte.find((p) => p.mes === mes);
  const cac = c.d.trafego.cac;
  const ltvCac = l.ltv && cac ? l.ltv / cac : null;
  const payback = cac && l.ticket_medio_mensal ? cac / l.ticket_medio_mensal : null;
  const risco = rn.lista.filter((x) => x.grupo === "risco");
  const mov = (tipo: string, titulo: string) => c.det("mrr_movimentos", { tipo }, `${titulo} · ${mesLabel(mes)}`);

  return (
    <>
      <div className="grid g2">
        <Panel titulo="MRR, os dois números" sub="o mesmo cadastro, lido de dois jeitos">
          <Tabela cols={[{ h: "Leitura", tl: true }, "Cobranças", "Por mês"]}
            onRow={(i) => [() => c.det("mrr"), () => c.det("mrr_clientes", { grupo: "base" }, "Mensalidade por cliente (o que fatura)"), () => c.det("mrr_clientes", { grupo: "fora" }, "Cobranças ativas que não faturam mais"), () => c.det("clientes", { tipo: "em_aviso" }, "Clientes em aviso de saída")][i]()}
            hl={1}
            rows={[
              [<span><b>MRR cadastrado</b><br /><span className="nd">cobranças recorrentes mensais marcadas como ativas. É o número do topo do painel e do Dashboard financeiro.</span></span>, num(m.cadastrado_n, 0), brlFull(m.cadastrado)],
              [<span><b>MRR que fatura</b><br /><span className="nd">só cobrança ativa, de empresa ativa, com fatura a vencer. É o usado na ponte e na concentração.</span></span>, num(m.que_fatura_n, 0), brlFull(m.que_fatura)],
              [<span>Diferença<br /><span className="nd">ativas no cadastro que não faturam mais: {brl(m.fora_sem_fatura)} sem fatura a vencer (avulsa ou plano encerrado) e {brl(m.fora_empresa_inativa)} de empresa inativa.</span></span>, num(m.fora_n, 0), <span className="warn">{brlFull(m.fora_valor)}</span>],
              [<span>Dentro do que fatura, em aviso de saída<br /><span className="nd">cliente em aviso ou com sinal de cancelamento.</span></span>, <Nd />, m.em_aviso ? <span className="neg">{brlFull(m.em_aviso)}</span> : brlFull(0)],
            ]} />
          <div className="note">Qual dos dois vira o número oficial é decisão de negócio. Enquanto isso, desativar no Financeiro as {m.fora_n} cobranças da diferença faz os dois baterem. <Lk onClick={() => c.det("mrr_clientes", { grupo: "fora" }, "Cobranças ativas que não faturam mais")}>Ver quais são</Lk> · <Lk onClick={() => c.abrir(LINK.recorrencias)} ext>Recorrências no Nexus</Lk></div>
        </Panel>

        <Panel titulo="LTV, CAC e payback" sub="LTV pela mesma regra da tela inicial do Nexus">
          <Tabela cols={[{ h: "Indicador", tl: true }, "Valor"]} rows={[
            [<span>Tempo médio de permanência<br /><span className="nd">meses desde o início do contrato, {l.empresas_tempo} empresas não inativas</span></span>, l.tempo_medio_meses == null ? <Nd /> : `${num(l.tempo_medio_meses)} meses`],
            [<span>Ticket médio mensal<br /><span className="nd">valor do contrato normalizado pelo ciclo, {l.empresas_ticket} empresas ({l.empresas_fora_ticket} ficam fora: forma de pagamento sem ciclo)</span></span>, brl(l.ticket_medio_mensal)],
            [<b>LTV médio</b>, <b>{brl(l.ltv)}</b>],
            [<span>CAC de {mesLabel(mes)}<br /><span className="nd">só mídia: gasto no Meta dividido pelas vendas do mês</span></span>, cac == null ? <Nd>sem gasto ou sem venda</Nd> : brl(cac)],
            [<span>LTV / CAC<br /><span className="nd">acima de 3x é saudável</span></span>, ltvCac == null ? <Nd /> : <b className={ltvCac >= 3 ? "pos" : ltvCac >= 1 ? "warn" : "neg"}>{num(ltvCac)}x</b>],
            [<span>Payback do CAC<br /><span className="nd">CAC dividido pelo ticket médio mensal</span></span>, payback == null ? <Nd /> : `${num(payback)} ${payback === 1 ? "mês" : "meses"}`],
          ]} />
          <div className="note">O CAC é só mídia e a venda do CRM inclui ingresso de evento, então ele sai baixo e o LTV/CAC sai alto. Serve pra acompanhar a tendência, não pra decidir verba sozinho.</div>
        </Panel>
      </div>

      <div className="kg">
        <Tile label={`Faturado recorrente em ${mesCurto(mes)}`} valor={pm?.tem_dado ? brl(pm.final) : "-"} sub={pm?.tem_dado ? `${pm.clientes_final} clientes. Começou o mês em ${brl(pm.inicial)}` : "sem fatura registrada nesse mês"} onClick={() => c.det("mrr_movimentos", { tipo: "mantido" }, `Clientes que mantiveram · ${mesLabel(mes)}`)} />
        <Tile label="Novo" valor={pm?.tem_dado ? brl(pm.novo + pm.reativacao) : "-"} cls={pm?.tem_dado && pm.novo + pm.reativacao > 0 ? "pos" : ""} sub={pm?.tem_dado ? `${pm.clientes_novos} ${pm.clientes_novos === 1 ? "cliente" : "clientes"}${pm.reativacao ? `, ${brl(pm.reativacao)} de reativação` : ""}` : undefined} onClick={() => mov("novo", "MRR novo")} />
        <Tile label="Expansão" valor={pm?.tem_dado ? brl(pm.expansao) : "-"} sub="cliente que passou a pagar mais" onClick={() => mov("expansao", "Expansão")} />
        <Tile label="Contração" valor={pm?.tem_dado ? brl(pm.contracao) : "-"} cls={pm?.tem_dado && pm.contracao > 0 ? "warn" : ""} sub="cliente que passou a pagar menos" onClick={() => mov("contracao", "Contração")} />
        <Tile label="Churn" valor={pm?.tem_dado ? brl(pm.churn) : "-"} cls={pm?.tem_dado && pm.churn > 0 ? "neg" : ""} sub={pm?.tem_dado ? `${plural(pm.clientes_churn, "cliente parou", "clientes pararam")} de ser faturado` : undefined} onClick={() => mov("churn", "Churn")} />
        <Tile label="Churn de receita" valor={pm?.churn_receita_pct == null ? "-" : fp(pm.churn_receita_pct)} cls={pm?.churn_receita_pct != null && pm.churn_receita_pct > 0.05 ? "neg" : ""} sub={pm?.churn_clientes_pct == null ? "sem base no mês anterior" : `de clientes: ${fp(pm.churn_clientes_pct)} (${pm.clientes_churn} de ${pm.clientes_inicial})`} onClick={() => mov("churn", "Churn")} />
      </div>

      <Panel titulo="Ponte do MRR, mês a mês" sub="faturado recorrente por cliente, comparado com o mês anterior. Clique no mês pra trocar o painel." cls="wide">
        <Tabela cols={[{ h: "Mês", tl: true }, "Inicial", "+ Novo", "+ Reativação", "+ Expansão", "− Contração", "− Churn", "= Final", "Clientes", "Churn de receita", "Churn de clientes"]}
          hl={comDado.findIndex((p) => p.mes === mes)}
          onRow={(i) => c.setMes(comDado[i].mes)}
          rows={comDado.map((p) => [
            `${mesLabel(p.mes)}${p.primeiro ? " (início do registro)" : ""}`, brl(p.inicial), p.novo ? <span className="pos">{brl(p.novo)}</span> : brl(0), p.reativacao ? brl(p.reativacao) : <Nd />, p.expansao ? <span className="pos">{brl(p.expansao)}</span> : <Nd />,
            p.contracao ? <span className="warn">{brl(p.contracao)}</span> : <Nd />, p.churn ? <span className="neg">{brl(p.churn)}</span> : <Nd />, <b>{brl(p.final)}</b>, `${p.clientes_inicial} → ${p.clientes_final}`,
            p.churn_receita_pct == null ? <Nd /> : fp(p.churn_receita_pct), p.churn_clientes_pct == null ? <Nd /> : fp(p.churn_clientes_pct),
          ])} vazio="Nenhuma fatura recorrente registrada nos últimos 12 meses." />
        <div className="note">
          A cobrança recorrente não guarda histórico de valor nem data de cancelamento, então a ponte vem das faturas: o que foi faturado de cada cliente no mês (fora as avulsas: entrada, comissão, cancelamento, renegociação) contra o mês anterior.
          As cobranças entraram no Nexus em maio e junho de 2026: o "novo" desses dois meses é a entrada do cadastro, não venda nova. Cliente que pula um mês de fatura aparece como churn e depois reativação.
        </div>
      </Panel>

      <Panel titulo="Faturado recorrente, mês a mês" sub="o '= Final' da ponte">
        <BarrasItens fmt={(v) => brl(v).replace("R$ ", "")} ativo={mes} onItem={(k) => c.setMes(k)}
          itens={r.ponte.map((p) => ({ k: p.mes, rot: mesCurto(p.mes), v: p.tem_dado ? p.final : null, sub: p.tem_dado ? `${p.clientes_final} cli.` : "", tip: p.tem_dado ? `${mesLabel(p.mes)}: ${brl(p.final)} em ${p.clientes_final} clientes` : `${mesLabel(p.mes)}: sem fatura recorrente registrada` }))} />
      </Panel>

      <div className="kg">
        <Tile label="Renovações em 30 dias" valor={num(rn.em30.n, 0)} cls={rn.em30.n ? "warn" : ""} sub={`${brl(rn.em30.valor)} de contrato com prazo acabando`} onClick={() => c.det("renovacoes", { dias: "30", grupo: "risco" }, "Contratos com prazo vencendo em 30 dias")} />
        <Tile label="Em 60 dias" valor={num(rn.em60.n, 0)} sub={`${brl(rn.em60.valor)} em risco`} onClick={() => c.det("renovacoes", { dias: "60", grupo: "risco" }, "Contratos com prazo vencendo em 60 dias")} />
        <Tile label="Em 90 dias" valor={num(rn.em90.n, 0)} sub={`${brl(rn.em90.valor)} em risco`} onClick={() => c.det("renovacoes", { dias: "90", grupo: "risco" }, "Contratos com prazo vencendo em 90 dias")} />
        <Tile label="Mensais com aniversário em 90 dias" valor={num(rn.mensais_n, 0)} sub={`${brl(rn.mensais_valor)} por mês. Plano mensal renova sozinho, não vence`} onClick={() => c.det("renovacoes", { dias: "90", grupo: "mensal" }, "Planos mensais com aniversário de contrato em 90 dias")} />
      </div>

      <Panel titulo="Contratos com prazo vencendo em 90 dias" sub="clique no cliente pra abrir a ficha" cls="wide">
        <Tabela cols={[{ h: "Cliente", tl: true }, "Fim", "Em", { h: "De onde vem o prazo", tl: true }, "Plano", "Valor em risco", "Mensalidade ativa", "Consultor", "Situação"]}
          onRow={(i) => c.abrir(LINK.empresa(risco[i].company_id))}
          rows={risco.map((x) => [
            <Lk ext onClick={() => c.abrir(LINK.empresa(x.company_id))}>{x.empresa}</Lk>, dataBR(x.fim), `${x.dias} ${x.dias === 1 ? "dia" : "dias"}`, x.origem, x.plano ?? <Nd />,
            x.valor == null ? <Nd>sem valor no cadastro</Nd> : brlFull(x.valor), x.mensalidade ? brlFull(x.mensalidade) : <Nd />, x.consultor ?? <Nd />,
            <St ok={x.dias > 60} warn={x.dias > 30 && !String(x.projeto_status ?? "").includes("notice")} tg="tem tempo" tw="marcar renovação" tb={String(x.projeto_status ?? "").includes("notice") ? "em aviso de saída" : "vence em 30 dias"} />,
          ])} vazio="Nenhum contrato com prazo vence nos próximos 90 dias." />
        <div className="note">Plano mensal (renewal_plan_type) renova sozinho e não entra como risco. Entra o contrato com prazo: empresa trimestral, semestral ou anual, ou projeto com termo fechado, mesmo que a empresa esteja cadastrada como mensal (aí as duas informações se contradizem e vale conferir). <Lk onClick={() => c.det("renovacoes", { dias: "90" }, "Fim de contrato nos próximos 90 dias")}>Ver todos, com os mensais</Lk></div>
      </Panel>
    </>
  );
}
