// Rosca 3D (three + @react-three/fiber), carregada sob demanda: cada fatia é um
// setor de anel extrudado, com face de cima clara e lateral escura. Gira devagar,
// para com o mouse em cima e a fatia em destaque sobe um pouco.
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface FatiaGeo { nome: string; valor: number; cor: string }

const R_OUT = 2.0, R_IN = 0.95, ALT = 0.55, FOLGA = 0.02;

const escurece = (hex: string, k: number) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c; };

function Fatia({ a0, a1, cor, ativa, alguma }: { a0: number; a1: number; cor: string; ativa: boolean; alguma: boolean }) {
  const g = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const f = FOLGA;
    s.absarc(0, 0, R_OUT, a0 + f, a1 - f, false);
    s.absarc(0, 0, R_IN, a1 - f, a0 + f, true);
    const ge = new THREE.ExtrudeGeometry(s, { depth: ALT, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 48 });
    ge.translate(0, 0, -ALT / 2);
    return ge;
  }, [a0, a1]);
  const lado = useMemo(() => escurece(cor, 0.62), [cor]);
  const topo = useMemo(() => new THREE.Color(cor), [cor]);
  useFrame((_, dt) => {
    const el = g.current; if (!el) return;
    const alvo = ativa ? 0.22 : 0;
    el.position.z = THREE.MathUtils.damp(el.position.z, alvo, 10, dt);
    const esc = ativa ? 1.04 : 1;
    el.scale.x = THREE.MathUtils.damp(el.scale.x, esc, 10, dt); el.scale.y = el.scale.x;
  });
  const opacidade = alguma && !ativa ? 0.55 : 1;
  return (
    <group ref={g}>
      <mesh geometry={geo}>
        <meshStandardMaterial attach="material-0" color={topo} roughness={0.42} metalness={0.08} transparent opacity={opacidade} />
        <meshStandardMaterial attach="material-1" color={lado} roughness={0.7} metalness={0.05} transparent opacity={opacidade} />
      </mesh>
    </group>
  );
}

function Cena({ fatias, ativa, parado, onAtiva }: { fatias: FatiaGeo[]; ativa: number | null; parado: boolean; onAtiva: (i: number | null) => void }) {
  const spin = useRef<THREE.Group>(null);
  // palco estreito (celular, card com legenda): a rosca encolhe pra caber inteira
  const { viewport } = useThree();
  const esc = Math.min(1, viewport.width / (2 * R_OUT * 1.12), viewport.height / (2 * R_OUT * 0.95));
  const total = Math.max(1e-9, fatias.reduce((a, f) => a + f.valor, 0));
  let acc = -Math.PI / 2;
  const arcos = fatias.map((f) => { const a0 = acc; acc += (f.valor / total) * Math.PI * 2; return { a0, a1: acc }; });
  useFrame((_, dt) => { if (spin.current && !parado && ativa === null) spin.current.rotation.z += dt * 0.25; });
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 6, 8]} intensity={1.8} />
      <directionalLight position={[-5, -2, 4]} intensity={0.5} color="#ffd6e0" />
      <group rotation={[-0.95, 0, 0]} scale={[esc, esc, esc]}>
        <group ref={spin}>
          {fatias.map((f, i) => (
            <group key={f.nome} onPointerOver={(e) => { e.stopPropagation(); onAtiva(i); }} onPointerOut={() => onAtiva(null)}>
              <Fatia a0={arcos[i].a0} a1={arcos[i].a1} cor={f.cor} ativa={ativa === i} alguma={ativa !== null} />
            </group>
          ))}
        </group>
      </group>
    </>
  );
}

export default function Donut3DScene({ fatias, ativa, parado, onAtiva }: { fatias: FatiaGeo[]; ativa: number | null; parado: boolean; onAtiva: (i: number | null) => void }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, -0.3, 9.2] }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent", touchAction: "pan-y" }}>
      <Cena fatias={fatias} ativa={ativa} parado={parado} onAtiva={onAtiva} />
    </Canvas>
  );
}
