// Painel de Controle de KPIs do cliente (link público por token, 14/10/2026).
// Os dados chegam crus da RPC painel_kpis_public (lançamentos de Faturamento e Vendas por
// vendedora, metas do mês e o cadastro do time) e viram aqui os números das telas. O volume é
// pequeno (uma linha por vendedora por dia), então filtro e troca de visão são instantâneos.
import { diasUteis, pct } from "@/components/painel-cliente/modelo";

/** [data ISO, vendedora (null = sem vendedora), faturamento, vendas] */
export type Linha = [string, string | null, number, number];
/** [mês ISO, vendedora (null = linha da empresa), meta de faturamento, meta de vendas] */
export type LinhaMeta = [string, string | null, number | null, number | null];
export type PessoaCad = { id: string; nome: string; ativo: boolean; ranking: boolean; unidade: string | null; time: string | null };
export type Bruto = {
  empresa: string; hoje: string; mes: string; atualizado_em: string | null;
  kpis: { fat: { id: string; nome: string } | null; vendas: { id: string; nome: string } | null };
  unidades: { id: string; nome: string }[];
  times: { id: string; nome: string; unidade: string | null }[];
  pessoas: PessoaCad[];
  mensal: Linha[]; metas: LinhaMeta[]; diario: Linha[];
  /** atendimentos do sistema do cliente: [data, vendedora, etapa, quantidade] do mês e do anterior */
  funil?: { etapas: { chave: string; rotulo: string; ordem: number }[]; diario: [string, string | null, string, number][]; perdas: { motivo: string; quantidade: number }[]; atualizado_em: string | null };
  clientes?: {
    mensal: { mes: string; novos: number | null; recorrentes: number | null; ativos: number | null; fat_novos: number | null; fat_recorrentes: number | null }[];
    ltv: { valor: number | null; meses: number | null; compras: number | null; recompra: number | null; base: number | null; desde: string | null; atualizado_em: string } | null;
    por_vendedora: { id: string | null; nome: string; novos: number | null; recorrentes: number | null }[];
  };
  investimento?: { mes: string; midia: number | null; time: number | null; outros: number | null }[];
};
export type Filtro = { unidade?: string; time?: string };

export const SEM = "__sem";
export const ym = (iso: string) => iso.slice(0, 7);
const mesAnterior = (iso: string) => {
  const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, "0")}-01`;
};
const fimDoMes = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0).getDate();

export function primeiroNome(nome: string) {
  const p = nome.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1].length > 2 ? p[p.length - 1] : p[1] ?? ""}`.trim() : nome;
}

/** quem entra no recorte: o filtro vale pelo cadastro da vendedora */
function passa(b: Bruto, f: Filtro) {
  const cad = new Map(b.pessoas.map((p) => [p.id, p]));
  const filtrado = !!(f.unidade || f.time);
  return (sp: string | null) => {
    if (!filtrado) return true;
    const p = sp ? cad.get(sp) : undefined;
    if (!p) return false;
    return (!f.unidade || p.unidade === f.unidade) && (!f.time || p.time === f.time);
  };
}

export type Pessoa = PessoaCad & {
  fat: number; vendas: number; ticket: number | null;
  metaF: number | null; metaV: number | null; pctF: number | null; pctV: number | null;
  esperadoF: number | null; ritmo: number | null; projecao: number | null;
  diasSemVenda: number | null; ultimaVenda: string | null;
  antF: number; antV: number;
};

