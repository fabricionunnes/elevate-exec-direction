/* Mini-evento: comum às três páginas (venda, checkout, obrigado). Fala com a função mini-evento do Nexus. */
(function(){
"use strict";
var SUPA = "https://xrncvhzxjmddqluxoosu.supabase.co";
var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk";
var FN = SUPA + "/functions/v1/mini-evento";
var PIXEL = "2043723569621789";
var DIAS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
var MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function qp(n){ try { return new URLSearchParams(location.search).get(n) || undefined; } catch(e){ return undefined; } }
function api(body){
  return fetch(FN, { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer " + ANON, "apikey": ANON }, body: JSON.stringify(body) })
    .then(function(r){ return r.json().then(function(d){ if(!r.ok || d.error){ var e = new Error(d && d.error || r.status); e.code = d && d.error; e.detalhe = d && d.detalhe; throw e; } return d; }); });
}
function sessao(){
  try { var s = localStorage.getItem("unv_miniev_sessao"); if(!s){ s = Date.now().toString(36) + Math.random().toString(36).slice(2,10); localStorage.setItem("unv_miniev_sessao", s); } return s; }
  catch(e){ return "s" + Date.now().toString(36); }
}
/* UTM: guarda o que veio na URL pra chegar até o checkout */
function utm(){
  var chaves = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid"], o = {};
  try { o = JSON.parse(sessionStorage.getItem("unv_miniev_utm") || "{}"); } catch(e){}
  chaves.forEach(function(k){ var v = qp(k); if(v) o[k] = v; });
  try { sessionStorage.setItem("unv_miniev_utm", JSON.stringify(o)); } catch(e){}
  return o;
}
function slug(){ return qp("t") || ""; }
function comTurma(href){ var s = slug(); return s ? href + (href.indexOf("?") < 0 ? "?" : "&") + "t=" + encodeURIComponent(s) : href; }
function brl(cents){ return (cents/100).toLocaleString("pt-BR", { style:"currency", currency:"BRL" }).replace(",00",""); }
function dataExtenso(ymd){ var p = String(ymd).split("-"); var d = new Date(+p[0], +p[1]-1, +p[2]); return { dia: p[2], mes: p[1], semana: DIAS[d.getDay()], mesNome: MESES[d.getMonth()], curto: p[2] + "/" + p[1] }; }
/* "em Belo Horizonte", mas "na Grande BH" */
function emCidade(c){ return (/^grande\s/i.test(String(c || "")) ? "na " : "em ") + c; }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]; }); }

/* Pixel do Meta */
function pixel(){
  if(window.fbq) return;
  window.fbq = function(){ window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments); };
  window._fbq = window.fbq; window.fbq.push = window.fbq; window.fbq.loaded = true; window.fbq.version = "2.0"; window.fbq.queue = [];
  window.fbq("init", PIXEL); window.fbq("track", "PageView");
  var carrega = function(){ var t = document.createElement("script"); t.async = true; t.src = "https://connect.facebook.net/en_US/fbevents.js"; document.head.appendChild(t); };
  if(document.readyState === "complete") setTimeout(carrega, 0); else window.addEventListener("load", function(){ setTimeout(carrega, 0); });
  return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq("init", PIXEL); window.fbq("track", "PageView");
}
function evento(nome, dados, opcoes){ try { if(window.fbq) window.fbq("track", nome, dados || {}, opcoes || {}); } catch(e){} }
function eventoProprio(nome, dados){ try { if(window.fbq) window.fbq("trackCustom", nome, dados || {}); } catch(e){} }

/* Preenche tudo que depende da turma: [data-t="campo"] recebe o texto */
function preencher(t){
  var d = dataExtenso(t.data_evento);
  var v = {
    semana: d.semana, semanaCap: d.semana.charAt(0).toUpperCase() + d.semana.slice(1), data: d.curto, dataLonga: d.dia + " de " + d.mesNome,
    horario: t.horario, cidade: t.cidade, preco: brl(t.preco_cents), precoSocio: brl(t.preco_socio_cents), vagas: t.vagas, restantes: t.restantes,
    promessa: t.promessa || "", emCidade: emCidade(t.cidade), EmCidade: emCidade(t.cidade).replace(/^./, function(c){ return c.toUpperCase(); })
  };
  v.local = t.local_nome || v.EmCidade;
  Array.prototype.forEach.call(document.querySelectorAll("[data-t]"), function(el){ var k = el.getAttribute("data-t"); if(v[k] !== undefined && v[k] !== null) el.textContent = v[k]; });
  /* vagas restantes só aparecem quando o servidor manda o número (menos de 10 sobrando) */
  var sabe = t.restantes !== null && t.restantes !== undefined;
  Array.prototype.forEach.call(document.querySelectorAll("[data-resta]"), function(el){ el.style.display = (el.getAttribute("data-resta") === "sim") === sabe ? "" : "none"; });
  return v;
}

