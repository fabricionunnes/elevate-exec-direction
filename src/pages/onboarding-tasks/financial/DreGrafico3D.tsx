import { useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Html, ContactShadows, Line } from "@react-three/drei";
import * as THREE from "three";

// Gráfico 3D do DRE (30/10/2026, Fabrício: "quero estes gráficos em 3D e mais modernos").
// Doze meses em colunas: receita líquida (verde) e despesas (vermelho) lado a lado,
// e o resultado líquido como linha navy flutuando sobre as colunas. A câmera gira com o
// mouse, passar por cima mostra o valor e clicar numa coluna abre aquele mês no DRE.

export interface PontoSerie { ym: string; label: string; receita: number; despesas: number; resultado: number }

interface Props {
  serie: PontoSerie[];
  mesSel: string;
  onMes: (ym: string) => void;
  formatCurrency: (v: number) => string;
  altura?: number;
}

const VERDE = "#059669";
const VERMELHO = "#dc2626";
const NAVY = "#0D2B5E";
const ESPACO = 1.9;       // distância entre meses
const LARG = 0.62;        // largura de cada coluna
const ALT_MAX = 5.2;      // altura da maior coluna

function Coluna({ x, z, altura, cor, ativo, apagado, onClick, onHover, rotulo }: {
  x: number; z: number; altura: number; cor: string; ativo: boolean; apagado: boolean;
  onClick: () => void; onHover: (on: boolean) => void; rotulo: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const alvo = Math.max(altura, 0.04);
  // cresce do chão na abertura e quando a série muda
  useFrame((_, dt) => {
    const m = ref.current; if (!m) return;
    const h = THREE.MathUtils.damp(m.scale.y, alvo, 6, dt);
    m.scale.y = h;
    m.position.y = h / 2;
  });
  return (
    <mesh ref={ref} position={[x, 0, z]} scale={[1, 0.04, 1]} castShadow receiveShadow
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = ""; }}>
      <RoundedBox args={[LARG, 1, LARG]} radius={0.07} smoothness={4}>
        <meshPhysicalMaterial color={cor} roughness={0.32} metalness={0.08} clearcoat={0.9} clearcoatRoughness={0.25}
          transparent opacity={apagado ? 0.35 : 1} emissive={ativo ? cor : "#000000"} emissiveIntensity={ativo ? 0.35 : 0} />
      </RoundedBox>
      <Html position={[0, 0.5, 0]} center style={{ pointerEvents: "none" }}>
        <span className="sr-only">{rotulo}</span>
      </Html>
    </mesh>
  );
}

