import { clsx } from "clsx";
import { X } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "wa";
type Size = "sm" | "md" | "lg";

export function Button({ variant = "primary", size = "md", className, loading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  const v: Record<Variant, string> = {
    primary: "bg-vinho-600 text-white hover:bg-vinho-700 shadow-sm",
    secondary: "bg-choco-100 text-choco-800 hover:bg-choco-200",
    ghost: "bg-transparent text-choco-700 hover:bg-choco-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-choco-200 bg-white text-choco-800 hover:bg-choco-50",
    wa: "bg-[#25D366] text-white hover:bg-[#1ebe5a] shadow-sm",
  };
  const s: Record<Size, string> = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };
  return (
    <button
      className={clsx("inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed", v[variant], s[size], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

export function Input({ className, label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-choco-800">{label}</span>}
      <input
        className={clsx("h-11 w-full rounded-xl border bg-white px-3 text-choco-900 outline-none ring-vinho-300 placeholder:text-choco-300 focus:ring-2", error ? "border-red-400" : "border-choco-200", className)}
        {...rest}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-choco-500">{hint}</span> : null}
    </label>
  );
}

export function Textarea({ className, label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-choco-800">{label}</span>}
      <textarea className={clsx("w-full rounded-xl border border-choco-200 bg-white px-3 py-2 text-choco-900 outline-none ring-vinho-300 placeholder:text-choco-300 focus:ring-2", className)} rows={3} {...rest} />
    </label>
  );
}

export function Select({ className, label, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-choco-800">{label}</span>}
      <select className={clsx("h-11 w-full rounded-xl border border-choco-200 bg-white px-3 text-choco-900 outline-none ring-vinho-300 focus:ring-2", className)} {...rest}>
        {children}
      </select>
    </label>
  );
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={clsx("rounded-2xl border border-choco-100 bg-white p-4 shadow-card", className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-base font-bold text-choco-900">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", className)}>{children}</span>;
}

export function Stat({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "accent" }) {
  const t = { default: "text-choco-900", good: "text-emerald-700", bad: "text-red-700", accent: "text-vinho-600" }[tone];
  return (
    <div className="rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-choco-500">{label}</div>
      <div className={clsx("mt-1 text-2xl font-black", t)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-choco-500">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-choco-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className={clsx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-creme p-5 shadow-soft sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-choco-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-choco-500 hover:bg-choco-100" aria-label="Fechar"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-choco-200 p-8 text-center text-sm text-choco-500">{children}</div>;
}

export function Spinner() {
  return <div className="flex justify-center p-8"><span className="h-6 w-6 animate-spin rounded-full border-2 border-vinho-600 border-t-transparent" /></div>;
}

export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={clsx("transition", onChange && "hover:scale-110")}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= value ? "#f0801f" : "none"} stroke={n <= value ? "#f0801f" : "#d4a97c"} strokeWidth="1.8">
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Toast ---------------- */
interface Toast { id: number; text: string; kind: "ok" | "err" }
const ToastCtx = createContext<{ toast: (text: string, kind?: "ok" | "err") => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const toast = (text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {list.map((t) => (
          <div key={t.id} className={clsx("pointer-events-auto rounded-xl px-4 py-2 text-sm font-medium text-white shadow-soft", t.kind === "ok" ? "bg-choco-800" : "bg-red-600")}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast fora do ToastProvider");
  return c.toast;
}
