// Renderiza um post do diario UNV em pagina estatica e atualiza o indice do blog.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || ".";
const SHELL = fs.readFileSync(path.join(ROOT, "public/blog/_shell.html"), "utf8");
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

export function renderPost(p, dataISO) {
  const secs = p.secoes.map((s, i) => `
<section class="sec">
  <p class="eyebrow"><span>${esc(s.fase)}</span><span class="bar"></span><span>${esc(s.rotulo)}</span></p>
  <h2>${esc(s.titulo)}</h2>
  ${i === 0 && p.maxima ? `<div class="max"><p>${esc(p.maxima)}</p></div>` : ""}
  ${s.paragrafos.map((t) => `<p class="prose">${esc(t)}</p>`).join("\n  ")}
</section>`).join("\n");

  const acoes = `
<section class="sec">
  <p class="eyebrow"><span>Execução</span></p>
  <h2>O que fazer esta semana</h2>
  <ol class="acts">${p.acoes.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
</section>`;

  const hero = `
<header class="hero">
  <p class="eyebrow"><span>Diário UNV</span><span class="bar"></span><span class="tc">Método CRESCER</span><span class="bar"></span><span>${dataISO.split("-").reverse().join("/")}</span></p>
  <h1>${esc(p.titulo)}</h1>
  <p class="sub">${esc(p.resumo)}</p>
</header>`;

  return SHELL
    .replaceAll("{{TITULO}}", esc(p.titulo))
    .replaceAll("{{RESUMO}}", esc(p.resumo))
    .replaceAll("{{SLUG}}", p.slug)
    .replace("{{CORPO}}", hero + secs + acoes);
}

export function atualizarIndice(p, dataISO) {
  const f = path.join(ROOT, "public/blog/posts.json");
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  if (d.posts.some((x) => x.slug === p.slug)) return false;
  d.posts.unshift({
    slug: p.slug, url: `/blog/${p.slug}/`, titulo: p.titulo, resumo: p.resumo,
    tags: p.tags, tipo: "diario", data: dataISO,
    ts: Math.max(...d.posts.map((x) => x.ts)) + 1,
  });
  d.gerado_em = new Date().toISOString().slice(0, 19);
  fs.writeFileSync(f, JSON.stringify(d, null, 1));
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const post = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const hoje = new Date().toISOString().slice(0, 10);
  const dir = path.join(ROOT, "public/blog", post.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), renderPost(post, hoje));
  const novo = atualizarIndice(post, hoje);
  console.log(novo ? `publicado: /blog/${post.slug}/` : `ja existia: ${post.slug}`);
}
