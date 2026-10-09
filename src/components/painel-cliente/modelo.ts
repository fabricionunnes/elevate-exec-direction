// Painel de Controle do cliente (link público por token).
// Os dados chegam crus da RPC project_dashboard_dados_public: os meses que a função
// md1-painel-sync monta a partir da planilha do cliente e a foto do sistema interno dele
// (dados.sistema). Aqui viram os números que as telas usam. Tudo é calculado no navegador:
// o volume é pequeno (uma linha por venda e por reunião) e assim o filtro é instantâneo.

/** venda: [valor, entrada, closer, canal, contrato assinado (1/0), plataforma, agente, data ISO, tipo?]
 *  tipo: "nova" (padrão quando não vem), "renov" (renovação) ou "asc" (ascensão) */
export type Venda = [number, number, string, string, number, string, string, string, string?];
export const ehNova = (v: Venda) => !v[8] || v[8] === "nova";
/** reunião: [canal, sdr, closer, compareceu (1/0/null), comprou (1/0), decisão pendente (1/0), dias de espera, data ISO] */
export type Reuniao = [string, string, string, 0 | 1 | null, number, number, number | null, string];

export type MesBruto = {
  mes: string; n: number; vendas: number; faturamento: number; entrada: number; ticket: number;
  leads: number | null; mqls: number | null; agendadas: number; realizadas: number;
  vendas_agenda: number; decisao_pendente: number;
  canais_venda: { nome: string; vendas: number; valor: number }[];
  espera: { faixa: string; agendadas: number; realizadas: number }[];
  qualidade: Record<string, number | null>;
  ag: Reuniao[]; vd: Venda[];
};

type Caixa = { eduzz: number; asaas: number; reemb: number; por: Record<string, number> };
type VendasSis = {
  n: number; valor: number; entrada: number; prod: Record<string, [number, number]>; cancel: number; semContrato: number;
  registrado?: { n: number; valor: number };
  fora?: { valor: number; semContrato: number; semContratoValor: number; dataFutura: number; dataFuturaValor: number };
  tipo?: { novas: number; renov: number };
};
export type Sistema = {
  lido_em?: string; fonte?: string; notas?: string[];
  caixa?: Record<string, Caixa>;
  caixa_dia?: Record<string, number>;
  vendas?: Record<string, VendasSis>;
  metas?: Record<string, { total: number; novas?: number; renov?: number }>;
  funil_fap?: Record<string, (number | string | null)[]>;
  /** agenda do mês corrente com horário: [quando, sdr, closer, compareceu sim/nao/pend, converteu, tipo, tipo de call] */
  agenda?: { lido_em: string; colunas: string[]; linhas: [string, string, string, string, string, string, string][] };
};
export type Bruto = { gerado_em: string; fonte?: string; ano: number; meses: MesBruto[]; sistema?: Sistema };

export type Filtro = { funil?: string; closer?: string; sdr?: string };

