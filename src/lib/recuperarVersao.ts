// Depois de um deploy, a aba aberta pode pedir um arquivo da versão anterior (ou um arquivo novo
// que ainda não chegou na borda). Em vez da tela "Algo deu errado", busca o arquivo de novo
// furando o cache do navegador e recarrega a página. No máximo uma vez por minuto, pra não
// entrar em laço se o problema for outro.
const ERRO_DE_VERSAO = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;
const CHAVE = "nexus-recarga-versao";

export const ehErroDeVersao = (msg: unknown) => ERRO_DE_VERSAO.test(String(msg ?? ""));

/** true = vai recarregar (a decisão é síncrona, pra quem chamou poder cancelar o erro na hora). */
export function recuperarVersao(msg: unknown): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) || 0);
    if (Date.now() - ultima < 60_000) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch { /* sem sessionStorage: segue e recarrega uma vez */ }
  const url = String(msg ?? "").match(/https?:\/\/[^\s'"]+\.(?:js|css)/)?.[0];
  void (async () => {
    if (url) {
      try { await fetch(url, { cache: "reload" }); } catch { /* sem rede: o reload resolve ou mostra o erro */ }
    }
    window.location.reload();
  })();
  return true;
}
