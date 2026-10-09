import { useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductMedia } from "@/lib/types";

/** Galeria com rolagem por toque (celular) e setas/pontinhos (computador). Fotos e vídeos. */
export function Gallery({ media, cover, alt }: { media: ProductMedia[]; cover?: string | null; alt: string }) {
  // A capa escolhida no painel é sempre o primeiro slide; o resto segue a ordem da galeria.
  const rest = media.filter((m) => m.url !== cover).map((m) => ({ kind: m.kind, url: m.url, id: m.id }));
  const items: { kind: "image" | "video"; url: string; id: string }[] = cover
    ? [{ kind: "image" as const, url: cover, id: "cover" }, ...rest]
    : rest;
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  if (items.length === 0) {
    return <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-rosa-100 to-caramelo-400/30 text-6xl">🎂</div>;
  }

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const n = (i + items.length) % items.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    setIdx(n);
  };
  const onScroll = () => {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="group relative">
      <div ref={ref} onScroll={onScroll} className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none]">
        {items.map((m) => (
          <div key={m.id} className="h-full w-full shrink-0 snap-center bg-choco-900/5">
            {m.kind === "video" ? (
              <video src={m.url} className="h-full w-full object-cover" controls playsInline muted preload="metadata" />
            ) : (
              <img src={m.url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
            )}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button type="button" onClick={() => go(idx - 1)} aria-label="Anterior" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-choco-800 shadow transition hover:bg-white"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => go(idx + 1)} aria-label="Próxima" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-choco-800 shadow transition hover:bg-white"><ChevronRight size={20} /></button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {items.map((m, i) => (
              <button key={m.id} type="button" onClick={() => go(i)} aria-label={`Mídia ${i + 1}`} className={clsx("h-2 rounded-full bg-white shadow transition", i === idx ? "w-5 opacity-100" : "w-2 opacity-70")} />
            ))}
          </div>
          <span className="absolute right-2 top-2 rounded-full bg-choco-900/60 px-2 py-0.5 text-[11px] font-semibold text-white">{idx + 1}/{items.length}</span>
        </>
      )}
    </div>
  );
}