/** números do mês para o recorte */
export function calcMes(b: Bruto, mesIso: string, f: Filtro = {}, hoje = new Date()) {
  const ok = passa(b, f);
  const chave = ym(mesIso), antIso = mesAnterior(mesIso), antChave = ym(antIso);
  const du = diasUteis(mesIso, hoje);
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const emAndamento = hojeIso.slice(0, 7) === chave;
  // comparação justa: mês anterior até o mesmo dia do mês (ou inteiro, se o mês já fechou)
  const corteAnt = du.corte >= du.fim ? fimDoMes(antIso) : Math.min(du.corte, fimDoMes(antIso));

  const porPessoa = new Map<string, { fat: number; vendas: number; antF: number; antV: number; ultima: string | null }>();
  const pp = (sp: string | null) => {
    const k = sp ?? SEM;
    let x = porPessoa.get(k);
    if (!x) { x = { fat: 0, vendas: 0, antF: 0, antV: 0, ultima: null }; porPessoa.set(k, x); }
    return x;
  };
  const dias = Array.from({ length: du.fim }, (_, i) => ({ d: i + 1, fat: 0, vendas: 0 }));
  let antF = 0, antV = 0, antFTotal = 0, antVTotal = 0;
  for (const [d, sp, fat, qtd] of b.diario) {
    if (!ok(sp)) continue;
    const dia = Number(d.slice(8, 10));
    if (ym(d) === chave) {
      const x = pp(sp); x.fat += fat; x.vendas += qtd;
      if (qtd > 0 || fat > 0) x.ultima = !x.ultima || d > x.ultima ? d : x.ultima;
      dias[dia - 1].fat += fat; dias[dia - 1].vendas += qtd;
    } else if (ym(d) === antChave) {
      antFTotal += fat; antVTotal += qtd;
      if (dia <= corteAnt) { antF += fat; antV += qtd; const x = pp(sp); x.antF += fat; x.antV += qtd; }
    }
  }
  // mês fora da janela do diário: usa o consolidado mensal
  const temDiario = b.diario.some((l) => ym(l[0]) === chave);
  if (!temDiario) {
    for (const [m, sp, fat, qtd] of b.mensal) if (ym(m) === chave && ok(sp)) { const x = pp(sp); x.fat += fat; x.vendas += qtd; }
  }

  const metasMes = b.metas.filter((l) => ym(l[0]) === chave);
  const metaDe = new Map(metasMes.filter((l) => l[1]).map((l) => [l[1] as string, l]));

  const fracTempo = du.total ? du.passados / du.total : 0;
  const diasUteisDesde = (iso: string | null) => {
    if (!iso || !emAndamento) return null;
    let n = 0;
    for (let d = Number(iso.slice(8, 10)) + 1; d <= du.corte; d++) if (du.util[d - 1]) n++;
    // hoje ainda está em andamento: não conta como dia sem venda
    if (du.util[du.corte - 1]) n = Math.max(n - 1, 0);
    return n;
  };

  const pessoas: Pessoa[] = b.pessoas.filter((p) => ok(p.id)).map((p) => {
    const x = porPessoa.get(p.id) ?? { fat: 0, vendas: 0, antF: 0, antV: 0, ultima: null };
    const mt = metaDe.get(p.id);
    const metaF = mt?.[2] ?? null, metaV = mt?.[3] ?? null;
    return {
      ...p, fat: x.fat, vendas: x.vendas, ticket: x.vendas ? x.fat / x.vendas : null,
      metaF, metaV, pctF: pct(x.fat, metaF), pctV: pct(x.vendas, metaV),
      esperadoF: metaF != null ? metaF * fracTempo : null,
      ritmo: metaF != null && fracTempo > 0 ? x.fat / (metaF * fracTempo) : null,
      projecao: du.passados ? (x.fat / du.passados) * du.total : null,
      diasSemVenda: diasUteisDesde(x.ultima ?? (x.fat || x.vendas ? null : `${chave}-00`)),
      ultimaVenda: x.ultima, antF: x.antF, antV: x.antV,
    };
  }).filter((p) => p.ativo || p.fat || p.vendas || p.metaF || p.metaV);

  const sem = porPessoa.get(SEM);
  const fat = [...porPessoa.values()].reduce((s, x) => s + x.fat, 0);
  const vendas = [...porPessoa.values()].reduce((s, x) => s + x.vendas, 0);
  // meta do time = soma das metas individuais do recorte; sem meta individual, vale a linha da empresa
  const somaF = pessoas.reduce((s, p) => s + (p.metaF ?? 0), 0), somaV = pessoas.reduce((s, p) => s + (p.metaV ?? 0), 0);
  const empresa = metasMes.find((l) => !l[1]);
  const filtrado = !!(f.unidade || f.time);
  const metaF = somaF > 0 ? somaF : !filtrado ? empresa?.[2] ?? null : null;
  const metaV = somaV > 0 ? somaV : !filtrado ? empresa?.[3] ?? null : null;

  return {
    iso: mesIso, chave, du, emAndamento, filtrado, fracTempo,
    fat, vendas, ticket: vendas ? fat / vendas : null,
    semVendedora: sem ? { fat: sem.fat, vendas: sem.vendas } : null,
    metaF, metaV, pctF: pct(fat, metaF), pctV: pct(vendas, metaV),
    metaEmpresaF: empresa?.[2] ?? null,
    ant: { iso: antIso, fat: antF, vendas: antV, fatTotal: antFTotal, vendasTotal: antVTotal, corte: corteAnt },
    dias,
    pessoas,
    ranking: pessoas.filter((p) => p.ranking && (p.metaF || p.fat || p.vendas)).sort((a, z) => (z.pctF ?? -1) - (a.pctF ?? -1) || z.fat - a.fat),
    foraRanking: pessoas.filter((p) => !p.ranking && (p.fat || p.vendas)),
    /** ativas no cadastro, sem meta e sem venda no mês: pede limpeza do cadastro ou meta */
    paradas: pessoas.filter((p) => p.ranking && p.ativo && !p.metaF && !p.fat && !p.vendas),
  };
}
export type Calc = ReturnType<typeof calcMes>;

