// Blocos pesados ou pouco usados não vêm na RPC principal: cada tela busca o seu
// ao abrir (RPC painel_bloco, só master) e guarda enquanto o painel está aberto.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const guardado = new Map<string, unknown>();

/** joga fora o que está guardado (depois de sincronizar ou mudar configuração) */
export const limparBlocos = (): void => guardado.clear();

export function useBloco<T>(nome: string, mes: string): { dado: T | null; erro: string | null } {
  const chave = `${nome}|${mes}`;
  const [dado, setDado] = useState<T | null>((guardado.get(chave) as T) ?? null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    const ja = guardado.get(chave) as T | undefined;
    setErro(null);
    setDado(ja ?? null);
    if (ja) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("painel_bloco", { p_month: mes, p_nome: nome });
      if (!vivo) return;
      if (error) { setErro(error.message); return; }
      guardado.set(chave, data);
      setDado(data as T);
    })();
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return { dado, erro };
}
