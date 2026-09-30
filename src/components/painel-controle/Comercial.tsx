// Comercial: SDRs, closers, funis, reuniões e vendas. Filtros por funil,
// closer e SDR aplicados nas listas do mês (vendas_lista e reunioes_lista).
import { useMemo } from "react";
import type { Ctx } from "./ctx";
import { Barras, Combo, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, dataBR, dataHoraBR, eventoLabel, fp, kfmt, num, pct } from "./fmt";
import { LINK } from "./util";

export function filtrosComercial(c: Ctx) {
  const com = c.d.comercial;
  return (
    <>
      <Combo k="funil" label="Funil" value={String(c.f.funil ?? "")} todos="Todos os funis" opts={com.por_funil.map((p) => ({ value: p.id, label: p.nome }))} onChange={(v) => c.setF({ ...c.f, funil: v })} />
      <Combo k="closer" label="Closer" value={String(c.f.closer ?? "")} todos="Todos os closers" opts={com.por_closer.map((p) => ({ value: p.id, label: p.nome }))} onChange={(v) => c.setF({ ...c.f, closer: v })} />
      <Combo k="sdr" label="Quem agendou" value={String(c.f.sdr ?? "")} todos="Todos" opts={com.por_sdr.map((p) => ({ value: p.id, label: p.nome }))} onChange={(v) => c.setF({ ...c.f, sdr: v })} />
    </>
  );
}

