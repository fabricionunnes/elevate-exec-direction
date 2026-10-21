import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// Busca de aplicativos da tela inicial do Nexus (Fabrício, 21/10/2026): "um campo de busca por
// aplicativo, pra buscar as funcionalidades, ex. UNV Office, e já abrir por lá; todos os módulos".
// Quem chama monta a lista já filtrada pelas mesmas permissões dos menus (o que a pessoa não vê
// no menu também não aparece aqui). Atalho: Ctrl+K / Cmd+K.

export type AppDaBusca = {
  titulo: string;
  caminho: string;
  grupo: string;
  palavras?: string; // sinônimos que também acham o item (ex.: "whatsapp conversas" pro Atendimento)
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BuscaAplicativos({ apps }: { apps: AppDaBusca[] }) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // agrupa e tira duplicados (mesmo caminho em dois menus)
  const grupos = useMemo(() => {
    const vistos = new Set<string>();
    const mapa = new Map<string, AppDaBusca[]>();
    for (const a of apps) {
      const chave = `${a.titulo}|${a.caminho}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      if (!mapa.has(a.grupo)) mapa.set(a.grupo, []);
      mapa.get(a.grupo)!.push(a);
    }
    return [...mapa.entries()];
  }, [apps]);

  const abrir = (caminho: string) => {
    setAberto(false);
    navigate(caminho);
  };

  const atalho = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="h-9 w-48 xl:w-64 flex items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
        title="Buscar e abrir qualquer módulo do Nexus"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">Buscar aplicativo...</span>
        <kbd className="hidden xl:inline rounded border bg-muted px-1.5 text-[10px] font-medium">{atalho}</kbd>
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="overflow-hidden p-0 shadow-lg max-w-xl">
          <DialogTitle className="sr-only">Buscar aplicativo</DialogTitle>
          <Command
            filter={(valor, busca) => {
              const v = semAcento(valor);
              const termos = semAcento(busca).split(/\s+/).filter(Boolean);
              if (!termos.length) return 1;
              if (!termos.every((t) => v.includes(t))) return 0;
              return v.startsWith(termos[0]) ? 1 : 0.6;
            }}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
          >
            <CommandInput placeholder="Digite o nome do módulo, ex.: UNV Office, Atendimento, Contas a Pagar..." />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>Nenhum aplicativo encontrado.</CommandEmpty>
              {grupos.map(([grupo, itens]) => (
                <CommandGroup key={grupo} heading={grupo}>
                  {itens.map((a) => (
                    <CommandItem
                      key={`${a.titulo}|${a.caminho}`}
                      value={`${a.titulo} ${a.grupo} ${a.palavras || ""} ${a.caminho}`}
                      onSelect={() => abrir(a.caminho)}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate">{a.titulo}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{a.grupo}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
