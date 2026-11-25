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

/* Preenche tudo que depende da turma: [data-t="campo"] recebe o texto */
function preencher(t){
  var d = dataExtenso(t.data_evento);
  var v = {
    semana: d.semana, semanaCap: d.semana.charAt(0).toUpperCase() + d.semana.slice(1), data: d.curto, dataLonga: d.dia + " de " + d.mesNome,
    horario: t.horario, cidade: t.cidade, preco: brl(t.preco_cents), precoSocio: brl(t.preco_socio_cents), vagas: t.vagas, restantes: t.restantes,
    promessa: t.promessa || "", local: t.local_nome || ("Hotel em " + t.cidade)
  };
  Array.prototype.forEach.call(document.querySelectorAll("[data-t]"), function(el){ var k = el.getAttribute("data-t"); if(v[k] !== undefined && v[k] !== null) el.textContent = v[k]; });
  /* vagas restantes só aparecem quando o servidor manda o número (menos de 10 sobrando) */
  var sabe = t.restantes !== null && t.restantes !== undefined;
  Array.prototype.forEach.call(document.querySelectorAll("[data-resta]"), function(el){ el.style.display = (el.getAttribute("data-resta") === "sim") === sabe ? "" : "none"; });
  return v;
}

window.MiniEvento = { api: api, qp: qp, sessao: sessao, utm: utm, slug: slug, comTurma: comTurma, brl: brl, dataExtenso: dataExtenso, esc: esc, pixel: pixel, evento: evento, preencher: preencher };
})();
