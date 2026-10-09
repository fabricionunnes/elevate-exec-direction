import { useRef, useState } from "react";
import { clsx } from "clsx";
import type { ProductMedia } from "@/lib/types";

/** Galeria horizontal com rolagem por toque (fotos e vídeos). */
export function Gallery({ media, cover, alt }: { media: ProductMedia[]; cover?: string | null; alt: string }) {
  const items: { kind: "image" | "video"; url: string; id: string }[] = media.length
    ? media.map((m) => ({ kind: m.kind, url: m.url, id: m.id }))
    : cover ? [{ kind: "image", url: cover, id: "cover" }] : [];
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  if (items.length === 0) {
    return <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-rosa-100 to-caramelo-400/30 text-6xl">🎂</div>;
  }

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="relative">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
          {items.map((m, i) => <span key={m.id} className={clsx("h-1.5 rounded-full bg-white shadow", i === idx ? "w-4 opacity-100" : "w-1.5 opacity-60")} />)}
        </div>
      )}
    </div>
  );
}
