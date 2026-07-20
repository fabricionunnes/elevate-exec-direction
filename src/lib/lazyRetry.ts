// Lazy loading com RETRY — rede móvel oscilante derruba o download de chunks
// e o React.lazy padrão não tenta de novo: a tela fica no spinner PRA SEMPRE
// (era o formulário público travado no celular). Aqui: 2 novas tentativas com
// espera crescente e, em último caso, UM reload da página (flag em session
// storage evita loop de reload).
import { lazy } from "react";
import type { ComponentType } from "react";

const RELOAD_FLAG = "chunk-reload-at";

export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_FLAG);
        return mod;
      } catch (err) {
        lastErr = err;
        // espera 1s, depois 2s antes de tentar de novo
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    // 3 falhas seguidas: provável deploy no meio (chunk antigo sumiu) ou rede
    // muito ruim — recarrega a página UMA vez pra pegar o index novo.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
        window.location.reload();
        // segura a promise enquanto recarrega (evita flash de erro)
        await new Promise(() => undefined);
      }
    } catch {
      // sessionStorage indisponível: segue pro throw
    }
    throw lastErr;
  });
}