/* As 10 promessas do teste. O anúncio manda ?p=N e a página repete a mesma headline (o que a pessoa clicou é o que ela lê). */
var PROMESSAS = {
  1:  ["Empresário de BH: 2027 começa em menos de um mês.", "Como fazer um *planejamento comercial de 2027* que bate meta desde janeiro, mesmo sem consultoria"],
  2:  ["12 meses. 12 metas batidas.", "Como *bater meta nos 12 meses* de 2027, mesmo sem aumentar o time"],
  3:  ["Se você tirar 15 dias de férias, sua empresa vende?", "Como *tirar o dono do comercial* e vender mais, mesmo sem contratar gerente"],
  4:  ["Quanto sua empresa vai vender mês que vem?", "Como ter *previsibilidade de vendas* e saber no dia 1 quanto vai faturar, mesmo sem mais verba"],
  5:  ["Seu vendedor não bate meta. A culpa é dele ou do processo?", "Como ter um *time de vendas que bate meta* sem você cobrar, mesmo sem trocar de vendedor"],
  6:  ["Você não precisa de mais lead.", "Como *dobrar a conversão* dos leads que você já paga, mesmo sem aumentar a verba"],
  7:  ["Lead sem resposta é venda perdida.", "Como ter um *time de IA no comercial* que responde em 1 minuto, mesmo sem entender de tecnologia"],
  8:  ["Sua empresa está perdendo venda. Você sabe onde?", "Como achar onde sua empresa perde venda com um *diagnóstico comercial,* mesmo sem consultoria"],
  9:  ["Sistema escala. Improviso não.", "Como criar uma *máquina de vendas* que bate meta toda semana, sem depender do dono"],
  10: ["Sem palco. Sem plateia de 500 pessoas.", "Como *25 empresários de BH* vão montar o comercial de 2027 em uma *sala fechada,* sem parar a empresa"]
};
/* promessa da visita: vem em ?p= e fica guardada pra seguir da captura até o checkout */
function promessaN(){
  var p = qp("p");
  try { if(p && PROMESSAS[+p]) sessionStorage.setItem("unv_miniev_p", String(+p)); else p = sessionStorage.getItem("unv_miniev_p"); } catch(e){}
  return p && PROMESSAS[+p] ? +p : null;
}
function promessa(){ var n = promessaN(); return n ? { n: n, gancho: PROMESSAS[n][0], titulo: PROMESSAS[n][1] } : null; }
/* headline longa ganha letra menor, pra promessa caber sem tomar a tela */
function ajustaTitulo(el, p){ if(!el) return; var n = String(p||"").replace(/\*/g,"").length; el.classList.remove("t-media","t-longa"); if(n > 105) el.classList.add("t-longa"); else if(n > 75) el.classList.add("t-media"); }
function tituloHtml(p){
  var h = esc(p).replace(/\*(.+?)\*/g, '<span class="r">$1</span>');
  if(h.indexOf('class="r"') < 0){ var w = h.split(" "); if(w.length > 5){ var i = Math.max(2, w.length - 5); h = w.slice(0,i).join(" ") + ' <span class="r">' + w.slice(i, w.length-1).join(" ") + "</span> " + w[w.length-1]; } }
  return h;
}
/* quem preencheu o formulário: guarda pra ligar a visita e o checkout à pessoa e não pedir os dados de novo */
function leadSalvo(){ try { var l = JSON.parse(localStorage.getItem("unv_miniev_lead") || "null"); return l && l.id && Date.now() - l.em < 30*86400000 ? l : null; } catch(e){ return null; } }
function salvaLead(o){ try { var l = leadSalvo() || {}; for(var k in o) l[k] = o[k]; l.em = Date.now(); localStorage.setItem("unv_miniev_lead", JSON.stringify(l)); } catch(e){} }
/* ids do anúncio que vêm na URL */
function anuncio(){
  var o = {}; try { o = JSON.parse(sessionStorage.getItem("unv_miniev_ad") || "{}"); } catch(e){}
  ["ad_id","adset_id","campaign_id"].forEach(function(k){ var v = qp(k); if(v) o[k] = v; });
  try { sessionStorage.setItem("unv_miniev_ad", JSON.stringify(o)); } catch(e){}
  return o;
}
function seguir(href){ var n = promessaN(), u = comTurma(href); return n ? u + (u.indexOf("?") < 0 ? "?" : "&") + "p=" + n : u; }

window.MiniEvento = { api: api, qp: qp, sessao: sessao, utm: utm, slug: slug, comTurma: comTurma, brl: brl, dataExtenso: dataExtenso, esc: esc, pixel: pixel, evento: evento, preencher: preencher, promessa: promessa, promessaN: promessaN, tituloHtml: tituloHtml, ajustaTitulo: ajustaTitulo, leadSalvo: leadSalvo, salvaLead: salvaLead, eventoProprio: eventoProprio, anuncio: anuncio, seguir: seguir };
})();
