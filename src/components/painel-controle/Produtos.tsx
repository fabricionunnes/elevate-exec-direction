// Margem por produto, do jeito honesto: o que dá pra medir por produto (clientes,
// MRR, receita recebida, churn, consultores) e o custo direto só onde existe centro
// de custo com o nome do produto. Custo compartilhado não é rateado.
// Carregado ao abrir a tela (painel_bloco 'produtos').
import type { Ctx } from "./ctx";
import type { ProdutosBloco } from "./tipos";
import { useBloco } from "./bloco";
import { Lk, Nd, Panel, Tabela, Tile } from "./ui";
import { brl, brlFull, fp, mesLabel, num, pct, plural } from "./fmt";
import { LINK } from "./util";

const ROT_CENTRO: Record<string, string> = { direto: "direto, do produto", compartilhado: "compartilhado, sem rateio", sem_centro: "sem centro de custo" };

export function Produtos({ c }: { c: Ctx }) {
  const { mes } = c;
  const { dado: r, erro } = useBloco<ProdutosBloco>("produtos", mes);
  if (erro) return <div className="err">Não consegui carregar os produtos: {erro}</div>;
  if (!r) return <div className="load">Carregando os produtos...</div>;

  const cu = r.custos, t = r.totais;
  const ps = r.produtos;
  const comProjeto = ps.filter((p) => p.clientes != null);
  const maior = [...ps].sort((a, b) => (b.receita ?? 0) - (a.receita ?? 0))[0];

  return (
    <>
      <div className="kg">
        <Tile label="Produtos com cliente ativo" valor={num(comProjeto.length, 0)} sub={`${comProjeto.reduce((s, p) => s + (p.clientes ?? 0), 0)} clientes somando os produtos (cliente com dois produtos conta nos dois)`} onClick={() => c.det("produto_clientes", {}, "Clientes por produto")} />
        <Tile label="Receita recebida no mês" valor={brl(t.receita)} sub={maior?.receita ? `maior: ${maior.produto}, ${brl(maior.receita)} (${fp(pct(maior.receita, t.receita))})` : "nenhuma fatura paga no mês"} onClick={() => c.det("produto_receita", {}, "Faturas pagas no mês, por produto")} />
        <Tile label="Receita sem produto identificado" valor={t.nao_identificado_receita ? brl(t.nao_identificado_receita) : brl(0)} cls={t.nao_identificado_receita && t.nao_identificado_receita > 0.15 * t.receita ? "warn" : ""} sub="fatura cuja descrição não diz o produto e cuja empresa tem mais de um (ou nenhum)" onClick={() => c.det("produto_receita", { produto: "Não identificado" }, "Faturas sem produto identificado")} />
        <Tile label="Custo direto lançado" valor={brl(cu.direto_valor)} sub={`em centro de custo com nome de produto. De ${brl(cu.pago_total)} pagos no mês`} onClick={() => c.det("contas_centro", {}, "Contas pagas no mês, por centro de custo")} />
        <Tile label="Custo compartilhado" valor={brl(cu.compartilhado_valor)} sub="Produto, Administrativo, Comercial, Marketing. Não é rateado entre os produtos" onClick={() => c.det("contas_centro", {}, "Contas pagas no mês, por centro de custo")} />
        <Tile label="Contas sem categoria" valor={num(cu.sem_categoria_n, 0)} cls={cu.sem_categoria_valor > 0.1 * cu.pago_total ? "warn" : ""} sub={`${brl(cu.sem_categoria_valor)} pagos no mês sem categoria. Em aberto sem categoria: ${cu.aberto_sem_categoria_n} (${brl(cu.aberto_sem_categoria_valor)})`} onClick={() => c.det("contas_centro", { grupo: "sem_categoria" }, "Contas pagas no mês sem categoria")} />
      </div>

      <Panel titulo={`Por produto, ${mesLabel(mes)}`} sub="clique no produto pra ver os clientes" cls="wide">
        <Tabela cols={[{ h: "Produto", tl: true }, "Clientes ativos", "Consultores", "MRR que fatura", "Ticket médio", "Recebido no mês", "% da receita", "Churn no mês", "Custo direto", "Margem direta"]}
          onRow={(i) => { const p = ps[i]; if (p.clientes != null) c.det("produto_clientes", { produto: p.produto }, `Clientes · ${p.produto}`); else c.det("produto_receita", { produto: p.produto }, `Faturas pagas · ${p.produto}`); }}
          rows={ps.map((p) => [
            <b>{p.produto}</b>,
            p.clientes == null ? <Nd>sem projeto</Nd> : num(p.clientes, 0), p.consultores == null ? <Nd /> : num(p.consultores, 0),
            p.mrr == null ? <Nd /> : <span title={`${p.mrr_clientes} clientes com mensalidade`}>{brl(p.mrr)}</span>, p.ticket == null ? <Nd /> : brl(p.ticket),
            p.receita == null ? <Nd /> : <Lk onClick={() => c.det("produto_receita", { produto: p.produto }, `Faturas pagas · ${p.produto}`)}>{brl(p.receita)}</Lk>, p.receita == null ? <Nd /> : fp(pct(p.receita, t.receita)),
            p.churn_n == null ? <Nd /> : <Lk onClick={() => c.det("produto_clientes", { produto: p.produto, grupo: "churn" }, `Churn do mês · ${p.produto}`)}>{`${p.churn_n} (${fp(p.churn_pct)})`}</Lk>,
            p.custo_direto == null ? <Nd /> : <Lk onClick={() => c.det("contas_centro", { centro: p.produto }, `Contas pagas · centro ${p.produto}`)}>{brl(p.custo_direto)}</Lk>,
            p.margem_direta == null ? <Nd /> : <b className={p.margem_direta < 0 ? "neg" : "pos"}>{brl(p.margem_direta)}</b>,
          ])} vazio="Nenhum produto com cliente, receita ou custo neste mês." />
        <div className="note">
          <b>Custo direto e margem direta ficam "-" quando não há nada lançado no centro de custo com o nome do produto.</b> Não é zero: é que o custo de entrega (consultores, por exemplo) está no centro compartilhado "Produto" e o painel não rateia.
          Margem direta = recebido no mês menos custo direto do mês. Fatura e cobrança não têm campo de produto: o produto vem do começo da descrição ou do produto único da empresa.
          Churn = projetos do produto encerrados no mês, sobre os ativos mais os encerrados.
        </div>
      </Panel>

      <div className="grid g2">
        <Panel titulo="Pago no mês por centro de custo" sub="clique pra ver as contas">
          <Tabela cols={[{ h: "Centro de custo", tl: true }, { h: "Tipo", tl: true }, "Contas", "Valor", "% do pago"]}
            onRow={(i) => c.det("contas_centro", { centro: cu.por_centro[i].centro }, `Contas pagas · ${cu.por_centro[i].centro}`)}
            rows={cu.por_centro.map((x) => [x.centro, <span className={x.tipo === "direto" ? "" : "nd"}>{ROT_CENTRO[x.tipo]}</span>, num(x.n, 0), brlFull(x.valor), fp(pct(x.valor, cu.pago_total))])}
            vazio="Nenhuma conta paga neste mês." />
          <div className="note">Pra ter margem por produto de verdade, o custo de quem entrega precisa sair do centro "Produto" e ir pro centro do produto que a pessoa atende (ou ser dividido lá no lançamento). <Lk onClick={() => c.abrir(LINK.financeiro)} ext>Abrir Contas a Pagar</Lk></div>
        </Panel>
        <Panel titulo="Pago no mês por categoria" sub="a categoria diz a natureza do gasto, não o produto">
          <Tabela cols={[{ h: "Categoria", tl: true }, "Contas", "Valor", "% do pago"]}
            onRow={(i) => c.det("contas_pagas", { categoria: cu.por_categoria[i].categoria }, `Contas pagas · ${cu.por_categoria[i].categoria}`)}
            rows={cu.por_categoria.map((x) => [x.categoria, num(x.n, 0), brlFull(x.valor), fp(pct(x.valor, cu.pago_total))])} vazio="Nenhuma conta paga neste mês." />
          <div className="note">{plural(cu.sem_categoria_n, "conta paga", "contas pagas")} no mês sem categoria ({brl(cu.sem_categoria_valor)}) e {cu.aberto_sem_categoria_n} em aberto sem categoria ({brl(cu.aberto_sem_categoria_valor)}, quase tudo legado importado). <Lk onClick={() => c.det("contas_centro", { grupo: "sem_categoria" }, "Contas pagas no mês sem categoria")}>Ver as do mês</Lk></div>
        </Panel>
      </div>
    </>
  );
}
