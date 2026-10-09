import { clsx } from "clsx";

/** Ícone do sistema YasFood (garfo + colher formando o Y). */
export function YasFoodMark({ size = 40, className }: { size?: number; className?: string }) {
  return <img src="/yasfood-icon.svg" alt="YasFood" width={size} height={size} className={clsx("rounded-xl", className)} />;
}

/** Wordmark "YasFood": Yas em vinho, Food em marrom, como na logo. */
export function YasFoodWord({ size = "text-xl" }: { size?: string }) {
  return (
    <span className={clsx("font-black tracking-tight", size)}>
      <span className="text-vinho-600">Yas</span>
      <span className="text-choco-700">Food</span>
    </span>
  );
}
