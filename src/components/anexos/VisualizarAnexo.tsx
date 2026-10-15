// Visualizar anexo sem baixar, igual em todo o Nexus (tarefas, documentos, contratos, CRM, Social).
// Uso: const visor = useVisualizarAnexo();  visor.abrir({ nome, tipo, bucket, path }) ou { nome, tipo, url }
//      e renderizar {visor.janela} uma vez no componente.
// Bucket privado: gera link assinado de 1h. PDF/texto em iframe, imagem, vídeo, áudio;
// Word/Excel/PowerPoint pelo visualizador do Google; tipo que o navegador não mostra abre em nova aba.
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ExternalLink, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type AnexoParaVer = {
  nome: string;
  tipo?: string | null;
  /** arquivo em bucket privado */
  bucket?: string;
  path?: string;
  /** ou um link já pronto (bucket público) */
  url?: string;
};

type Tipo = "imagem" | "pdf" | "video" | "audio" | "texto" | "office" | "outro";

export function tipoDoAnexo(nome: string, mime?: string | null): Tipo {
  const t = (mime || "").toLowerCase();
  const ext = (nome.split(".").pop() || "").toLowerCase();
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "imagem";
  if (t.includes("pdf") || ext === "pdf") return "pdf";
  if (t.startsWith("video/") || ["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (t.startsWith("audio/") || ["mp3", "ogg", "oga", "wav", "m4a", "opus"].includes(ext)) return "audio";
  if (t.startsWith("text/") || ["txt", "csv", "json", "md"].includes(ext)) return "texto";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext) || /word|excel|spreadsheet|presentation|powerpoint/.test(t)) return "office";
  return "outro";
}

export function useVisualizarAnexo() {
  const [vendo, setVendo] = useState<{ nome: string; tipo: Tipo; url: string } | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const abrir = useCallback(async (a: AnexoParaVer) => {
    const chave = a.path || a.url || a.nome;
    setAbrindo(chave);
    try {
      let url = a.url || "";
      if (!url && a.bucket && a.path) {
        const { data, error } = await supabase.storage.from(a.bucket).createSignedUrl(a.path, 60 * 60);
        if (error || !data?.signedUrl) throw error || new Error("sem link");
        url = data.signedUrl;
      }
      if (!url) throw new Error("anexo sem endereço");
      const tipo = tipoDoAnexo(a.nome, a.tipo);
      if (tipo === "outro") window.open(url, "_blank", "noopener");
      else setVendo({ nome: a.nome, tipo, url });
    } catch (e) {
      console.error("visualizar anexo:", e);
      toast.error("Não consegui abrir o arquivo");
    } finally {
      setAbrindo(null);
    }
  }, []);

  const baixar = async () => {
    if (!vendo) return;
    try {
      const r = await fetch(vendo.url);
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = u; el.download = vendo.nome; el.click();
      URL.revokeObjectURL(u);
    } catch {
      window.open(vendo.url, "_blank", "noopener");
    }
  };

  const janela = (
    <Dialog open={!!vendo} onOpenChange={(o) => !o && setVendo(null)}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3 p-4">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
          <DialogTitle className="truncate text-base">{vendo?.nome}</DialogTitle>
          <div className="flex shrink-0 gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => vendo && window.open(vendo.url, "_blank", "noopener")}>
              <ExternalLink className="h-3.5 w-3.5" />Nova aba
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={baixar}>
              <Download className="h-3.5 w-3.5" />Baixar
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
          {vendo?.tipo === "imagem" && <img src={vendo.url} alt={vendo.nome} className="mx-auto max-h-full max-w-full object-contain" />}
          {vendo?.tipo === "video" && <video src={vendo.url} controls className="mx-auto max-h-full max-w-full" />}
          {vendo?.tipo === "audio" && <div className="flex h-full items-center justify-center p-6"><audio src={vendo.url} controls className="w-full max-w-lg" /></div>}
          {vendo?.tipo === "office" && (
            <iframe title={vendo.nome} className="h-full w-full" src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(vendo.url)}`} />
          )}
          {(vendo?.tipo === "pdf" || vendo?.tipo === "texto") && <iframe title={vendo.nome} className="h-full w-full bg-white" src={vendo.url} />}
        </div>
      </DialogContent>
    </Dialog>
  );

  return { abrir, abrindo, janela };
}

/** Botão do olho, mesmo visual nas listas de anexo. */
export function BotaoVisualizar({ onClick, carregando, className = "h-7 w-7" }: { onClick: () => void; carregando?: boolean; className?: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" className={className} title="Visualizar" onClick={onClick} disabled={carregando}>
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}
