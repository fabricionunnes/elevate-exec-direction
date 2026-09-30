// @ts-nocheck
// Lógica pura do painel da MD1 Academy (cliente Vitor Jaci): lê as abas da
// planilha de controle em CSV e devolve os dados do painel e os lançamentos de
// KPI. Sem acesso a rede nem a banco, para poder ser testada fora do servidor.
export const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const ANO = 2026;

export function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
export const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export function money(v) {
  const s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!/\d/.test(s)) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
const numero = (v) => { const n = money(v); return n == null ? null : n; };
export function canal(txt) {
  const t = norm(txt);
  if (!t || t === "none" || t === "-") return "Não informado";
  if (t.includes("indica")) return "Indicação";
  if (t.includes("social") || t.startsWith("ss ") || t.includes("bio instagram")) return "Social selling";
  if (["highmed","high med","hm4","hm8","hm ","icc","ice ","imersao","workshop","evento","presencial","base hm"].some((k) => t.includes(k))) return "Eventos";
  if (["aplicacao","fap","crmb","crm black","nativo","forms meta","polones","sessao estrategica","trafego","pre checkout"].some((k) => t.includes(k))) return "Aplicação (tráfego pago)";
  if (["secretaria","consultorio","precifica","celebridade","consultas vendedoras","sml","mentor","hotmart"].some((k) => t.includes(k))) return "Produtos de entrada";
  return "Outros";
}
export function pessoa(txt) {
  const t = norm(txt);
  if (!t || t === "none") return "Não informado";
  if (t.includes("alefe") || t === "freitas") return "Alefe";
  if (t.includes("lucas")) return "Lucas";
  const p = String(txt).trim().split(/\s+/)[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}
// "01/09/2026", "01-09-2026", "08//09/2026", "03/09" (sem ano) -> {y,m,d}
export function parseData(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})[\/\-.]+(\d{1,2})(?:[\/\-.]+(\d{2,4}))?$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = m[3] ? (m[3].length <= 2 ? 2000 + +m[3] : +m[3]) : ANO;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}
const iso = (x) => `${x.y}-${String(x.m).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;
const dias = (a, b) => Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);

// ---- aba "Vendas Detalhadas": todas as vendas do ano, separadas por mês ----
export function lerVendas(rows) {
  const porMes = {}; let mes = null, ult = null;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const c = (k) => (r[k] ?? "").trim();
    if (c(0) && r.slice(1).every((v) => !String(v ?? "").trim())) {
      const k = MESES.findIndex((x) => norm(x) === norm(c(0)));
      mes = k >= 0 ? k + 1 : null; ult = null; continue;
    }
    if (mes == null || norm(c(0)) === "nome") continue;
    const valor = money(c(12));
    if (!c(0) || valor == null) continue;
    const dc = parseData(c(6));
    const dia = dc && dc.y === ANO && dc.m === mes ? dc : (ult || { y: ANO, m: mes, d: 1 }); ult = dia;
    const p = norm(c(17)); const semEduzz = p.replace("eduzz", "");
    const plat = (semEduzz.includes("as") && p.includes("eduzz")) ? "Asaas e Eduzz"
      : (semEduzz.includes("as") && !["", "-", "none"].includes(p) && !p.includes("cart")) ? "Asaas"
      : p.includes("eduzz") ? "Eduzz" : p.includes("cart") ? "Cartão de crédito" : "Não informado";
    (porMes[mes] ??= { vd: [], semVendedor: 0, semOrigem: 0, semContrato: 0, brutos: new Set() });
    const o = porMes[mes]; const bruto = c(9) || c(8);
    o.vd.push([valor, money(c(13)) || 0, pessoa(c(7)), canal(bruto), norm(c(3)) === "assinou" ? 1 : 0, plat, c(10) || "Não informado", iso(dia)]);
    if (!c(7)) o.semVendedor++; if (!(c(8) || c(9))) o.semOrigem++; if (norm(c(3)) !== "assinou") o.semContrato++;
    if (bruto) o.brutos.add(bruto);
  }
  return porMes;
}
// ---- aba "Comercial <Mês> <Ano>": uma linha por reunião ----
export function lerAgenda(rows, mes) {
  const ag = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]; const c = (k) => (r[k] ?? "").trim();
    if (!c(0) && !c(1)) continue;
    const comp = norm(c(6)), comprou = norm(c(5));
    const inc = parseData(c(2)), reu = parseData(c(3));
    const e = inc && reu ? dias(inc, reu) : null;
    const dia = reu && reu.y === ANO && reu.m === mes ? reu : { y: ANO, m: mes, d: 1 };
    ag.push([canal(c(1)), pessoa(c(7)), c(8) ? pessoa(c(8)) : "", comp === "pendente" ? null : (comp === "sim" ? 1 : 0),
      comprou === "sim" ? 1 : 0, comprou === "pendente" && comp === "sim" ? 1 : 0, e != null && e >= 0 && e <= 60 ? e : null, iso(dia)]);
  }
  let resumoSdr = null, resumoCloser = null;
  for (let i = 1; i < Math.min(rows.length, 11); i++) {
    if (norm(rows[i][13]) === "total") resumoSdr = numero(rows[i][18]);
    if (norm(rows[i][23]) === "totais") resumoCloser = numero(rows[i][25]);
  }
  return { ag, resumoSdr, resumoCloser };
}
// ---- aba do mês ("Setembro"): funil por dia, um bloco por funil ----
export function lerFunil(rows, mes) {
  const hdr = rows[0] || []; const tot = hdr.findIndex((h) => norm(h) === "totais");
  let leads = null, mqls = null, vendasAba = tot >= 0 ? 0 : null;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const a = norm(rows[i][0]);
    if (a === "leads" && leads == null) leads = tot >= 0 ? numero(rows[i][tot]) : null;
    if (a.startsWith("mql") && mqls == null) mqls = tot >= 0 ? numero(rows[i][tot]) : null;
  }
  const diario = []; let cols = {};
  for (let i = 0; i < Math.min(rows.length, 140); i++) {
    const r = rows[i]; const a = norm(r[0]);
    if (r.slice(1, 7).some((v) => norm(v).startsWith("semana"))) {
      cols = {};
      r.forEach((h, c) => {
        const n = norm(h); const m = String(h ?? "").trim().match(/(\d{1,2})\s*$/);
        if (c > 0 && m && !n.startsWith("semana") && !["totais","meta","media","melhor semana"].includes(n) && +m[1] >= 1 && +m[1] <= 31) cols[c] = +m[1];
      });
      continue;
    }
    if (tot >= 0 && (a.startsWith("vendas") || a.includes("blacks"))) { const v = numero(r[tot]); if (v != null) vendasAba += v; }
    const k = a === "leads" ? "Leads" : a.startsWith("mql") ? "MQLs" : null;
    if (k) for (const c in cols) { const v = numero(r[c]); if (v != null && v > 0) diario.push([k, iso({ y: ANO, m: mes, d: cols[c] }), v]); }
  }
  return { leads, mqls, vendasAba, diario };
}
const FAIXAS = [["Mesmo dia",0,0],["1 a 2 dias",1,2],["3 a 5 dias",3,5],["6 a 9 dias",6,9],["10 dias ou mais",10,99]];
// Monta o objeto do mês que o painel consome. `antigo` é o mês já guardado,
// usado quando a aba do mês não está mais visível na planilha.
export function montarMes(n, vendas, agenda, funil, antigo) {
  const vd = vendas ? vendas.vd : (antigo?.vd || []);
  const ag = agenda ? agenda.ag : (antigo?.ag || []);
  const fat = vd.reduce((s, v) => s + v[0], 0);
  const porCanal = {};
  for (const v of vd) { (porCanal[v[3]] ??= { nome: v[3], vendas: 0, valor: 0 }); porCanal[v[3]].vendas++; porCanal[v[3]].valor += v[0]; }
  const fech = ag.filter((a) => a[3] !== null);
  const qa = antigo?.qualidade || {};
  return {
    mes: MESES[n - 1], n, vendas: vd.length, faturamento: fat, entrada: vd.reduce((s, v) => s + v[1], 0), ticket: vd.length ? fat / vd.length : 0,
    leads: funil ? funil.leads : (antigo?.leads ?? null), mqls: funil ? funil.mqls : (antigo?.mqls ?? null),
    agendadas: fech.length, realizadas: fech.filter((a) => a[3] === 1).length,
    vendas_agenda: ag.filter((a) => a[4]).length, decisao_pendente: ag.filter((a) => a[5]).length,
    canais_venda: Object.values(porCanal).sort((a, b) => b.valor - a.valor),
    espera: FAIXAS.map(([faixa, a, b]) => { const s = fech.filter((x) => x[6] != null && x[6] >= a && x[6] <= b); return { faixa, agendadas: s.length, realizadas: s.filter((x) => x[3] === 1).length }; }),
    qualidade: {
      vendas_detalhadas: vd.length, vendas_agenda: ag.filter((a) => a[4]).length,
      vendas_resumo_sdr: agenda ? agenda.resumoSdr : (qa.vendas_resumo_sdr ?? null),
      vendas_resumo_closer: agenda ? agenda.resumoCloser : (qa.vendas_resumo_closer ?? null),
      vendas_aba_mes: funil ? funil.vendasAba : (qa.vendas_aba_mes ?? null),
      sem_vendedor: vendas ? vendas.semVendedor : (qa.sem_vendedor ?? 0), sem_origem: vendas ? vendas.semOrigem : (qa.sem_origem ?? 0),
      sem_contrato: vendas ? vendas.semContrato : (qa.sem_contrato ?? 0), grafias_origem: vendas ? vendas.brutos.size : (qa.grafias_origem ?? 0),
    },
    ag, vd,
  };
}
// ---- lançamentos de KPI: [pessoa, kpi, data, valor] ----
export const KPIS_VENDA = ["Vendas", "Faturamento", "Entrada recebida"];
export const KPIS_AGENDA = ["Reuniões agendadas", "Reuniões realizadas", "No-show", "Calls do closer", "Leads", "MQLs"];
export const MKT = "Marketing (todos os funis)", SEM_V = "Sem vendedor informado", SEM_S = "Sem SDR informado";
export function lancamentos(vendasPorMes, agendas, funis) {
  const acc = new Map();
  const add = (p, k, d, v) => { if (!v) return; const key = `${p}|${k}|${d}`; acc.set(key, (acc.get(key) || 0) + v); };
  for (const m in vendasPorMes) for (const v of vendasPorMes[m].vd) {
    const p = v[2] === "Não informado" ? SEM_V : v[2];
    add(p, "Vendas", v[7], 1); add(p, "Faturamento", v[7], v[0]); add(p, "Entrada recebida", v[7], v[1]);
  }
  for (const m in agendas) for (const a of agendas[m].ag) {
    if (a[3] === null) continue;
    const s = a[1] === "Não informado" ? SEM_S : a[1];
    add(s, "Reuniões agendadas", a[7], 1);
    if (a[3] === 1) { add(s, "Reuniões realizadas", a[7], 1); if (a[2]) add(a[2], "Calls do closer", a[7], 1); }
    else add(s, "No-show", a[7], 1);
  }
  for (const m in funis) for (const [k, d, v] of funis[m].diario) add(MKT, k, d, v);
  return [...acc.entries()].map(([key, v]) => { const [p, k, d] = key.split("|"); return [p, k, d, Math.round(v * 100) / 100]; });
}
// Qual mês uma aba representa: "Setembro" -> funil de 9; "Comercial Setembro 2026" -> agenda de 9
export function classificarAba(nome) {
  const t = String(nome).trim();
  if (norm(t) === "vendas detalhadas") return { tipo: "vendas" };
  const i = MESES.findIndex((m) => norm(m) === norm(t));
  if (i >= 0) return { tipo: "funil", mes: i + 1 };
  const m = t.match(/^Comercial\s+(.+?)\s+(\d{4})$/i);
  if (m && +m[2] === ANO) { const j = MESES.findIndex((x) => norm(x) === norm(m[1])); if (j >= 0) return { tipo: "agenda", mes: j + 1 }; }
  return null;
}
