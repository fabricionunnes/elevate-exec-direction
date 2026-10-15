// Porteiro da pasta /assets (15/10/2026).
// Com not_found_handling = "single-page-application", pedir um arquivo de build que não existe
// (versão antiga, ou o segundo logo depois do deploy em que o arquivo novo ainda não chegou na
// borda) devolvia o index.html com 200 E com o cabeçalho de /assets/* (immutable, 1 ano).
// O navegador guardava esse HTML no lugar do JS e a tela "Algo deu errado / Failed to fetch
// dynamically imported module" não saía nem recarregando. Aqui: arquivo de /assets que não
// existe vira 404 sem cache, e o app (lib/recuperarVersao.ts) busca de novo e recarrega.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const tipo = res.headers.get("content-type") || "";
    if (tipo.includes("text/html")) {
      return new Response("Arquivo não encontrado (versão nova publicada, recarregue a página).", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return res;
  },
};
