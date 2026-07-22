import { lazy, ComponentType } from "react";

/**
 * Igual ao React.lazy, mas se o carregamento do chunk falhar (erro clássico
 * "Failed to fetch dynamically imported module" — acontece quando um deploy novo
 * apaga o chunk que o index velho, ainda em cache no navegador, referencia),
 * recarrega a página UMA vez pra buscar o index atual. Sem isso, o iPhone com
 * cache preso simplesmente não carrega a página (ex: link de lançamento do
 * vendedor). O guard no sessionStorage evita loop de reload.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const key = "chunk-reload-at";
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(key) || "0");
      } catch {
        /* sessionStorage bloqueado (Safari privado) — segue pro throw */
      }
      const now = Date.now();
      // Só recarrega se não recarregou nos últimos 30s (evita loop infinito).
      if (now - last > 30000) {
        try {
          sessionStorage.setItem(key, String(now));
        } catch {
          /* ignore */
        }
        window.location.reload();
        // Mantém o Suspense pendente até o reload assumir.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
