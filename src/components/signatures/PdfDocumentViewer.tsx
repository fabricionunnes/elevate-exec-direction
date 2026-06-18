import { useEffect, useRef, useState } from "react";
import { Loader2, ExternalLink, FileText } from "lucide-react";
// Worker do pdf.js como asset (string de URL) — necessário pro pdf.js renderizar
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * Renderiza TODAS as páginas do PDF em canvas, num container rolável.
 * Resolve o problema do <iframe> de PDF no iOS/Safari (só mostra a 1ª página
 * e não deixa passar pras próximas). Tem fallback "abrir em tela cheia".
 */
export function PdfDocumentViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        // disableRange/Stream = baixa o arquivo inteiro de uma vez (mais robusto
        // contra CORS/range em URLs assinadas do Supabase). Contrato é pequeno.
        const pdf = await pdfjs.getDocument({ url, disableRange: true, disableStream: true }).promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";
        const cssWidth = Math.min(container.clientWidth || 600, 900);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = (cssWidth / base.width) * dpr;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.marginBottom = "10px";
          canvas.style.borderRadius = "4px";
          canvas.style.boxShadow = "0 1px 4px rgba(0,0,0,.2)";
          container.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        console.error("[PdfDocumentViewer]", e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div>
      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando documento...
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível exibir o documento aqui. Toque abaixo para abrir.
          </p>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          maxHeight: "70vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: "#525659",
          padding: 10,
          borderRadius: 8,
          display: status === "ready" ? "block" : "none",
        }}
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ExternalLink className="h-4 w-4" />
        Abrir documento em tela cheia{numPages ? ` (${numPages} página${numPages > 1 ? "s" : ""})` : ""}
      </a>
    </div>
  );
}