export const FERIADOS = new Set(["2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21", "2026-05-01", "2026-06-04", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"]);

const pad = (x: number) => String(x).padStart(2, "0");
export const isoMes = (b: Bruto, m: MesBruto) => `${b.ano}-${pad(m.n)}-01`;
export const ym = (iso: string) => iso.slice(0, 7);
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const pct = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a == null || b == null || !b ? null : a / b;

/** dias úteis do mês (sem fim de semana e feriado nacional) e quantos já passaram até `hoje` */
export function diasUteis(iso: string, hoje = new Date()) {
  const ano = Number(iso.slice(0, 4)), mes = Number(iso.slice(5, 7)) - 1;
  const fim = new Date(ano, mes + 1, 0).getDate();
  const util: boolean[] = [];
  for (let d = 1; d <= fim; d++) {
    const dt = new Date(ano, mes, d), w = dt.getDay();
    util.push(w > 0 && w < 6 && !FERIADOS.has(ymd(dt)));
  }
  const total = util.filter(Boolean).length;
  const mesmoMes = hoje.getFullYear() === ano && hoje.getMonth() === mes;
  const corte = mesmoMes ? hoje.getDate() : new Date(ano, mes, 1) < hoje ? fim : 0;
  const passados = util.slice(0, corte).filter(Boolean).length;
  return { total, passados, restantes: total - passados, util, corte, fim };
}

const aplica = <T,>(rows: T[], f: Filtro, k: { funil?: (r: T) => string; closer?: (r: T) => string; sdr?: (r: T) => string }) =>
  rows.filter((r) => (!f.funil || !k.funil || k.funil(r) === f.funil) && (!f.closer || !k.closer || k.closer(r) === f.closer) && (!f.sdr || !k.sdr || k.sdr(r) === f.sdr));

export type Pessoa = { nome: string; agendadas: number; realizadas: number; no_show: number; sem_desfecho: number; pendentes: number; vendas: number; receita: number };

/** números do mês com o filtro aplicado */
export function calcMes(b: Bruto, m: MesBruto, f: Filtro = {}) {
  const sis = b.sistema ?? {};
  const iso = isoMes(b, m), chave = ym(iso);
  const ag = aplica(m.ag, f, { funil: (a) => a[0], closer: (a) => a[2], sdr: (a) => a[1] });
  // vendas não registram SDR: com filtro de SDR o valor some (mesma regra do painel antigo)
  const vdOk = !f.sdr;
  const vd = vdOk ? aplica(m.vd, f, { funil: (v) => v[3], closer: (v) => v[2] }) : [];
  const fech = ag.filter((a) => a[3] !== null);
  const realizadas = fech.filter((a) => a[3] === 1).length;
  const vendas = vdOk ? vd.length : ag.filter((a) => a[4]).length;
  const receita = vdOk ? vd.reduce((s, v) => s + v[0], 0) : null;
  const entrada = vdOk ? vd.reduce((s, v) => s + (v[1] || 0), 0) : null;

  const grupo = (key: (a: Reuniao) => string) => {
    const g: Record<string, Pessoa> = {};
    const p = (nome: string) => (g[nome || "Não informado"] ??= { nome: nome || "Não informado", agendadas: 0, realizadas: 0, no_show: 0, sem_desfecho: 0, pendentes: 0, vendas: 0, receita: 0 });
    ag.forEach((a) => {
      const x = p(key(a));
      if (a[3] === null) x.sem_desfecho++; else { x.agendadas++; if (a[3] === 1) x.realizadas++; else x.no_show++; }
      if (a[5]) x.pendentes++;
    });
    return g;
  };
  const sdrs = grupo((a) => a[1]);
  ag.forEach((a) => { if (a[4]) sdrs[a[1] || "Não informado"].vendas++; });
  const closersG = grupo((a) => (a[3] === 1 ? a[2] : ""));
  delete closersG["Não informado"];
  vd.forEach((v) => {
    const k = v[2] || "Não informado";
    const x = (closersG[k] ??= { nome: k, agendadas: 0, realizadas: 0, no_show: 0, sem_desfecho: 0, pendentes: 0, vendas: 0, receita: 0 });
    x.vendas++; x.receita += v[0];
  });
  const funis: Record<string, { nome: string; agendadas: number; realizadas: number; vendas: number; receita: number }> = {};
  const fu = (n: string) => (funis[n || "Não informado"] ??= { nome: n || "Não informado", agendadas: 0, realizadas: 0, vendas: 0, receita: 0 });
  fech.forEach((a) => { const x = fu(a[0]); x.agendadas++; if (a[3] === 1) x.realizadas++; });
  vd.forEach((v) => { const x = fu(v[3]); x.vendas++; x.receita += v[0]; });

  const cx = sis.caixa?.[chave] ?? null;
  const recebido = cx ? cx.eduzz + cx.asaas : null;
  const vs = sis.vendas?.[String(m.n)];
  const meta = sis.metas?.[chave] ?? null;
  const filtrado = !!(f.funil || f.closer || f.sdr);

  return {
    iso, chave, ag, vd, fech, vdOk, filtrado,
    leads: m.leads && m.leads > 0 ? m.leads : null, mqls: m.mqls && m.mqls > 0 ? m.mqls : null,
    agendadas: fech.length, realizadas, no_show: fech.length - realizadas, sem_desfecho: ag.length - fech.length,
    presenca: pct(realizadas, fech.length), pendentes: ag.filter((a) => a[5]).length,
    vendas, receita, entrada, ticket: receita != null && vendas ? receita / vendas : null, conv: pct(vendas, realizadas),
    por_sdr: Object.values(sdrs).sort((a, b) => b.agendadas - a.agendadas),
    por_closer: Object.values(closersG).sort((a, b) => b.receita - a.receita || b.realizadas - a.realizadas),
    por_funil: Object.values(funis).sort((a, b) => b.receita - a.receita || b.agendadas - a.agendadas),
    espera: m.espera, qualidade: m.qualidade,
    caixa: cx, recebido, reembolso: cx ? cx.reemb : null,
    tipo: !filtrado ? vs?.tipo ?? null : null, fora: !filtrado ? vs?.fora ?? null : null, registrado: !filtrado ? vs?.registrado ?? null : null,
    meta,
  };
}
export type Calc = ReturnType<typeof calcMes>;

/** Meta "só vendas novas": tira da meta a parte de renovações e ascensões e tira do realizado
 *  as vendas desse tipo. A escolha fica no aparelho (vale pro painel e pra Gestão à vista). */
export function comMeta(c: Calc, soNovas: boolean): Calc {
  if (!soNovas || !c.meta || c.meta.novas == null) return c;
  const vd = c.vd.filter(ehNova);
  const receita = c.vdOk ? vd.reduce((s, v) => s + v[0], 0) : c.receita;
  return { ...c, vd, receita, vendas: c.vdOk ? vd.length : c.vendas, ticket: c.vdOk && vd.length ? (receita ?? 0) / vd.length : c.ticket, meta: { ...c.meta, total: c.meta.novas } };
}
const CHAVE_SO_NOVAS = "md1_meta_so_novas";
export const lerSoNovas = (): boolean => { try { return localStorage.getItem(CHAVE_SO_NOVAS) === "1"; } catch { return false; } };
export const gravarSoNovas = (v: boolean): void => { try { localStorage.setItem(CHAVE_SO_NOVAS, v ? "1" : "0"); } catch { /* sem storage */ } };

/** meta acumulada (por dia útil) contra o realizado acumulado, dia a dia */
export function serieMeta(c: Calc, hoje = new Date()) {
  if (!c.meta) return null;
  const du = diasUteis(c.iso, hoje);
  const porDia = Array(du.fim + 1).fill(0);
  c.vd.forEach((v) => { const d = Number(v[7].slice(8, 10)); if (v[7].slice(0, 7) === c.chave && d >= 1 && d <= du.fim) porDia[d] += v[0]; });
  const dias: { d: number; util: boolean; meta: number; real: number | null }[] = [];
  let u = 0, r = 0;
  for (let d = 1; d <= du.fim; d++) {
    if (du.util[d - 1]) u++;
    r += porDia[d];
    dias.push({ d, util: du.util[d - 1], meta: (c.meta.total * u) / (du.total || 1), real: d <= du.corte ? r : null });
  }
  const ate = du.corte ? dias[du.corte - 1] : null;
  const vendido = c.receita ?? 0;
  const esperado = ate ? ate.meta : 0;
  const falta = Math.max(c.meta.total - vendido, 0);
  const ritmoDia = du.passados ? vendido / du.passados : null;
  return {
    dias, du, vendido, esperado, dif: vendido - esperado, falta,
    porDiaRestante: du.restantes ? falta / du.restantes : null,
    projecao: ritmoDia != null ? ritmoDia * du.total : null,
    pctMeta: pct(vendido, c.meta.total), pctTempo: pct(du.passados, du.total),
  };
}

/** série mês a mês pras barras */
export function serieMeses(b: Bruto) {
  return b.meses.map((m) => {
    const c = calcMes(b, m);
    return { mes: isoMes(b, m), receita: c.receita, vendas: c.vendas, recebido: c.recebido, agendadas: c.agendadas, realizadas: c.realizadas, presenca: c.presenca, meta: c.meta?.total ?? null };
  });
}

export type Alerta = { gravidade: "alta" | "media" | "baixa"; titulo: string; detalhe: string; abre: { view?: string; det?: string; filtro?: Record<string, string> } };
const brlK = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`);

/** o que pede decisão do dono neste mês */
export function alertas(b: Bruto, m: MesBruto, soNovas = false): Alerta[] {
  const c = calcMes(b, m), out: Alerta[] = [];
  const s = serieMeta(comMeta(c, soNovas));
  if (s && s.du.passados > 0 && s.dif < 0) out.push({ gravidade: s.dif < -0.1 * (c.meta?.total ?? 0) ? "alta" : "media", titulo: `Vendas ${brlK(-s.dif)} abaixo do ritmo da meta`, detalhe: `${brlK(s.vendido)} vendidos contra ${brlK(s.esperado)} esperados até hoje. Faltam ${brlK(s.falta)}, ${s.porDiaRestante != null ? brlK(s.porDiaRestante) : "-"} por dia útil`, abre: { view: "meta" } });
  if (c.presenca != null && c.agendadas >= 5 && 1 - c.presenca >= 0.35) out.push({ gravidade: 1 - c.presenca >= 0.5 ? "alta" : "media", titulo: `No-show de ${Math.round((1 - c.presenca) * 100)}% nas reuniões`, detalhe: `${c.no_show} de ${c.agendadas} reuniões com desfecho não aconteceram`, abre: { det: "reunioes", filtro: { tipo: "no_show" } } });
  if (c.fora && c.fora.valor > 0) out.push({ gravidade: "alta", titulo: `${brlK(c.fora.valor)} em vendas fora da regra`, detalhe: `${c.fora.semContrato} sem contrato assinado e ${c.fora.dataFutura} com data de contrato no futuro. Não somam na meta até regularizar`, abre: { view: "meta" } });
  if (c.sem_desfecho > 0) out.push({ gravidade: "media", titulo: `${c.sem_desfecho} ${c.sem_desfecho === 1 ? "reunião sem desfecho" : "reuniões sem desfecho"}`, detalhe: "já passaram e ninguém marcou se o lead compareceu", abre: { det: "reunioes", filtro: { tipo: "sem_desfecho" } } });
  if (c.pendentes > 0) out.push({ gravidade: "media", titulo: `${c.pendentes} calls realizadas sem decisão`, detalhe: "o lead compareceu e a venda segue pendente, sem follow-up registrado", abre: { det: "reunioes", filtro: { tipo: "pendente" } } });
  if (c.caixa && c.recebido && c.caixa.reemb / c.recebido > 0.05) out.push({ gravidade: "media", titulo: `Reembolso de ${Math.round((c.caixa.reemb / c.recebido) * 100)}% do caixa`, detalhe: `${brlK(c.caixa.reemb)} devolvidos no mês`, abre: { view: "financeiro" } });
  const q = c.qualidade || {};
  const inc = [[q.sem_contrato, "sem contrato"], [q.sem_origem, "sem origem"], [q.sem_vendedor, "sem vendedor"]].filter((x) => Number(x[0]) > 0);
  if (inc.length) out.push({ gravidade: "baixa", titulo: "Vendas com cadastro incompleto", detalhe: inc.map((x) => `${x[0]} ${x[1]}`).join(", "), abre: { det: "vendas" } });
  const e = (m.espera || []).reduce((s, x) => s + x.agendadas, 0), longe = (m.espera || []).filter((x) => /3 a 5|6 a 9|10 dias/.test(x.faixa)).reduce((s, x) => s + x.agendadas, 0);
  if (e >= 10 && longe / e > 0.4) out.push({ gravidade: "media", titulo: `${Math.round((longe / e) * 100)}% das reuniões marcadas com 3 dias ou mais`, detalhe: "o playbook pede reunião no mesmo dia ou no dia seguinte", abre: { view: "comercial" } });
  const ordem = { alta: 0, media: 1, baixa: 2 };
  return out.sort((a, b2) => ordem[a.gravidade] - ordem[b2.gravidade]);
}

/** linhas de detalhe (sem nome de aluno: o link é público) */
export function linhasVendas(b: Bruto, m: MesBruto, f: Filtro & { closer_nome?: string } = {}) {
  return aplica(m.vd, f, { funil: (v) => v[3], closer: (v) => v[2] }).map((v) => ({
    data: v[7], valor: v[0], entrada: v[1], closer: v[2] || "Não informado", origem: v[3] || "Não informado", contrato: v[4] ? "assinado" : "pendente", plataforma: v[5], agente: v[6],
  })).sort((a, b2) => (a.data < b2.data ? 1 : -1));
}
export function linhasReunioes(b: Bruto, m: MesBruto, f: Filtro & { tipo?: string } = {}) {
  let rows = aplica(m.ag, f, { funil: (a) => a[0], closer: (a) => a[2], sdr: (a) => a[1] });
  if (f.tipo === "realizadas") rows = rows.filter((a) => a[3] === 1);
  else if (f.tipo === "no_show") rows = rows.filter((a) => a[3] === 0);
  else if (f.tipo === "sem_desfecho") rows = rows.filter((a) => a[3] === null);
  else if (f.tipo === "pendente") rows = rows.filter((a) => a[5] === 1);
  else if (f.tipo === "comprou") rows = rows.filter((a) => a[4] === 1);
  return rows.map((a) => ({
    data: a[7], funil: a[0] || "Não informado", sdr: a[1] || "Não informado", closer: a[2] || "-",
    situacao: a[3] === null ? "sem desfecho" : a[3] === 1 ? "compareceu" : "no-show", decisao: a[4] ? "comprou" : a[5] ? "pendente" : "-", espera: a[6],
  })).sort((a, b2) => (a.data < b2.data ? 1 : -1));
}
