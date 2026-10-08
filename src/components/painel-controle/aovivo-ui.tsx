// Peças visuais da Gestão à vista, compartilhadas pela tela do dono (PainelAoVivoPage)
// e pela do cliente (PainelClienteAoVivoPage). Movidas sem mudança em 09/10/2026.
import { useEffect, useRef, useState } from "react";
import { FunilMes } from "./funil/FunilMes";

const n = (v: number | null | undefined) => Number(v || 0);
const brl = (v: number | null | undefined, compact = true) => {
  const x = n(v);
  if (compact && Math.abs(x) >= 1000) return `R$ ${(x / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

// Barra com cara de bloco: face da frente com o degradê, topo e lateral mais escuros (profundidade 7px).
export function Barra3D(props: any) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const dp = Math.min(7, Math.max(3, width * 0.22));
  const w = Math.max(2, width - dp);
  return (
    <g>
      <polygon points={`${x},${y} ${x + dp},${y - dp} ${x + w + dp},${y - dp} ${x + w},${y}`} fill="#A5F3FC" opacity={0.95} />
      <polygon points={`${x + w},${y} ${x + w + dp},${y - dp} ${x + w + dp},${y + height - dp} ${x + w},${y + height}`} fill="#1E3A8A" opacity={0.95} />
      <rect x={x} y={y} width={w} height={height} fill={fill} rx={1} />
    </g>
  );
}
// O funil 3D do Painel (three.js) encaixado no card: mede a caixa e escala a cena pra caber sem rolagem.
export function Funil3DCompacto({ itens, onEtapa }: { itens: [string, number][]; onEtapa?: (nome: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const medir = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    medir(); const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  const etapas = itens.map(([nome, v], i) => ({
    k: nome, nome, v, conv: i > 0 ? (itens[i - 1][1] > 0 ? `${pct(v, itens[i - 1][1])}% da anterior` : "-") : "no mês", onClick: () => onEtapa?.(nome),
  }));
  // o funil usa a altura inteira do card (a cena 3D se ajusta ao palco)
  const altura = Math.max(260, dim.h - 8);
  return (
    <div className="av-funil3d" ref={caixa}>
      {dim.w > 0 && <FunilMes etapas={etapas} selo="" onSelo={() => {}} altura={altura} fracao={0.64} />}
    </div>
  );
}
export function MetaDia({ titulo, cor, p, big, de, itens, onClick }: { titulo: string; cor: "acc" | "bar" | "good"; p: number; big: string; de: string; itens: [string, string, (() => void)?][]; onClick?: () => void }) {
  return (
    <div className={`av-meta-dia ${cor}`}>
      <div className="cab"><span className="av-h">{titulo}</span><b className="pct">{p}%</b></div>
      <div className="corpo">
        <div className={`big ${onClick ? "clk" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} title={onClick ? "Ver registros" : undefined}><b>{big}</b><span>{de}</span></div>
        <div className="mini">
          {itens.map(([l, v, fn]) => <div key={l} className={fn ? "clk" : ""} onClick={fn} role={fn ? "button" : undefined} title={fn ? "Ver registros" : undefined}><small>{l}</small><b>{v}</b></div>)}
        </div>
      </div>
      <div className="bar"><i style={{ width: `${Math.min(100, p)}%` }} /></div>
    </div>
  );
}
export function Linha({ l, v, dinheiro, forte, bad, sinal, oculto, onClick }: { l: string; v: (number | null | undefined)[]; dinheiro?: boolean; forte?: boolean; bad?: boolean; sinal?: boolean; oculto?: boolean; onClick?: (col: number) => void }) {
  return (
    <tr className={forte ? "forte" : ""}>
      <th>{l}</th>
      {v.map((x, i) => {
        const val = n(x);
        if (oculto) return <td key={i} className="mask">•••••</td>;
        const cls = sinal ? (val < 0 ? "bad" : "ok") : bad && val > 0 ? "bad" : "";
        return <td key={i} className={`${cls} ${onClick ? "clk" : ""}`} onClick={onClick ? () => onClick(i) : undefined} role={onClick ? "button" : undefined} title={onClick ? "Ver registros" : undefined}>{dinheiro ? brl(val) : val.toLocaleString("pt-BR")}</td>;
      })}
    </tr>
  );
}
export function Kpi({ l, v, tom, texto, onClick }: { l: string; v: number | string | null | undefined; tom?: "ok" | "bad"; texto?: boolean; onClick?: () => void }) {
  return <div className={`av-kpi ${onClick ? "clk" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} title={onClick ? "Ver registros" : undefined}><small>{l}</small><b className={tom || ""}>{texto ? v : n(v as number).toLocaleString("pt-BR")}</b></div>;
}
