import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Banner } from "@/lib/types";

/** Carrossel de banners: passa sozinho a cada 5 s, arrasta no celular, setas e pontinhos no computador. */
export function BannerCarousel({ banners, onProduct }: { banners: Banner[]; onProduct: (productId: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const pausedUntil = useRef(0);

  const go = (i: number) => {
    const el = ref.current;
    if (!el || banners.length === 0) return;
    const n = (i + banners.length) % banners.length;
    const child = el.children[n] as HTMLElement | undefined;
    if (child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
    setIdx(n);
  };

  // passa sozinho; pausa 8 s depois que o cliente mexe
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setIdx((cur) => {
        const n = (cur + 1) % banners.length;
        const el = ref.current;
        const child = el?.children[n] as HTMLElement | undefined;
        if (el && child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
        return n;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const left = el.scrollLeft + el.clientWidth / 2;
    const n = kids.findIndex((k) => k.offsetLeft - el.offsetLeft <= left && k.offsetLeft - el.offsetLeft + k.offsetWidth > left);
    if (n >= 0) setIdx(n);
  };
  const userTouched = () => { pausedUntil.current = Date.now() + 8000; };

  if (banners.length === 0) return null;

  return (
    <section className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        onTouchStart={userTouched}
        onPointerDown={userTouched}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {banners.map((b) => {
          const inner = (
            <div className="relative aspect-[16/7] w-[calc(100vw-2rem)] max-w-3xl shrink-0 snap-center overflow-hidden rounded-3xl shadow-soft sm:w-[704px]">
              {b.media_kind === "video"
                ? <video src={b.image_url} className="h-full w-full object-cover" autoPlay muted loop playsInline />
                : <img src={b.image_url} alt={b.title} className="h-full w-full object-cover" />}
              {(b.title || b.subtitle) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-choco-900/80 to-transparent p-4 text-white">
                  {b.title && <div className="text-lg font-black leading-tight">{b.title}</div>}
                  {b.subtitle && <div className="text-sm text-rosa-100">{b.subtitle}</div>}
                </div>
              )}
            </div>
          );
          if (b.product_id) return <button key={b.id} onClick={() => onProduct(b.product_id!)} className="text-left">{inner}</button>;
          if (b.link_url) return <a key={b.id} href={b.link_url} target="_blank" rel="noreferrer">{inner}</a>;
          return <div key={b.id}>{inner}</div>;
        })}
      </div>
      {banners.length > 1 && (
        <>
          <button type="button" onClick={() => { userTouched(); go(idx - 1); }} aria-label="Anterior" className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-choco-800 shadow hover:bg-white sm:block"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => { userTouched(); go(idx + 1); }} aria-label="Próximo" className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-choco-800 shadow hover:bg-white sm:block"><ChevronRight size={20} /></button>
          <div className="mt-2 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button key={b.id} type="button" onClick={() => { userTouched(); go(i); }} aria-label={`Banner ${i + 1}`} className={clsx("h-2 rounded-full transition", i === idx ? "w-5 bg-vinho-600" : "w-2 bg-choco-200")} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
