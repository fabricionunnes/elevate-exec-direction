// Funil do mês em 3D (three + @react-three/fiber). Carregado sob demanda pelo
// FunilMes: quem não tem WebGL nem baixa este arquivo.
//
// Cada etapa é um tronco de cone com tampa escura (dá a leitura de profundidade),
// um aro claro na borda de cima e frisos verticais bem leves, que é o que deixa a
// rotação visível num sólido de revolução. Gira devagar sozinho, para quando o
// mouse está em cima e obedece ao arrasto. Os rótulos não ficam aqui: a cena só
// projeta onde cada anel termina na tela (âncoras) e quem desenha é o FunilMes.
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Ancora, Peca } from "./geo";

const R_MAX = 2.2;      // raio do anel mais largo, em unidades da cena
const ALTURA = 4.7;     // altura do funil inteiro
const FOLGA = 0.16;     // espaço entre um anel e o próximo, em fração do segmento

type Giro = { y: number; arrastando: boolean; emCima: boolean; x0: number };

const suave = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function Anel({ p, n, ativo, parado, onHover, onClick }: {
  p: Peca; n: number; ativo: boolean; parado: boolean; onHover: (i: number | null) => void; onClick: (i: number) => void;
}) {
  const grupo = useRef<THREE.Group>(null);
  const lado = useRef<THREE.MeshStandardMaterial>(null);
  const tampa = useRef<THREE.MeshStandardMaterial>(null);
  const aro = useRef<THREE.MeshBasicMaterial>(null);
  const friso = useRef<THREE.LineBasicMaterial>(null);
  const seg = ALTURA / n;
  const h = seg * (1 - FOLGA);
  const y = ALTURA / 2 - seg * (p.i + 0.5);
  const rT = p.rT * R_MAX, rB = p.rB * R_MAX;
  const frisos = useMemo(() => new THREE.EdgesGeometry(new THREE.CylinderGeometry(rT * 1.008, rB * 1.008, h, 28, 1, true)), [rT, rB, h]);
  useEffect(() => () => frisos.dispose(), [frisos]);
  const opaco = p.fantasma ? 0.28 : 1;

  useFrame((st, dt) => {
    const g = grupo.current;
    if (!g) return;
    // entrada: cada anel desce e abre, um depois do outro
    const k = parado ? 1 : suave((st.clock.elapsedTime - 0.15 - p.i * 0.11) / 0.75);
    g.position.y = y + (1 - k) * 0.9;
    const alvo = Math.max(0.001, k * (ativo ? 1.055 : 1));
    const s = THREE.MathUtils.damp(g.scale.x, alvo, 12, dt);
    g.scale.set(s, Math.max(0.001, k), s);
    if (lado.current) { lado.current.opacity = opaco * k; lado.current.emissiveIntensity = THREE.MathUtils.damp(lado.current.emissiveIntensity, ativo ? 0.6 : 0.2, 10, dt); }
    if (tampa.current) tampa.current.opacity = opaco * k;
    if (aro.current) aro.current.opacity = (p.fantasma ? 0.35 : ativo ? 1 : 0.8) * k;
    if (friso.current) friso.current.opacity = (p.fantasma ? 0.04 : 0.09) * k;
  });

  return (
    <group ref={grupo} position={[0, y, 0]}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onHover(p.i); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); if (e.delta <= 6) onClick(p.i); }}
      >
        <cylinderGeometry args={[rT, rB, h, 72, 1, false]} />
        <meshStandardMaterial ref={lado} attach="material-0" color={p.cor} emissive={p.cor} emissiveIntensity={0.2} roughness={0.38} metalness={0.18} transparent />
        <meshStandardMaterial ref={tampa} attach="material-1" color={p.corEscura} roughness={0.7} metalness={0.05} transparent />
        <meshStandardMaterial attach="material-2" color={p.corEscura} roughness={0.9} transparent opacity={opaco} />
      </mesh>
      <mesh position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rT, 0.022, 10, 120]} />
        <meshBasicMaterial ref={aro} color={p.corClara} transparent />
      </mesh>
      <lineSegments geometry={frisos}>
        <lineBasicMaterial ref={friso} color="#ffffff" transparent opacity={0.09} />
      </lineSegments>
    </group>
  );
}

