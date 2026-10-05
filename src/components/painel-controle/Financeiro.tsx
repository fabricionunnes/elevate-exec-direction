// Financeiro: caixa do mês, mês a mês, por empresa, por categoria, vencidas, a pagar, bancos.
import type { Ctx } from "./ctx";
import { Barras, Lk, Nd, Panel, Tabela, Tile } from "./ui";
import { brl, dataBR, dataHoraBR, fp, kfmt, num, pct, plural } from "./fmt";
import { LINK } from "./util";
import { caixaFrase } from "./Caixa";

export function Financeiro({ c }: { c: Ctx }) {
  const { d, mes } = c;
  const fin = d.financeiro;
  const lucroCls = fin.lucro < 0 ? "neg" : "";
  return (
    <>
      <div className="kg">
        <Tile label="Lucro do mês (caixa)" valor={brl(fin.lucro)} cls={lucroCls} sub="recebido menos pago" onClick={() => c.det("faturas_pagas")} />
        <Tile label="Recebido" valor={brl(fin.recebido)} sub={plural(fin.recebido_n, "fatura paga", "faturas pagas")} onClick={() => c.det("faturas_pagas")} />
        <Tile label="Pago" valor={brl(fin.pago)} sub={plural(fin.pago_n, "conta quitada", "contas quitadas")} onClick={() => c.det("contas_pagas")} />
        <Tile label="A receber no mês" valor={brl(fin.a_receber)} sub={plural(fin.a_receber_n, "fatura em aberto", "faturas em aberto")} onClick={() => c.det("faturas_a_receber")} />
        <Tile label="Vencido (acumulado)" valor={brl(fin.vencidas)} sub={`${plural(fin.vencidas_n, "fatura", "faturas")} · ${brl(fin.vencidas_7d)} há mais de 7 dias`} onClick={() => c.det("faturas_vencidas")} />
        <Tile label="A pagar no mês" valor={brl(fin.a_pagar)} sub={plural(fin.a_pagar_n, "conta", "contas")} onClick={() => c.det("contas_a_pagar")} />
        <Tile label="Vence em 3 dias" valor={brl(fin.a_pagar_3d)} sub={`${plural(fin.a_pagar_3d_n, "conta", "contas")} · ${brl(fin.a_pagar_7d)} em 7 dias`} onClick={() => c.det("contas_a_pagar")} />
        <Tile label="Saldo nos bancos" valor={brl(fin.saldo_bancos)} sub={`${fin.bancos.length} contas ativas`} onClick={() => c.det("bancos")} />
        <Tile label="MRR" valor={brl(fin.mrr)} sub={<>{plural(fin.mrr_n, "mensalidade ativa", "mensalidades ativas")}{d.frente?.concentracao && <><br /><span className="nd">{brl(d.frente.concentracao.mrr_base)} com fatura a vencer</span></>}</>} onClick={() => c.go({ view: "receita" })} />
        {(() => { const f = caixaFrase(d.frente?.caixa); return <Tile label="Caixa em 30 dias (projeção)" valor={f.valor} cls={f.cls} sub={f.sub} onClick={() => c.go({ view: "caixa" })} />; })()}
        <Tile label="MRR em aviso de saída" valor={brl(fin.mrr_em_aviso)} sub="clientes em aviso ou com sinal de cancelamento" onClick={() => c.det("clientes", { tipo: "em_aviso" }, "Clientes em aviso de saída")} />
      </div>

      <div className="grid g2">
        <Panel titulo="Recebido mês a mês" sub="faturas pagas por mês de pagamento"><Barras serie={d.serie} mes={mes} fn={(m) => m.recebido} fmt={kfmt} sub={(m) => (m.recebido_n ? `${m.recebido_n} fat.` : "")} onMes={c.setMes} /></Panel>
        <Panel titulo="Pago mês a mês" sub="contas quitadas por mês de pagamento"><Barras serie={d.serie} mes={mes} fn={(m) => m.pago} fmt={kfmt} onMes={c.setMes} /></Panel>
      </div>
      <Panel titulo="Lucro (caixa) mês a mês" sub="recebido menos pago. Vermelho = mês negativo"><Barras serie={d.serie} mes={mes} fn={(m) => m.lucro} fmt={kfmt} permiteNegativo onMes={c.setMes} /></Panel>

      <div className="grid g2">
        <Panel titulo="Recebido por empresa" sub="clique na empresa pra ver as faturas">
          <Tabela cols={[{ h: "Empresa", tl: true }, "Faturas", "Valor", "% do mês"]} rows={fin.recebido_por_empresa.map((x) => [
            <Lk onClick={() => c.det("faturas_pagas", { company_id: x.company_id }, `Faturas pagas · ${x.empresa}`)}>{x.empresa}</Lk>, num(x.n, 0), brl(x.valor), fp(pct(x.valor, fin.recebido)),
          ])} />
        </Panel>
        <Panel titulo="Pago por categoria" sub="clique na categoria pra ver as contas">
          <Tabela cols={[{ h: "Categoria", tl: true }, "Contas", "Valor", "% do mês"]} rows={fin.pago_por_categoria.map((x) => [
            <Lk onClick={() => c.det("contas_pagas", { categoria: x.categoria }, `Contas pagas · ${x.categoria}`)}>{x.categoria}</Lk>, num(x.n, 0), brl(x.valor), fp(pct(x.valor, fin.pago)),
          ])} />
          {fin.pago_por_categoria.length === 1 && fin.pago_por_categoria[0].categoria === "Sem categoria" && <div className="note">Todas as contas pagas estão sem categoria. Classificar no Financeiro deixa o DRE legível.</div>}
        </Panel>
      </div>

      <div className="grid g2">
        <Panel titulo="Faturas vencidas" sub={`${fin.vencidas_n} faturas · ${brl(fin.vencidas)}`}>
          <Tabela cols={[{ h: "Empresa", tl: true }, "Valor", "Vencimento", "Atraso"]} rows={fin.vencidas_lista.slice(0, 12).map((x) => [
            <Lk onClick={() => c.det("faturas_vencidas", { company_id: x.company_id }, `Faturas vencidas · ${x.empresa}`)}>{x.empresa}</Lk>, brl(x.valor), dataBR(x.vencimento), `${x.dias} d`,
          ])} vazio="Nenhuma fatura vencida." />
          {fin.vencidas_lista.length > 12 && <Lk onClick={() => c.det("faturas_vencidas")}>Ver todas as {fin.vencidas_n}</Lk>}
        </Panel>
        <Panel titulo="Contas a pagar" sub="atrasadas, do mês e dos próximos dias">
          <Tabela cols={[{ h: "Fornecedor", tl: true }, "Valor", "Vencimento", "Situação"]} rows={fin.a_pagar_lista.slice(0, 12).map((x) => {
            const dias = Math.round((new Date(`${x.vencimento}T12:00:00`).getTime() - new Date(`${d.hoje}T12:00:00`).getTime()) / 86400000);
            return [<span title={x.descricao}>{x.fornecedor || x.descricao}</span>, brl(x.valor), dataBR(x.vencimento), dias < 0 ? <span className="st r">atrasada {-dias} d</span> : dias <= 3 ? <span className="st a">em {dias} d</span> : <span className="st n">em {dias} d</span>];
          })} vazio="Nenhuma conta em aberto." />
          {fin.a_pagar_lista.length > 12 && <Lk onClick={() => c.det("contas_a_pagar")}>Ver todas</Lk>}
        </Panel>
      </div>

      <Panel titulo="Bancos" sub="saldo do Nexus e do provedor, quando existe">
        <Tabela cols={[{ h: "Banco", tl: true }, "Saldo no Nexus", "Saldo no provedor", "Atualizado"]} onRow={() => c.det("bancos")} rows={fin.bancos.map((b) => [
          b.nome, brl(b.saldo), b.saldo_provedor == null ? <Nd>sem integração</Nd> : brl(b.saldo_provedor), b.atualizado_em ? dataHoraBR(b.atualizado_em) : <Nd />,
        ])} />
        <div className="note">Saldo "no Nexus" é o que o sistema calcula pelas baixas. Só o Asaas informa o saldo real. <Lk onClick={() => c.abrir(LINK.financeiro)} ext>Abrir Financeiro no Nexus</Lk></div>
      </Panel>
    </>
  );
}
