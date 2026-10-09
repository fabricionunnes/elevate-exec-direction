// Peças visuais do painel: barra com cara de bloco (3D) pro recharts, rosca 3D
// (three, com SVG de reserva), barra de meta e tooltip no tom da marca.
import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { brl } from "@/lib/format";

const Donut3DScene = lazy(() => import("./Donut3DScene"));

/* --------------------------- barra 3D (recharts shape) --------------------------- */
export const PALETA = { topo: "#f6b1c1", lado: "#85152c", frente: "url(#barVinho)", topo2: "#f3d5a8", lado2: "#8c5a2b", frente2: "url(#barCaramelo)" };

export function Barra3D(props: { x?: number; y?: number; width?: number; height?: number; fill?: string; tom?: "vinho" | "caramelo" | "cinza" }) {
  const { x = 0, y = 0, width = 0, height = 0, tom = "vinho" } = props;
  if (!height || height <= 0) return null;
  const dp = Math.min(7, Math.max(3, width * 0.22));
  const w = Math.max(2, width - dp);
  const cores = tom === "caramelo" ? { t: PALETA.topo2, l: PALETA.lado2, f: PALETA.frente2 } : tom === "cinza" ? { t: "#e6ccae", l: "#b8804d", f: "url(#barCinza)" } : { t: PALETA.topo, l: PALETA.lado, f: PALETA.frente };
  return (
    <g>
      <polygon points={`${x},${y} ${x + dp},${y - dp} ${x + w + dp},${y - dp} ${x + w},${y}`} fill={cores.t} />
      <polygon points={`${x + w},${y} ${x + w + dp},${y - dp} ${x + w + dp},${y + height - dp} ${x + w},${y + height}`} fill={cores.l} />
      <rect x={x} y={y} width={w} height={height} fill={cores.f} rx={1} />
    </g>
  );
}

/** Degradês usados pelas barras; colocar uma vez dentro de cada gráfico. */
export function Degrades() {
  return (
    <defs>
      <linearGradient id="barVinho" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e46683" /><stop offset="100%" stopColor="#a81b38" /></linearGradient>
      <linearGradient id="barCaramelo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6a35a" /><stop offset="100%" stopColor="#b86f26" /></linearGradient>
      <linearGradient id="barCinza" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6ccae" /><stop offset="100%" stopColor="#d4a97c" /></linearGradient>
      <linearGradient id="areaVinho" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dc3a5c" stopOpacity={0.35} /><stop offset="100%" stopColor="#dc3a5c" stopOpacity={0} /></linearGradient>
      <filter id="brilho" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
  );
}

/** Eixo em reais, curto: 850 → "850", 2.400 → "2,4k". */
export const kfmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(Math.round(v)));

export function Dica({ active, payload, label, dinheiro }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string; dinheiro?: string[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-choco-100 bg-white px-3 py-2 text-xs shadow-card">
      <div className="mb-1 font-bold text-choco-900">{label}</div>
      {payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-choco-700"><span className="h-2 w-2 rounded-full" style={{ background: p.color ?? "#cd2345" }} />{p.name}: <b>{dinheiro?.includes(p.name) ? brl(p.value) : p.value}</b></div>
      ))}
    </div>
  );
}