function Cena({ serie, mesSel, onMes, formatCurrency }: Omit<Props, "altura">) {
  const [hover, setHover] = useState<{ i: number; tipo: "receita" | "despesas" | "resultado" } | null>(null);
  const maxAbs = useMemo(() => Math.max(1, ...serie.flatMap((s) => [Math.abs(s.receita), Math.abs(s.despesas), Math.abs(s.resultado)])), [serie]);
  const esc = (v: number) => (v / maxAbs) * ALT_MAX;
  const x0 = -((serie.length - 1) * ESPACO) / 2;
  const pontosResultado = useMemo(() => serie.map((s, i) => new THREE.Vector3(x0 + i * ESPACO, esc(s.resultado), 0)), [serie, x0, maxAbs]);
  const selIdx = serie.findIndex((s) => s.ym === mesSel);

  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#ffffff", "#c7d2e0", 0.5]} />
      <directionalLight position={[8, 14, 10]} intensity={1.15} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <directionalLight position={[-10, 6, -6]} intensity={0.35} />

      {/* chão com sombra suave */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[serie.length * ESPACO + 6, 12]} />
        <meshStandardMaterial color="#1c1c1c" roughness={1} />
      </mesh>
      <gridHelper args={[serie.length * ESPACO + 6, 24, "#3a3a3a", "#262626"]} position={[0, 0, 0]} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={serie.length * ESPACO + 6} blur={2.2} far={6} />

      {/* linha do zero quando há resultado negativo */}
      {serie.some((s) => s.resultado < 0) && (
        <Line points={[new THREE.Vector3(x0 - 1, 0.02, 0), new THREE.Vector3(x0 + (serie.length - 1) * ESPACO + 1, 0.02, 0)]} color="#6b7280" lineWidth={1} dashed dashSize={0.25} gapSize={0.15} />
      )}

      {serie.map((s, i) => {
        const x = x0 + i * ESPACO;
        const ativo = i === selIdx;
        const apagado = hover != null && hover.i !== i;
        return (
          <group key={s.ym}>
            <Coluna x={x - LARG * 0.58} z={0.35} altura={esc(s.receita)} cor={VERDE} ativo={ativo} apagado={apagado}
              onClick={() => onMes(s.ym)} onHover={(on) => setHover(on ? { i, tipo: "receita" } : null)} rotulo={`${s.label} receita ${formatCurrency(s.receita)}`} />
            <Coluna x={x + LARG * 0.58} z={-0.35} altura={esc(s.despesas)} cor={VERMELHO} ativo={ativo} apagado={apagado}
              onClick={() => onMes(s.ym)} onHover={(on) => setHover(on ? { i, tipo: "despesas" } : null)} rotulo={`${s.label} despesas ${formatCurrency(s.despesas)}`} />
            {/* marcador do resultado */}
            <mesh position={[x, esc(s.resultado), 0]} onPointerOver={(e) => { e.stopPropagation(); setHover({ i, tipo: "resultado" }); }} onPointerOut={() => setHover(null)} onClick={(e) => { e.stopPropagation(); onMes(s.ym); }}>
              <sphereGeometry args={[ativo ? 0.17 : 0.12, 24, 24]} />
              <meshPhysicalMaterial color="#7FA3E8" roughness={0.25} clearcoat={1} emissive={s.resultado < 0 ? "#7f1d1d" : "#3F5F9E"} emissiveIntensity={ativo ? 0.6 : 0.2} />
            </mesh>
            {/* rótulo do mês */}
            <Html position={[x, -0.15, 1.35]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
              <div className={`text-[11px] leading-none whitespace-nowrap select-none ${ativo ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
            </Html>
            {/* marcador do mês selecionado */}
            {ativo && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, 0]}>
                <ringGeometry args={[1.0, 1.08, 48]} />
                <meshBasicMaterial color="#CC1B1B" transparent opacity={0.7} />
              </mesh>
            )}
          </group>
        );
      })}

      <Line points={pontosResultado} color="#7FA3E8" lineWidth={3} />

      {hover && (() => {
        const s = serie[hover.i];
        const x = x0 + hover.i * ESPACO;
        const topo = Math.max(esc(s.receita), esc(s.despesas), esc(s.resultado)) + 0.7;
        return (
          <Html position={[x, topo, 0]} center zIndexRange={[100, 50]} style={{ pointerEvents: "none" }}>
            <div className="rounded-lg border bg-background/95 backdrop-blur px-3 py-2 shadow-lg text-xs whitespace-nowrap">
              <div className="font-semibold mb-1">{s.label}</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: VERDE }} />Receita líquida <b className="ml-auto tabular-nums">{formatCurrency(s.receita)}</b></div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: VERMELHO }} />Despesas e custos <b className="ml-auto tabular-nums">{formatCurrency(s.despesas)}</b></div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: "#7FA3E8" }} />Resultado <b className={`ml-auto tabular-nums ${s.resultado < 0 ? "text-destructive" : "text-emerald-600"}`}>{formatCurrency(s.resultado)}</b></div>
            </div>
          </Html>
        );
      })()}

      <OrbitControls enablePan={false} minDistance={12} maxDistance={34} minPolarAngle={0.35} maxPolarAngle={1.35} target={[0, 1.6, 0]} makeDefault />
    </>
  );
}

export default function DreGrafico3D({ serie, mesSel, onMes, formatCurrency, altura = 300 }: Props) {
  return (
    <div className="relative rounded-xl overflow-hidden border" style={{ height: altura, background: "linear-gradient(180deg, #1b1b1b 0%, #0E0E0E 100%)" }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 9.5, 21], fov: 32 }} gl={{ alpha: true, antialias: true }}>
        <Suspense fallback={null}>
          <Cena serie={serie} mesSel={mesSel} onMes={onMes} formatCurrency={formatCurrency} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute left-3 bottom-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VERDE }} />Receita líquida</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VERMELHO }} />Despesas e custos</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#7FA3E8" }} />Resultado líquido</span>
      </div>
      <div className="pointer-events-none absolute left-3 top-2 text-[11px] text-muted-foreground">arraste pra girar · passe o mouse pra ver os valores · clique na coluna pra abrir o mês</div>
    </div>
  );
}