function Cena({ pecas, ativo, giro, onAtivo, onEtapa, onAncoras, parado }: {
  pecas: Peca[]; ativo: number | null; giro: React.MutableRefObject<Giro>; onAtivo: (i: number | null) => void; onEtapa: (i: number) => void;
  onAncoras: (a: Ancora[]) => void; parado: boolean;
}) {
  const grupo = useRef<THREE.Group>(null);
  const { camera, size, viewport, gl } = useThree();
  const n = pecas.length;
  // tela estreita: o funil afina pra caber, sem perder altura
  const sx = Math.min(1, (viewport.width * 0.9) / (2 * R_MAX));
  const pendente = useRef(4);
  useEffect(() => { pendente.current = 4; }, [size.width, size.height, pecas, sx]);
  useEffect(() => { gl.domElement.style.cursor = ativo != null ? "pointer" : giro.current.arrastando ? "grabbing" : "grab"; }, [ativo, gl, giro]);

  useFrame((_, dt) => {
    const g = grupo.current;
    if (g) {
      if (!parado && !giro.current.arrastando && !giro.current.emCima) giro.current.y += dt * 0.2;
      g.rotation.y = giro.current.y;
    }
    // onde cada anel termina à direita, em pixels: é dali que sai a linha do rótulo.
    // Recalcula alguns quadros depois de mudar o tamanho, até a câmera assentar.
    if (pendente.current > 0) {
      pendente.current -= 1;
      camera.updateMatrixWorld();
      const seg = ALTURA / n;
      const v = new THREE.Vector3();
      onAncoras(pecas.map((p) => {
        v.set(((p.rT + p.rB) / 2) * R_MAX * sx, ALTURA / 2 - seg * (p.i + 0.5), 0).project(camera);
        return { x: Math.round((v.x * 0.5 + 0.5) * size.width), y: Math.round((-v.y * 0.5 + 0.5) * size.height) };
      }));
    }
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 7, 6]} intensity={2.4} />
      <directionalLight position={[-6, 2, 3]} intensity={0.9} color="#7d9bea" />
      <pointLight position={[2.5, -4, 4]} intensity={40} color="#ff5a4d" distance={14} />
      <group ref={grupo} scale={[sx, 1, sx]}>
        {pecas.map((p) => <Anel key={p.i} p={p} n={n} ativo={ativo === p.i} parado={parado} onHover={onAtivo} onClick={onEtapa} />)}
      </group>
    </>
  );
}

export default function FunilCena3D({ pecas, ativo, onAtivo, onEtapa, onAncoras, parado }: {
  pecas: Peca[]; ativo: number | null; onAtivo: (i: number | null) => void; onEtapa: (i: number) => void; onAncoras: (a: Ancora[]) => void; parado: boolean;
}) {
  const giro = useRef<Giro>({ y: 0.4, arrastando: false, emCima: false, x0: 0 });

  // arrasto na horizontal gira o funil; soltar fora do bloco também solta
  useEffect(() => {
    const mover = (e: PointerEvent) => { const g = giro.current; if (!g.arrastando) return; g.y += (e.clientX - g.x0) * 0.012; g.x0 = e.clientX; };
    const soltar = () => { giro.current.arrastando = false; };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); window.removeEventListener("pointercancel", soltar); };
  }, []);

  return (
    <div
      className="fn-cena"
      onPointerDown={(e) => { giro.current.arrastando = true; giro.current.x0 = e.clientX; }}
      onPointerEnter={() => { giro.current.emCima = true; }}
      onPointerLeave={() => { giro.current.emCima = false; onAtivo(null); }}
    >
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} camera={{ fov: 30, near: 0.1, far: 60, position: [0, 4.5, 11.2] }}
        onCreated={({ camera }) => { camera.lookAt(0, 0.12, 0); }}>
        <Cena pecas={pecas} ativo={ativo} giro={giro} onAtivo={onAtivo} onEtapa={onEtapa} onAncoras={onAncoras} parado={parado} />
      </Canvas>
    </div>
  );
}
