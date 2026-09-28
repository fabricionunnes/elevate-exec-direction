// Funil de vendas em 3D do painel de Disparos. Substitui as barras horizontais
// que mostravam o mesmo dado: a barra dizia "quanto sobra", mas não dava a
// leitura de funil — onde a perda acontece de verdade.
//
// Desenho: cada etapa é um tronco de cone (o topo tem o raio do próprio valor,
// a base tem o raio da etapa seguinte), com gradiente lateral escuro-claro-escuro
// pra simular volume e elipses achatadas nas pontas. SVG puro: Recharts não tem
// funil 3D e uma lib de 3D aqui seria peso morto por um gráfico estático.
import { useMemo, useState } from "react";

export interface EtapaFunil {
  etapa: string;
  valor: number;
  cor: string;
}

const VB_W = 440, VB_H = 300;
const CX = 132;            // eixo do funil; sobra a direita pros rótulos
const R_MAX = 112, R_MIN = 12;
const ACHATAMENTO = 0.26;  // quanto a elipse é achatada = ângulo da "câmera"
const TOPO = 24, PAD_BAIXO = 18;

/** #rrggbb -> rgb() mais escuro (f < 1) */
function escurecer(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (!Number.isFinite(n)) return hex;
  const c = (v: number) => Math.round(v * f);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
/** #rrggbb -> rgb() mais claro (f = quanto puxa pro branco) */
function clarear(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (!Number.isFinite(n)) return hex;
  const c = (v: number) => Math.round(v + (255 - v) * f);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export function FunilVendas3D({ etapas }: { etapas: EtapaFunil[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const pecas = useMemo(() => {
    const base = etapas[0]?.valor || 0;
    // raio proporcional ao valor, com piso pra última etapa não virar agulha.
    // Proporcional de propósito: é o afunilamento que a pessoa precisa ver.
    const raio = (v: number) => (base > 0 ? R_MIN + (R_MAX - R_MIN) * Math.min(1, v / base) : R_MIN);
    const hSeg = (VB_H - TOPO - PAD_BAIXO) / Math.max(1, etapas.length);

    return etapas.map((e, i) => {
      const rT = raio(e.valor);
      const proximo = i < etapas.length - 1 ? etapas[i + 1].valor : e.valor * 0.8;
      const rB = raio(proximo);
      const yT = TOPO + i * hSeg;
      const yB = yT + hSeg;
      const anterior = i > 0 ? etapas[i - 1].valor : null;
      const pct = anterior && anterior > 0 ? Math.round((e.valor / anterior) * 100) : null;
      return { ...e, i, rT, rB, yT, yB, rrT: rT * ACHATAMENTO, rrB: rB * ACHATAMENTO, pct, meio: yT + hSeg / 2 };
    });
  }, [etapas]);

  if (!pecas.length) return null;
  const xRotulo = CX + R_MAX + 28;

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img"
      aria-label={`Funil do envio à venda: ${etapas.map((e) => `${e.etapa} ${e.valor}`).join(", ")}`}
      style={{ display: "block", overflow: "visible" }}>
      <defs>
        {pecas.map((p) => (
          // escuro nas bordas, claro no meio: é isso que lê como cilindro
          <linearGradient key={p.i} id={`funil3d-${p.i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={escurecer(p.cor, 0.55)} />
            <stop offset="26%" stopColor={p.cor} />
            <stop offset="46%" stopColor={clarear(p.cor, 0.28)} />
            <stop offset="70%" stopColor={p.cor} />
            <stop offset="100%" stopColor={escurecer(p.cor, 0.5)} />
          </linearGradient>
        ))}
        <filter id="funil3d-sombra" x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodOpacity="0.22" />
        </filter>
      </defs>

      <g filter="url(#funil3d-sombra)">
        {pecas.map((p) => (
          <path key={p.i}
            d={`M ${CX - p.rT} ${p.yT}
                A ${p.rT} ${p.rrT} 0 0 0 ${CX + p.rT} ${p.yT}
                L ${CX + p.rB} ${p.yB}
                A ${p.rB} ${p.rrB} 0 0 1 ${CX - p.rB} ${p.yB} Z`}
            fill={`url(#funil3d-${p.i})`}
            opacity={ativo === null || ativo === p.i ? 1 : 0.45}
            style={{ transition: "opacity .15s" }}
            onMouseEnter={() => setAtivo(p.i)}
            onMouseLeave={() => setAtivo(null)}
          />
        ))}
      </g>

      {/* tampa só na primeira: nas outras ela fica escondida pelo segmento de cima */}
      <ellipse cx={CX} cy={pecas[0].yT} rx={pecas[0].rT} ry={pecas[0].rrT}
        fill={clarear(pecas[0].cor, 0.42)} stroke={escurecer(pecas[0].cor, 0.8)} strokeWidth={1}
        pointerEvents="none" />

      {pecas.map((p) => (
        <g key={p.i} opacity={ativo === null || ativo === p.i ? 1 : 0.5}
          style={{ transition: "opacity .15s" }}
          onMouseEnter={() => setAtivo(p.i)} onMouseLeave={() => setAtivo(null)}>
          <line x1={CX + p.rT + 2} y1={p.meio} x2={xRotulo - 8} y2={p.meio}
            className="stroke-border" strokeWidth={1} strokeDasharray="2 2" />
          <text x={xRotulo} y={p.meio - 3} fontSize={11.5} fontWeight={600} className="fill-foreground">
            {p.etapa}
          </text>
          <text x={xRotulo} y={p.meio + 11} fontSize={11.5} className="fill-muted-foreground">
            {p.valor.toLocaleString("pt-BR")}
            {p.pct !== null && <tspan fontSize={10}> ({p.pct}% do anterior)</tspan>}
          </text>
          {/* área de hover confortável sobre o rótulo */}
          <rect x={xRotulo - 10} y={p.meio - 15} width={VB_W - xRotulo + 10} height={30} fill="transparent" />
        </g>
      ))}
    </svg>
  );
}