/** meta acumulada por dia útil contra o realizado acumulado */
export function serieRitmo(meta: number | null, porDia: number[], iso: string, hoje = new Date()) {
  if (!meta) return null;
  const du = diasUteis(iso, hoje);
  const dias: { d: number; util: boolean; meta: number; real: number | null }[] = [];
  let u = 0, r = 0;
  for (let d = 1; d <= du.fim; d++) {
    if (du.util[d - 1]) u++;
    r += porDia[d - 1] ?? 0;
    dias.push({ d, util: du.util[d - 1], meta: (meta * u) / (du.total || 1), real: d <= du.corte ? r : null });
  }
  const vendido = porDia.slice(0, du.corte || 0).reduce((s, v) => s + v, 0);
  const esperado = du.corte ? dias[du.corte - 1].meta : 0;
  const falta = Math.max(meta - vendido, 0);
  const ritmoDia = du.passados ? vendido / du.passados : null;
  return {
    dias, du, meta, vendido, esperado, dif: vendido - esperado, falta, ritmoDia,
    porDiaRestante: du.restantes ? falta / du.restantes : null,
    projecao: ritmoDia != null ? ritmoDia * du.total : null,
    pctMeta: pct(vendido, meta), pctTempo: pct(du.passados, du.total),
  };
}

