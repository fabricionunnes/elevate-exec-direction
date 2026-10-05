// O mesmo funil em SVG, pra quando não tem WebGL, o 3D não carregou ou ainda está
// carregando. Mesmo formato da cena 3D: troncos de cone com tampa em elipse, aro
// claro, sombreado lateral e a mesma paleta. Sem rotação, com entrada animada.
import { useEffect } from "react";
import type { Ancora, Peca } from "./geo";

const ACHATA = 0.2;     // achatamento da elipse = inclinação da "câmera"
const FOLGA = 0.16;

export function FunilSvg({ pecas, w, h, ativo, onAtivo, onEtapa, onAncoras, parado }: {
  pecas: Peca[]; w: number; h: number; ativo: number | null; onAtivo: (i: number | null) => void; onEtapa: (i: number) => void;
  onAncoras: (a: Ancora[]) => void; parado: boolean;
}) {
  const n = pecas.length;
  const cx = w / 2;
  const rMax = Math.max(20, Math.min(w * 0.44, h * 0.46));
  const topo = 30, baixo = 22;
  const seg = (h - topo - baixo) / Math.max(1, n);
  const alt = seg * (1 - FOLGA);
  const geo = pecas.map((p) => {
    const yT = topo + p.i * seg, yB = yT + alt;
    const rT = p.rT * rMax, rB = p.rB * rMax;
    return { p, yT, yB, rT, rB, eT: rT * ACHATA, eB: rB * ACHATA, meio: (yT + yB) / 2 };
  });
  const chave = geo.map((g) => `${Math.round(cx + (g.rT + g.rB) / 2)}:${Math.round(g.meio)}`).join("|");
  useEffect(() => {
    onAncoras(geo.map((g) => ({ x: Math.round(cx + (g.rT + g.rB) / 2), y: Math.round(g.meio + (g.eT + g.eB) / 4) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (w < 40) return null;
  return (
    <svg className="fn-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Funil do mês">
      <defs>
        {geo.map(({ p }) => (
          <linearGradient key={p.i} id={`fn-lado-${p.i}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={p.corEscura} />
            <stop offset="0.3" stopColor={p.cor} />
            <stop offset="0.52" stopColor={p.corClara} />
            <stop offset="0.74" stopColor={p.cor} />
            <stop offset="1" stopColor={p.corEscura} />
          </linearGradient>
        ))}
        <radialGradient id="fn-chao" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#CC1B1B" stopOpacity="0.28" /><stop offset="1" stopColor="#CC1B1B" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={h - baixo + 2} rx={rMax * 0.7} ry={rMax * 0.12} fill="url(#fn-chao)" />
      {geo.map(({ p, yT, yB, rT, rB, eT, eB }) => {
        const on = ativo === p.i;
        // lateral: do aro de cima (meia elipse da frente) até o de baixo
        const lado = `M ${cx - rT} ${yT} A ${rT} ${eT} 0 0 0 ${cx + rT} ${yT} L ${cx + rB} ${yB} A ${rB} ${eB} 0 0 1 ${cx - rB} ${yB} Z`;
        return (
          <g key={p.i} className={`fn-anel ${on ? "on" : ""} ${parado ? "" : "entra"}`} style={{ animationDelay: `${p.i * 90}ms`, opacity: p.fantasma ? 0.32 : 1, transformOrigin: `${cx}px ${(yT + yB) / 2}px` }}
            onMouseEnter={() => onAtivo(p.i)} onMouseLeave={() => onAtivo(null)} onClick={() => onEtapa(p.i)}>
            <path d={lado} fill={`url(#fn-lado-${p.i})`} />
            <ellipse cx={cx} cy={yT} rx={rT} ry={eT} fill={p.corEscura} />
            <ellipse cx={cx} cy={yT} rx={rT} ry={eT} fill="none" stroke={p.corClara} strokeWidth={on ? 2.2 : 1.4} />
            <ellipse cx={cx} cy={yT} rx={rT * 0.72} ry={eT * 0.72} fill="#000" opacity="0.28" />
          </g>
        );
      })}
    </svg>
  );
}
