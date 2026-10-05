// Bloco "Funil único do mês": o funil (3D quando dá, SVG quando não dá), o selo de
// investimento no topo e, ao lado de cada anel, nome, número e conversão ligados
// por uma linha guia. Clique no anel ou no rótulo abre os registros da etapa.
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { num } from "../fmt";
import { montarFunil, semMovimentoPreferido, temWebGL, type Ancora, type EtapaFunil } from "./geo";
import { FunilSvg } from "./FunilSvg";

const FunilCena3D = lazy(() => import("./FunilCena3D"));

/** Se a cena 3D quebrar (chunk antigo, driver de vídeo), cai no SVG em vez de derrubar o painel. */
class Guarda extends Component<{ reserva: ReactNode; children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(e: unknown) { console.warn("[painel] funil 3D indisponível, usando o SVG:", e); }
  render() { return this.state.erro ? this.props.reserva : this.props.children; }
}

export function FunilMes({ etapas, selo, onSelo }: {
  etapas: EtapaFunil[];
  /** texto do selo no topo: "R$ 3,4 mil investidos · CPL R$ 83" */
  selo: string;
  onSelo: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [larg, setLarg] = useState(0);
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ancoras, setAncoras] = useState<Ancora[]>([]);
  const [webgl] = useState(temWebGL);
  const [parado] = useState(semMovimentoPreferido);
  const pecas = useMemo(() => montarFunil(etapas), [etapas.map((e) => e.v).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const semDado = etapas.every((e) => !(e.v > 0));

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLarg(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const estreito = larg > 0 && larg < 520;
  const alt = estreito ? 340 : 390;
  const largFunil = Math.round(larg * (estreito ? 0.46 : 0.52));

  const guardarAncoras = useCallback((a: Ancora[]) => {
    setAncoras((ant) => (ant.length === a.length && ant.every((p, i) => Math.abs(p.x - a[i].x) < 2 && Math.abs(p.y - a[i].y) < 2) ? ant : a));
  }, []);
  const abrir = useCallback((i: number) => etapas[i]?.onClick(), [etapas]);

  const svg = <FunilSvg pecas={pecas} w={largFunil} h={alt} ativo={ativo} onAtivo={setAtivo} onEtapa={abrir} onAncoras={guardarAncoras} parado={parado} />;
  const xRot = largFunil + (estreito ? 14 : 30);
  // Rótulos em faixas iguais na altura: a perspectiva aproxima os anéis de baixo e,
  // presos na altura do anel, os textos encavalavam. A linha guia faz o cotovelo.
  const faixa = alt / Math.max(1, etapas.length);
  const yRot = (i: number) => Math.round(faixa * (i + 0.5));

  return (
    <>
    <button type="button" className="fn-selo" onClick={onSelo} title="Abrir tráfego pago">{selo}</button>
    <div className="fn" ref={caixa} style={{ height: alt }}>
      <div className="fn-palco" style={{ width: largFunil, height: alt }}>
        {larg > 0 && (webgl ? (
          <Guarda reserva={svg}>
            <Suspense fallback={svg}>
              <FunilCena3D pecas={pecas} ativo={ativo} onAtivo={setAtivo} onEtapa={abrir} onAncoras={guardarAncoras} parado={parado} />
            </Suspense>
          </Guarda>
        ) : svg)}
      </div>

      {/* linhas guia: do anel até o rótulo */}
      {ancoras.length === etapas.length && (
        <svg className="fn-guias" width={larg} height={alt} aria-hidden="true">
          {ancoras.map((a, i) => (
            <g key={i} className={ativo === i ? "on" : ""}>
              <circle cx={a.x + 3} cy={a.y} r={2.6} />
              <polyline points={`${a.x + 6},${a.y} ${Math.max(a.x + 8, xRot - 26)},${a.y} ${xRot - 8},${yRot(i)}`} />
            </g>
          ))}
        </svg>
      )}

      {ancoras.length === etapas.length && etapas.map((e, i) => (
        <button type="button" key={e.k} className={`fn-rot ${ativo === i ? "on" : ""} ${pecas[i].fantasma ? "vazio" : ""}`} style={{ left: xRot, top: yRot(i), width: Math.max(90, larg - xRot) }}
          title={e.dica ?? `${e.nome}: ${e.conv}`} onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} onClick={e.onClick}>
          <small>{e.nome}</small>
          <b style={{ color: pecas[i].fantasma ? undefined : pecas[i].corClara }}>{semDado ? "-" : num(e.v, 0)}</b>
          <em>{semDado ? "sem registro no mês" : e.conv}</em>
        </button>
      ))}

      {semDado && <div className="fn-vazio">Sem movimento no CRM neste mês</div>}
    </div>
    </>
  );
}
