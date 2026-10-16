// Texto de mensagem do WhatsApp com a formatação do próprio app: *negrito*, _itálico_,
// ~riscado~ e ```monoespaçado```, igual aparece no celular. Sem HTML: só texto e <b>/<i>/<s>.
// Uso: <TextoWhatsApp texto={message.content} /> no lugar de {message.content}.
import { Fragment, type ReactNode } from "react";

// mesma regra do WhatsApp: o marcador precisa abrir/fechar colado no texto (sem espaço do lado de dentro)
const PADRAO = /(```[\s\S]+?```|\*(?!\s)[^*\n]*?[^*\s]\*|_(?!\s)[^_\n]*?[^_\s]_|~(?!\s)[^~\n]*?[^~\s]~)/g;

function formatar(texto: string, chave = 0): ReactNode[] {
  const partes: ReactNode[] = [];
  let ultimo = 0; let i = chave;
  for (const m of texto.matchAll(PADRAO)) {
    const ini = m.index ?? 0;
    if (ini > ultimo) partes.push(texto.slice(ultimo, ini));
    const t = m[0];
    if (t.startsWith("```")) partes.push(<code key={i++} className="rounded bg-black/10 px-1 font-mono text-[0.9em]">{t.slice(3, -3)}</code>);
    else if (t.startsWith("*")) partes.push(<b key={i++}>{formatar(t.slice(1, -1), i * 100)}</b>);
    else if (t.startsWith("_")) partes.push(<i key={i++}>{formatar(t.slice(1, -1), i * 100)}</i>);
    else partes.push(<s key={i++}>{formatar(t.slice(1, -1), i * 100)}</s>);
    ultimo = ini + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function TextoWhatsApp({ texto }: { texto: string | null | undefined }) {
  if (!texto) return null;
  return <Fragment>{formatar(texto)}</Fragment>;
}

/** Versão em texto puro (prévia na lista): tira os marcadores em vez de mostrar *asteriscos*. */
export function textoWhatsAppLimpo(texto: string | null | undefined): string {
  return String(texto || "").replace(PADRAO, (t) => (t.startsWith("```") ? t.slice(3, -3) : t.slice(1, -1)));
}
