import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rascunho automático de formulário público no próprio aparelho (localStorage).
 * Motivo: resposta de cliente se perdeu quando o envio falhou e a página foi recarregada
 * (kickoff da Simas Copos, 17/09/2026). Salva a cada alteração, restaura ao abrir, limpa ao enviar.
 *
 * - `key` nulo ou `ready` falso: não faz nada (espera o formulário carregar, pra não gravar vazio por cima).
 * - `apply` recebe o rascunho salvo UMA vez, depois que o formulário carregou.
 */
export function useFormDraft<T>(key: string | null | undefined, value: T, apply: (saved: T) => void, ready: boolean) {
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!key || !ready || loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.value !== undefined) { applyRef.current(d.value as T); setRestored(true); }
      }
    } catch { /* rascunho inválido: ignora */ }
  }, [key, ready]);

  useEffect(() => {
    if (!key || !ready || !loaded.current) return;
    try { localStorage.setItem(key, JSON.stringify({ value, em: new Date().toISOString() })); } catch { /* sem espaço: segue */ }
  }, [key, ready, value]);

  const clear = useCallback(() => {
    if (!key) return;
    try { localStorage.removeItem(key); } catch { /* ok */ }
  }, [key]);

  return { restored, clear };
}
