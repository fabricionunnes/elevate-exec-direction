// Respostas rápidas dentro da caixa de mensagem do Atendimento (30/09/2026).
// O cadastro já existia (Configurações → Respostas rápidas, tabela crm_quick_responses)
// mas o chat não usava. Aqui: digitar "/" no início abre o painel com busca por atalho,
// título e texto; setas navegam, Enter insere, Esc fecha. O botão de raio abre o mesmo painel.
// Variáveis {{nome}}, {{primeiro_nome}} e {{telefone}} são trocadas pelos dados do lead/contato.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

export interface QuickResponse {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  category: string | null;
}

export interface QuickResponsesPickerHandle {
  /** devolve true quando consumiu a tecla (o composer não deve enviar) */
  handleKey: (e: React.KeyboardEvent) => boolean;
}

interface Props {
  open: boolean;
  query: string;
  variables: Record<string, string>;
  onPick: (text: string) => void;
  onClose: () => void;
}

const normalizar = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function applyQuickVariables(text: string, vars: Record<string, string>) {
  return String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function quickVariablesFor(conv: any): Record<string, string> {
  const nome = String(conv?.lead?.name || conv?.contact?.name || "").trim();
  const nomeValido = /[\p{L}]/u.test(nome) ? nome : "";
  return {
    nome: nomeValido,
    primeiro_nome: nomeValido.split(/\s+/)[0] || "",
    telefone: String(conv?.contact?.phone || "").replace(/\D/g, ""),
  };
}

export const QuickResponsesPicker = forwardRef<QuickResponsesPickerHandle, Props>(function QuickResponsesPicker(
  { open, query, variables, onPick, onClose },
  ref,
) {
  const [todas, setTodas] = useState<QuickResponse[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    (supabase as any)
      .from("crm_quick_responses")
      .select("id, title, content, shortcut, category")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }: any) => { if (ativo) setTodas((data || []) as QuickResponse[]); });
    return () => { ativo = false; };
  }, [open]);

  const lista = useMemo(() => {
    const q = normalizar(query.trim());
    if (!q) return todas;
    // atalho exato primeiro, depois quem começa com o termo, depois quem contém
    const peso = (r: QuickResponse) => {
      const atalho = normalizar(r.shortcut || "");
      if (atalho === q) return 0;
      if (atalho.startsWith(q)) return 1;
      if (normalizar(r.title).startsWith(q)) return 2;
      if (atalho.includes(q) || normalizar(r.title).includes(q) || normalizar(r.content).includes(q)) return 3;
      return 9;
    };
    return todas.map((r) => ({ r, p: peso(r) })).filter((x) => x.p < 9).sort((a, b) => a.p - b.p).map((x) => x.r);
  }, [todas, query]);

  useEffect(() => { setIdx(0); }, [query, open]);

  const escolher = (r: QuickResponse) => onPick(applyQuickVariables(r.content, variables));

  useImperativeHandle(ref, () => ({
    handleKey: (e) => {
      if (!open) return false;
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, Math.max(lista.length - 1, 0))); return true; }
      if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); return true; }
      if (e.key === "Escape") { e.preventDefault(); onClose(); return true; }
      if (e.key === "Enter" || e.key === "Tab") {
        if (lista[idx]) { e.preventDefault(); escolher(lista[idx]); return true; }
        return false;
      }
      return false;
    },
  }), [open, lista, idx, variables]);

  if (!open) return null;

  return (
    <div className="absolute left-0 right-0 bottom-full mb-2 z-30 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Respostas rápidas{query.trim() ? ` · "${query.trim()}"` : ""}</span>
        <span>Setas navegam · Enter insere · Esc fecha</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {todas.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhuma resposta rápida cadastrada. Cadastre em Configurações → Respostas rápidas.</p>
        ) : lista.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">Nada encontrado com "{query.trim()}".</p>
        ) : (
          lista.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIdx(i)}
              onClick={() => escolher(r)}
              className={cn("w-full text-left px-3 py-2 border-b border-border/60 last:border-b-0", i === idx ? "bg-muted" : "hover:bg-muted/50")}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{r.title}</span>
                {r.shortcut && <code className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">/{r.shortcut}</code>}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{applyQuickVariables(r.content, variables)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
});