export function Comercial({ c }: { c: Ctx }) {
  const { d, mes, f } = c;
  const com = d.comercial;
  const nomeFunil = com.por_funil.find((p) => p.id === f.funil)?.nome;
  const nomeCloser = com.por_closer.find((p) => p.id === f.closer)?.nome;
  const nomeSdr = com.por_sdr.find((p) => p.id === f.sdr)?.nome;
  const temFiltro = !!(nomeFunil || nomeCloser || nomeSdr);

  const k = useMemo(() => {
    const vd = com.vendas_lista.filter((v) => (!nomeFunil || v.funil === nomeFunil) && (!nomeCloser || v.closer === nomeCloser) && (!nomeSdr || v.sdr === nomeSdr));
    const ev = com.reunioes_lista.filter((e) => (!nomeFunil || e.funil === nomeFunil) && (!nomeCloser || e.closer === nomeCloser) && (!nomeSdr || e.sdr === nomeSdr));
    const ag = ev.filter((e) => e.tipo === "scheduled").length;
    const re = ev.filter((e) => e.tipo === "realized" || e.tipo === "realized_out_of_icp").length;
    const ns = ev.filter((e) => e.tipo === "no_show").length;
    const icp = ev.filter((e) => e.tipo === "out_of_icp" || e.tipo === "realized_out_of_icp").length;
    const fat = vd.reduce((s, v) => s + (Number(v.valor) || 0), 0);
    const leads = nomeFunil ? com.por_funil.find((p) => p.nome === nomeFunil)?.leads ?? null : (nomeCloser || nomeSdr ? null : com.leads_inflow);
    return { vd, ev, ag, re, ns, icp, fat, leads, presenca: re + ns ? re / (re + ns) : null, conv: re ? vd.length / re : null, ticket: vd.length ? fat / vd.length : null };
  }, [com, nomeFunil, nomeCloser, nomeSdr]);

  const filtroDet = { pipeline_id: f.funil || undefined, closer_id: f.closer || undefined, sdr_id: f.sdr || undefined };
  const sufixo = temFiltro ? ` · ${[nomeFunil, nomeCloser, nomeSdr].filter(Boolean).join(", ")}` : "";

  return (
    <>
      {temFiltro && <div className="note" style={{ border: 0, margin: 0, padding: 0 }}>Filtro ativo: {[nomeFunil, nomeCloser && `closer ${nomeCloser}`, nomeSdr && `agendou ${nomeSdr}`].filter(Boolean).join(" · ")}. <Lk onClick={() => c.setF({})}>Limpar</Lk></div>}
      <div className="kg">
        <Tile label="Leads no mês" valor={num(k.leads, 0)} sub={nomeFunil ? "no funil filtrado" : nomeCloser || nomeSdr ? "leads não têm closer no cadastro" : `funis que contam · ${num(com.leads, 0)} no total`} onClick={() => c.det("leads", { pipeline_id: f.funil || undefined }, `Leads do mês${nomeFunil ? ` · ${nomeFunil}` : ""}`)} />
        <Tile label="Reuniões agendadas" valor={num(k.ag, 0)} sub="eventos de agendamento" onClick={() => c.det("reunioes", { ...filtroDet, tipo: "scheduled" }, `Reuniões agendadas${sufixo}`)} />
        <Tile label="Realizadas" valor={num(k.re, 0)} sub={`${fp(k.presenca)} de presença`} onClick={() => c.det("reunioes", { ...filtroDet, tipo: "realizadas" }, `Reuniões realizadas${sufixo}`)} />
        <Tile label="No-show" valor={num(k.ns, 0)} sub={fp(k.presenca == null ? null : 1 - k.presenca) + " das que tiveram desfecho"} onClick={() => c.det("reunioes", { ...filtroDet, tipo: "no_show" }, `No-show${sufixo}`)} />
        <Tile label="Fora do ICP" valor={num(k.icp, 0)} sub="reuniões com lead fora do perfil" onClick={() => c.det("reunioes", { ...filtroDet, tipo: "fora_icp" }, `Fora do ICP${sufixo}`)} />
        <Tile label="Vendas" valor={num(k.vd.length, 0)} sub={`${fp(k.conv)} das realizadas`} onClick={() => c.det("vendas", filtroDet, `Vendas${sufixo}`)} />
        <Tile label="Receita vendida" valor={brl(k.fat)} sub={`ticket médio ${brl(k.ticket)}`} onClick={() => c.det("vendas", filtroDet, `Vendas${sufixo}`)} />
        <Tile label="Ganhos sem valor" valor={num(com.ganhos_sem_valor, 0)} sub="lead ganho com valor zerado" onClick={() => c.det("vendas", filtroDet)} />
      </div>

      <Panel titulo="Closers" sub="reuniões realizadas como dono do lead, vendas e valor. Clique no nome pra filtrar, na linha pra ver as vendas.">
        <Tabela cols={[{ h: "Closer", tl: true }, "Realizadas", "No-show", "Vendas", "Reunião → venda", "Receita", "Ticket médio", "Situação"]}
          hl={com.por_closer.findIndex((s) => s.id === f.closer)}
          onRow={(i) => c.det("vendas", { closer_id: com.por_closer[i].id }, `Vendas · ${com.por_closer[i].nome}`)}
          rows={com.por_closer.map((s) => [
            <Lk onClick={() => c.setF({ ...f, closer: s.id })}>{s.nome}</Lk>, num(s.realizadas, 0), num(s.no_show, 0), num(s.vendas, 0), fp(s.realizadas ? Math.min(s.vendas / s.realizadas, 1) : null), brl(s.receita), brl(s.vendas ? s.receita / s.vendas : null),
            s.realizadas === 0 && s.vendas === 0 ? <Nd>sem atividade</Nd> : <St ok={s.realizadas > 0 && s.vendas / s.realizadas >= 0.25} warn={s.vendas > 0} tg="convertendo" tw="abaixo de 25%" tb="sem venda" />,
          ])} />
      </Panel>

      <Panel titulo="Quem agenda" sub="reuniões creditadas a quem agendou (SDR, social setter ou closer)">
        <Tabela cols={[{ h: "Pessoa", tl: true }, "Agendadas", "Realizadas", "No-show", "Presença", "Fora do ICP", "Vendas", "Situação"]}
          hl={com.por_sdr.findIndex((s) => s.id === f.sdr)}
          onRow={(i) => c.det("reunioes", { sdr_id: com.por_sdr[i].id }, `Reuniões · ${com.por_sdr[i].nome}`)}
          rows={com.por_sdr.map((s) => {
            const tot = s.realizadas + s.no_show;
            return [<Lk onClick={() => c.setF({ ...f, sdr: s.id })}>{s.nome}</Lk>, num(s.agendadas, 0), num(s.realizadas, 0), num(s.no_show, 0), fp(tot ? s.realizadas / tot : null), num(s.fora_icp, 0), num(s.vendas, 0),
              tot === 0 ? <Nd>sem desfecho</Nd> : <St ok={s.realizadas / tot >= 0.7} warn={s.realizadas / tot >= 0.5} tg="boa presença" tw="atenção" tb="muito no-show" />];
          })} />
      </Panel>

      <div className="grid g2">
        <Panel titulo="Vendas mês a mês" sub="todos os funis, sem filtro"><Barras serie={d.serie} mes={mes} fn={(m) => m.vendas} fmt={(v) => num(v, 0)} sub={(m) => (m.receita ? kfmt(m.receita) : "")} onMes={c.setMes} /></Panel>
        <Panel titulo="Reuniões mês a mês" sub="agendadas, com presença"><Barras serie={d.serie} mes={mes} fn={(m) => m.agendadas} fmt={(v) => num(v, 0)} sub={(m) => (m.realizadas != null && m.no_show != null && m.realizadas + m.no_show > 0 ? `${fp(m.realizadas / (m.realizadas + m.no_show))} pres.` : "")} onMes={c.setMes} /></Panel>
      </div>

      <Panel titulo="Por funil" sub="do lead à receita. Clique no funil pra filtrar, na linha pra ver os leads.">
        <Tabela cols={[{ h: "Funil", tl: true }, "Conta entrada", "Leads", "Agendadas", "Realizadas", "No-show", "Vendas", "Reunião → venda", "Receita"]}
          hl={com.por_funil.findIndex((p) => p.id === f.funil)}
          onRow={(i) => c.det("leads", { pipeline_id: com.por_funil[i].id }, `Leads · ${com.por_funil[i].nome}`)}
          rows={com.por_funil.map((p) => [
            <Lk onClick={() => c.setF({ ...f, funil: p.id })}>{p.nome}</Lk>, p.conta_entrada ? "sim" : <Nd>não</Nd>, num(p.leads, 0), num(p.agendadas, 0), num(p.realizadas, 0), num(p.no_show, 0), num(p.vendas, 0), fp(p.realizadas ? Math.min(p.vendas / p.realizadas, 1) : null), brl(p.receita),
          ])} />
      </Panel>

      <Panel titulo={`Vendas do recorte`} sub={`${k.vd.length} vendas · clique no lead pra abrir no CRM`}>
        <Tabela cols={[{ h: "Lead", tl: true }, { h: "Empresa", tl: true }, "Valor", "Data", "Closer", "SDR", "Funil", "Origem"]} rows={k.vd.map((v) => [
          <Lk ext onClick={() => c.abrir(LINK.lead(v.lead_id))}>{v.nome || "(sem nome)"}</Lk>, v.empresa ?? <Nd />, brl(v.valor), dataBR(v.data), v.closer ?? <Nd />, v.sdr ?? <Nd />, v.funil ?? <Nd />, v.origem ?? <Nd />,
        ])} />
        <Lk onClick={() => c.det("vendas", filtroDet, `Vendas${sufixo}`)}>Ver com produto e mais colunas</Lk>
      </Panel>

      <Panel titulo="Reuniões do recorte" sub={`${k.ev.length} eventos · últimos 30 listados`}>
        <Tabela cols={[{ h: "Lead", tl: true }, "Evento", "Quando", "Agendou", "Closer", "Funil"]} rows={k.ev.slice(0, 30).map((e) => [
          <Lk ext onClick={() => c.abrir(LINK.lead(e.lead_id))}>{e.nome || "(sem nome)"}</Lk>, eventoLabel(e.tipo), dataHoraBR(e.data), e.sdr ?? <Nd />, e.closer ?? <Nd />, e.funil ?? <Nd />,
        ])} />
        <Lk onClick={() => c.det("reunioes", filtroDet, `Reuniões${sufixo}`)}>Ver todas as reuniões</Lk>
      </Panel>
      <div className="note">Conversão reunião → venda usa vendas do mês sobre reuniões realizadas no mês, mesmo que a venda venha de reunião de outro mês. Presença = realizadas / (realizadas + no-show). {fp(pct(com.fora_icp, com.agendadas + com.fora_icp))} das reuniões marcadas foram fora do ICP.</div>
    </>
  );
}