/** série dos 13 meses (faturamento, vendas, meta) para o recorte */
export function serieMeses(b: Bruto, f: Filtro = {}) {
  const ok = passa(b, f);
  const atual = `${b.hoje.slice(0, 7)}-01`;
  const meses: string[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(Number(atual.slice(0, 4)), Number(atual.slice(5, 7)) - 1 - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  const filtrado = !!(f.unidade || f.time);
  return meses.map((mes) => {
    const k = ym(mes);
    const rows = b.mensal.filter((l) => ym(l[0]) === k && ok(l[1]));
    const fat = rows.reduce((s, l) => s + l[2], 0), vendas = rows.reduce((s, l) => s + l[3], 0);
    const ms = b.metas.filter((l) => ym(l[0]) === k);
    const ind = ms.filter((l) => l[1] && ok(l[1]));
    const somaF = ind.reduce((s, l) => s + (l[2] ?? 0), 0);
    const emp = ms.find((l) => !l[1]);
    const meta = somaF > 0 ? somaF : !filtrado ? emp?.[2] ?? null : null;
    return { mes, fat: rows.length ? fat : null, vendas: rows.length ? vendas : null, meta };
  });
}

/** série mensal de uma vendedora */
export function seriePessoa(b: Bruto, id: string) {
  return serieMeses(b).map((m) => {
    const k = ym(m.mes);
    const l = b.mensal.find((x) => ym(x[0]) === k && x[1] === id);
    const mt = b.metas.find((x) => ym(x[0]) === k && x[1] === id);
    return { mes: m.mes, fat: l ? l[2] : null, vendas: l ? l[3] : null, meta: mt?.[2] ?? null };
  });
}

/** faturamento por dia de uma vendedora no mês */
export function diasPessoa(b: Bruto, iso: string, id: string) {
  const fim = fimDoMes(iso), k = ym(iso);
  const fat = Array(fim).fill(0), vendas = Array(fim).fill(0);
  for (const [d, sp, f, q] of b.diario) if (sp === id && ym(d) === k) { fat[Number(d.slice(8, 10)) - 1] += f; vendas[Number(d.slice(8, 10)) - 1] += q; }
  return { fat, vendas };
}

/** lançamentos de um dia, por vendedora */
export function linhasDia(b: Bruto, diaIso: string, f: Filtro = {}) {
  const ok = passa(b, f);
  const nome = new Map(b.pessoas.map((p) => [p.id, p.nome]));
  return b.diario.filter((l) => l[0] === diaIso && ok(l[1]) && (l[2] || l[3]))
    .map((l) => ({ id: l[1], nome: l[1] ? nome.get(l[1]) ?? "Vendedora" : "Sem vendedora", fat: l[2], vendas: l[3] }))
    .sort((a, z) => z.fat - a.fat);
}

/** agrupado por unidade ou por time */
export function agrupar(b: Bruto, c: Calc, por: "unidade" | "time") {
  const nomes = new Map((por === "unidade" ? b.unidades : b.times).map((x) => [x.id, x.nome]));
  const g = new Map<string, { id: string; nome: string; fat: number; vendas: number; metaF: number; metaV: number; pessoas: number; antF: number }>();
  for (const p of c.pessoas) {
    const id = (por === "unidade" ? p.unidade : p.time) ?? SEM;
    let x = g.get(id);
    if (!x) { x = { id, nome: id === SEM ? (por === "unidade" ? "Sem unidade" : "Sem time") : nomes.get(id) ?? "-", fat: 0, vendas: 0, metaF: 0, metaV: 0, pessoas: 0, antF: 0 }; g.set(id, x); }
    x.fat += p.fat; x.vendas += p.vendas; x.metaF += p.metaF ?? 0; x.metaV += p.metaV ?? 0; x.antF += p.antF;
    if (p.ativo || p.fat) x.pessoas++;
  }
  return [...g.values()].filter((x) => x.fat || x.metaF || x.vendas).sort((a, z) => z.fat - a.fat);
}

export type Alerta = { gravidade: "alta" | "media" | "baixa"; titulo: string; detalhe: string; abre: { view: string; id?: string } };
const brlK = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`);

/** o que pede atenção da gestão neste mês */
export function alertas(b: Bruto, c: Calc, agora = new Date()): Alerta[] {
  const out: Alerta[] = [];
  const s = serieRitmo(c.metaF, c.dias.map((d) => d.fat), c.iso, agora);
  if (s && s.du.passados > 0 && s.dif < 0 && c.emAndamento)
    out.push({ gravidade: s.dif < -0.1 * s.meta ? "alta" : "media", titulo: `Time ${brlK(-s.dif)} abaixo do ritmo da meta`, detalhe: `${brlK(s.vendido)} faturados contra ${brlK(s.esperado)} esperados até hoje. Faltam ${brlK(s.falta)}, ${s.porDiaRestante != null ? brlK(s.porDiaRestante) : "-"} por dia útil`, abre: { view: "meta" } });
  if (c.emAndamento) {
    for (const p of c.ranking) {
      if (p.ritmo != null && p.ritmo < 0.7 && (p.esperadoF ?? 0) > 0)
        out.push({ gravidade: p.ritmo < 0.5 ? "alta" : "media", titulo: `${primeiroNome(p.nome)} em ${Math.round(p.ritmo * 100)}% do ritmo`, detalhe: `${brlK(p.fat)} faturados contra ${brlK(p.esperadoF ?? 0)} esperados até hoje · meta ${brlK(p.metaF ?? 0)}`, abre: { view: "pessoa", id: p.id } });
      if (p.ativo && p.metaF && p.diasSemVenda != null && p.diasSemVenda >= 2)
        out.push({ gravidade: p.diasSemVenda >= 4 ? "alta" : "media", titulo: `${primeiroNome(p.nome)} há ${p.diasSemVenda} dias úteis sem venda`, detalhe: p.ultimaVenda ? `última venda lançada em ${p.ultimaVenda.slice(8, 10)}/${p.ultimaVenda.slice(5, 7)}` : "nenhuma venda lançada no mês", abre: { view: "pessoa", id: p.id } });
    }
    const v = serieRitmo(c.metaV, c.dias.map((d) => d.vendas), c.iso, agora);
    if (v && v.du.passados > 0 && v.dif < -0.1 * v.meta)
      out.push({ gravidade: "media", titulo: `${Math.round(-v.dif)} vendas abaixo do ritmo`, detalhe: `${Math.round(v.vendido)} vendas contra ${Math.round(v.esperado)} esperadas até hoje · meta ${Math.round(v.meta)}`, abre: { view: "meta" } });
    if (c.ticket && c.ant.vendas && c.ant.fat / c.ant.vendas > 0 && c.ticket < 0.85 * (c.ant.fat / c.ant.vendas))
      out.push({ gravidade: "baixa", titulo: `Ticket médio ${Math.round((1 - c.ticket / (c.ant.fat / c.ant.vendas)) * 100)}% menor que no mês anterior`, detalhe: `${brlK(c.ticket)} agora contra ${brlK(c.ant.fat / c.ant.vendas)} no mesmo período do mês passado`, abre: { view: "time" } });
  }
  const cl = calcClientes(b, c.iso);
  if (cl.ltvCac != null && cl.ltvCac < 3)
    out.push({ gravidade: cl.ltvCac < 1.5 ? "alta" : "media", titulo: `LTV só ${cl.ltvCac.toFixed(1).replace(".", ",")}x o CAC`, detalhe: `CAC de ${brlK(cl.cac ?? 0)} para um LTV de ${brlK(cl.ltv?.valor ?? 0)}. O saudável é 3x ou mais`, abre: { view: "clientes" } });
  if (b.atualizado_em) {
    const h = (agora.getTime() - new Date(b.atualizado_em).getTime()) / 36e5;
    const dia = agora.getDay();
    if (h > 26 && dia > 0 && dia < 6)
      out.push({ gravidade: "alta", titulo: "Lançamentos parados", detalhe: `nenhum número novo desde ${new Date(b.atualizado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. Confira a integração com o sistema da empresa`, abre: { view: "fontes" } });
  }
  const ordem = { alta: 0, media: 1, baixa: 2 };
  return out.sort((a, z) => ordem[a.gravidade] - ordem[z.gravidade]);
}

/* ======================= funil de atendimentos ======================= */
/** funil do mês (e do mês anterior no mesmo período) a partir dos atendimentos do sistema do cliente */
export function calcFunil(b: Bruto, c: Calc, f: Filtro = {}) {
  const fu = b.funil;
  if (!fu || !fu.etapas.length) return null;
  const ok = passa(b, f);
  const etapas = [...fu.etapas].sort((a, z) => a.ordem - z.ordem);
  const tot: Record<string, number> = {}, ant: Record<string, number> = {};
  const pess = new Map<string, Record<string, number>>();
  const dias = Array.from({ length: c.du.fim }, () => ({} as Record<string, number>));
  for (const [d, sp, et, q] of fu.diario) {
    if (!ok(sp)) continue;
    const dia = Number(d.slice(8, 10));
    if (ym(d) === c.chave) {
      tot[et] = (tot[et] ?? 0) + q;
      dias[dia - 1][et] = (dias[dia - 1][et] ?? 0) + q;
      const k = sp ?? SEM; const x = pess.get(k) ?? {}; x[et] = (x[et] ?? 0) + q; pess.set(k, x);
    } else if (ym(d) === ym(c.ant.iso) && dia <= c.ant.corte) ant[et] = (ant[et] ?? 0) + q;
  }
  const temDado = Object.values(tot).some((v) => v > 0) || fu.diario.some((l) => ym(l[0]) === c.chave);
  // base da conversão: a etapa "atendimento" quando existe (a 1ª pode ser carteira/lista importada)
  const primeira = etapas.find((e) => e.chave === "atendimento")?.chave ?? etapas[0].chave, ultima = etapas[etapas.length - 1].chave;
  const nomes = new Map(b.pessoas.map((p) => [p.id, p]));
  const porPessoa = [...pess.entries()].map(([id, x]) => ({
    id: id === SEM ? null : id, nome: id === SEM ? "Sem vendedora" : nomes.get(id)?.nome ?? "Vendedora", ranking: id === SEM ? false : nomes.get(id)?.ranking ?? true,
    etapas: x, atend: x[primeira] ?? 0, vendas: x[ultima] ?? 0, conv: pct(x[ultima] ?? 0, x[primeira] ?? 0),
  })).sort((a, z) => z.atend - a.atend);
  return {
    etapas: etapas.map((e, i) => ({ ...e, v: tot[e.chave] ?? 0, ant: ant[e.chave] ?? 0, convAnterior: i ? pct(tot[e.chave] ?? 0, tot[etapas[i - 1].chave] ?? 0) : null })),
    atendimentos: tot[primeira] ?? 0, vendas: tot[ultima] ?? 0, conv: pct(tot[ultima] ?? 0, tot[primeira] ?? 0),
    convAnt: pct(ant[ultima] ?? 0, ant[primeira] ?? 0), atendAnt: ant[primeira] ?? 0,
    porPessoa, dias, primeira, ultima, temDado, perdas: fu.perdas ?? [],
  };
}
export type Funil = NonNullable<ReturnType<typeof calcFunil>>;

/* ======================= clientes, CAC e LTV ======================= */
/** CAC do mês = (mídia + time comercial + outros) ÷ clientes novos; LTV vem pronto do sistema do cliente */
export function calcClientes(b: Bruto, mesIso: string) {
  const k = ym(mesIso);
  const cl = b.clientes?.mensal.find((m) => ym(m.mes) === k) ?? null;
  const inv = b.investimento?.find((m) => ym(m.mes) === k) ?? null;
  const custo = inv ? (inv.midia ?? 0) + (inv.time ?? 0) + (inv.outros ?? 0) : null;
  const novos = cl?.novos ?? null;
  const cac = custo != null && novos ? custo / novos : null;
  const cacMidia = inv?.midia != null && novos ? inv.midia / novos : null;
  const ltv = b.clientes?.ltv ?? null;
  const serie = serieMeses(b).map((m) => {
    const c2 = b.clientes?.mensal.find((x) => ym(x.mes) === ym(m.mes));
    const i2 = b.investimento?.find((x) => ym(x.mes) === ym(m.mes));
    const cu = i2 ? (i2.midia ?? 0) + (i2.time ?? 0) + (i2.outros ?? 0) : null;
    return { mes: m.mes, novos: c2?.novos ?? null, recorrentes: c2?.recorrentes ?? null, custo: cu, midia: i2?.midia ?? null, cac: cu != null && c2?.novos ? cu / c2.novos : null };
  });
  return {
    cl, inv, custo, novos, cac, cacMidia, ltv,
    ltvCac: ltv?.valor != null && cac ? ltv.valor / cac : null,
    temClientes: !!(b.clientes && (b.clientes.mensal.length || b.clientes.ltv)),
    temInvest: !!(b.investimento && b.investimento.length),
    serie,
  };
}
export type Clientes = ReturnType<typeof calcClientes>;