/* ------------------------------ meta do mês ------------------------------ */
export function BarraMeta({ feito, meta, pTempo, ritmo, onEditar }: { feito: number; meta: number; pTempo: number; ritmo: number; onEditar?: () => void }) {
  const p = meta > 0 ? Math.min(100, Math.round((feito / meta) * 100)) : 0;
  const noRitmo = meta > 0 ? p >= pTempo : true;
  return (
    <div>
      <div className="relative h-4 overflow-visible rounded-full bg-choco-100">
        <div className="h-full rounded-full bg-gradient-to-r from-vinho-400 to-vinho-700 transition-all duration-700" style={{ width: `${p}%` }} />
        {meta > 0 && <span className="absolute -top-1 h-6 w-0.5 bg-caramelo-600" style={{ left: `${pTempo}%` }} title="onde o mês está" />}
      </div>
      <div className="mt-2 text-sm text-choco-700">
        {meta > 0 ? (
          <><b className="text-choco-900">{brl(feito)}</b> de {brl(meta)} · <b className={noRitmo ? "text-emerald-700" : "text-red-700"}>{p}%</b> da meta com {pTempo}% do mês · no ritmo fecha em <b className="text-choco-900">{brl(ritmo)}</b>{onEditar && <> · <button type="button" onClick={onEditar} className="font-semibold text-vinho-600 underline">mudar meta</button></>}</>
        ) : (
          <><b className="text-choco-900">{brl(feito)}</b> no mês · no ritmo fecha em <b className="text-choco-900">{brl(ritmo)}</b> · <button type="button" onClick={onEditar} className="font-semibold text-vinho-600 underline">defina a meta do mês</button></>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ meta do dia ------------------------------ */
export function MetaDia({ titulo, tom, p, big, de, itens }: { titulo: string; tom: "vinho" | "caramelo" | "verde"; p: number; big: string; de: string; itens: [string, string][] }) {
  const cor = { vinho: "border-l-vinho-600 text-vinho-600", caramelo: "border-l-caramelo-600 text-caramelo-600", verde: "border-l-emerald-600 text-emerald-700" }[tom];
  const bar = { vinho: "bg-vinho-600", caramelo: "bg-caramelo-600", verde: "bg-emerald-600" }[tom];
  return (
    <div className={clsx("rounded-2xl border border-choco-100 border-l-[6px] bg-gradient-to-b from-white to-choco-50 p-4 shadow-card", cor.split(" ")[0])}>
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[1.5px] text-choco-500">{titulo}</span><b className={clsx("text-xl font-black", cor.split(" ")[1])}>{Math.min(100, p)}%</b></div>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="min-w-0"><div className={clsx("whitespace-nowrap font-black leading-none tracking-tight text-choco-900", big.length > 8 ? "text-3xl" : "text-4xl")}>{big}</div><div className="mt-1 text-xs text-choco-600">{de}</div></div>
        <div className="flex shrink-0 gap-3 text-right">{itens.map(([l, v]) => <div key={l}><div className="whitespace-nowrap text-[10px] text-choco-500">{l}</div><b className="whitespace-nowrap text-sm sm:text-base">{v}</b></div>)}</div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-choco-100"><div className={clsx("h-full rounded-full transition-all duration-700", bar)} style={{ width: `${Math.min(100, p)}%` }} /></div>
    </div>
  );
}

/* -------------------------------- rosca 3D -------------------------------- */
export interface Fatia { nome: string; valor: number; cor: string; sub?: string }

function temWebGL() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch { return false; }
}
const semMovimento = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

class Guarda extends Component<{ reserva: ReactNode; children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  render() { return this.state.erro ? this.props.reserva : this.props.children; }
}

function DonutSvg({ fatias, ativa, onAtiva }: { fatias: Fatia[]; ativa: number | null; onAtiva: (i: number | null) => void }) {
  const total = Math.max(1e-9, fatias.reduce((a, f) => a + f.valor, 0));
  let acc = -Math.PI / 2;
  const R = 44, r = 22, cx = 50, cy = 50;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {fatias.map((f, i) => {
        const a0 = acc, a1 = acc + (f.valor / total) * Math.PI * 2; acc = a1;
        const big = a1 - a0 > Math.PI ? 1 : 0;
        const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
        const d = `M${p(R, a0)} A${R},${R} 0 ${big} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${big} 0 ${p(r, a0)} Z`;
        return <path key={f.nome} d={d} fill={f.cor} opacity={ativa === null || ativa === i ? 1 : 0.5} onMouseEnter={() => onAtiva(i)} onMouseLeave={() => onAtiva(null)} />;
      })}
    </svg>
  );
}

export function Donut3D({ fatias, vazio, formato, legendaEmbaixo }: { fatias: Fatia[]; vazio: string; formato?: (f: Fatia) => string; legendaEmbaixo?: boolean }) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const [webgl] = useState(temWebGL);
  const [parado] = useState(semMovimento);
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  if (!fatias.length || total <= 0) return <div className="flex h-full items-center justify-center text-sm text-choco-500">{vazio}</div>;
  const svg = <DonutSvg fatias={fatias} ativa={ativa} onAtiva={setAtiva} />;
  return (
    <div className={clsx("flex h-full min-h-0 flex-col gap-2", legendaEmbaixo ? "" : "sm:flex-row sm:items-center")}>
      <div className={clsx("relative min-h-0 min-w-0 flex-1", legendaEmbaixo ? "" : "h-52 sm:h-full")}>
        {webgl ? <Guarda reserva={svg}><Suspense fallback={svg}><Donut3DScene fatias={fatias} ativa={ativa} parado={parado} onAtiva={setAtiva} /></Suspense></Guarda> : svg}
      </div>
      <ul className={clsx("w-full shrink-0 space-y-1", legendaEmbaixo ? "" : "sm:w-52")}>
        {fatias.map((f, i) => (
          <li key={f.nome} onMouseEnter={() => setAtiva(i)} onMouseLeave={() => setAtiva(null)} onClick={() => setAtiva(ativa === i ? null : i)}
            className={clsx("flex cursor-default items-center gap-2 rounded-lg px-2 py-1 text-xs transition", ativa === i ? "bg-choco-50 ring-1 ring-choco-200" : "")}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
            <span className="line-clamp-2 min-w-0 flex-1 leading-tight text-choco-800" title={f.nome}>{f.nome}</span>
            <b className="whitespace-nowrap text-choco-900">{formato ? formato(f) : f.valor}</b>
            <span className="w-9 text-right text-choco-500">{Math.round((f.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
