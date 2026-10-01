// Globo 3D do bloco "Onde estão nossos clientes" (Visão geral), visão "Mundo". Esfera com os
// países numa textura de canvas (topojson world-atlas 110m, embutido em src/assets, ~100 KB) e
// os estados do Brasil pintados por cima com a MESMA escala de calor do mapa 3D dos estados
// (malha do IBGE), sem barras nem anéis. Câmera começa no Brasil, gira devagar e para quando a
// pessoa interage. Hover e clique descobrem a UF pelo ponto da esfera (uv → lng/lat → polígono).
// Carregado por lazy no pai.
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import countriesTopo from "@/assets/countries-110m.json";
import { corCalor, paleta, ufDoPonto, type MalhaUF, type PontoUF } from "./mapaCalor";

const RAIO = 1;

interface Props {
  malha: MalhaUF;
  pontos: Map<string, PontoUF>;
  max: number;
  escuro: boolean;
  selecionado: string | null;
  onSelect: (uf: string) => void;
  onHover: (uf: string | null) => void;
}

/** lat/lng → ponto na esfera, na mesma convenção de UV da SphereGeometry do three */
function paraXYZ(lat: number, lng: number, r = RAIO): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(lng + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

// ------------------------------------------------------------------ textura
type Topo = { transform: { scale: [number, number]; translate: [number, number] }; arcs: number[][][]; objects: { countries: { geometries: { type: string; id?: string; arcs: any }[] } } };

function decodificarArcos(t: Topo): [number, number][][] {
  const [sx, sy] = t.transform.scale, [tx, ty] = t.transform.translate;
  return t.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty] as [number, number]; });
  });
}

function anel(indices: number[], arcos: [number, number][][]): [number, number][] {
  const pts: [number, number][] = [];
  for (const i of indices) {
    const a = i >= 0 ? arcos[i] : [...arcos[~i]].reverse();
    for (let k = 0; k < a.length; k++) { if (k === 0 && pts.length) continue; pts.push(a[k]); }
  }
  return pts;
}

function texturaMundo(malha: MalhaUF, pontos: Map<string, PontoUF>, max: number, escuro: boolean, selecionado: string | null): THREE.CanvasTexture {
  const W = 4096, H = 2048;
  const p = paleta(escuro);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = p.oceano; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = escuro ? "rgba(169, 195, 242, 0.07)" : "rgba(13, 43, 94, 0.08)"; ctx.lineWidth = 1;
  for (let lng = -180; lng <= 180; lng += 30) { const x = ((lng + 180) / 360) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { const y = ((90 - lat) / 180) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const px = ([lng, lat]: [number, number]) => [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
  const tracar = (aneis: [number, number][][]) => {
    for (const pts of aneis) {
      pts.forEach((pt, i) => { const [x, y] = px(pt); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.closePath();
    }
  };
  // países
  const topo = countriesTopo as unknown as Topo;
  const arcos = decodificarArcos(topo);
  for (const g of topo.objects.countries.geometries) {
    const pols: number[][][] = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
    ctx.beginPath();
    for (const pol of pols) tracar(pol.map((idx) => anel(idx, arcos)));
    ctx.fillStyle = p.terra; ctx.fill("evenodd");
    ctx.strokeStyle = escuro ? "rgba(169, 195, 242, 0.18)" : "rgba(13, 43, 94, 0.22)"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // estados do Brasil por cima, na escala de calor
  for (const uf of Object.keys(malha)) {
    ctx.beginPath();
    for (const pol of malha[uf]) tracar(pol);
    ctx.fillStyle = selecionado === uf ? p.destaque : corCalor(pontos.get(uf)?.valor || 0, max, escuro);
    ctx.fill("evenodd");
    ctx.strokeStyle = p.borda; ctx.lineWidth = 2; ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ------------------------------------------------------------------ cena
function Terra({ malha, pontos, max, escuro, selecionado, onSelect, onHover }: Props) {
  const textura = useMemo(() => texturaMundo(malha, pontos, max, escuro, selecionado), [malha, pontos, max, escuro, selecionado]);
  useEffect(() => () => textura.dispose(), [textura]);
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const alvo = useRef<{ pos: THREE.Vector3; t: number } | null>({ pos: paraXYZ(-14, -52, 2.5), t: 0 });
  const ultimaUf = useRef<string | null>(null);

  useFrame((_, dt) => {
    if (alvo.current) {
      alvo.current.t += dt;
      camera.position.lerp(alvo.current.pos, Math.min(1, dt * 4));
      camera.lookAt(0, 0, 0);
      if (camera.position.distanceTo(alvo.current.pos) < 0.005 || alvo.current.t > 2) alvo.current = null;
      controls.current?.update();
    }
  });

  const ufEm = (e: any): string | null => {
    if (!e.uv) return null;
    return ufDoPonto(malha, e.uv.x * 360 - 180, e.uv.y * 180 - 90);
  };

  return (
    <>
      <ambientLight intensity={escuro ? 1.0 : 1.15} />
      <directionalLight position={[4, 3, 5]} intensity={0.8} />
      <directionalLight position={[-4, -2, -3]} intensity={0.3} />
      <mesh
        onPointerMove={(e) => { const uf = ufEm(e); if (uf !== ultimaUf.current) { ultimaUf.current = uf; onHover(uf); document.body.style.cursor = uf ? "pointer" : "default"; } }}
        onPointerOut={() => { ultimaUf.current = null; onHover(null); document.body.style.cursor = "default"; }}
        onClick={(e) => { const uf = ufEm(e); if (uf) onSelect(uf); }}>
        <sphereGeometry args={[RAIO, 96, 64]} />
        <meshStandardMaterial map={textura} roughness={0.85} metalness={0} />
      </mesh>
      <mesh>
        <sphereGeometry args={[RAIO * 1.015, 48, 32]} />
        <meshBasicMaterial color={paleta(escuro).max} transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.35} maxDistance={4.5}
        autoRotate autoRotateSpeed={0.3} rotateSpeed={0.55} zoomSpeed={0.7}
        onStart={() => { alvo.current = null; if (controls.current) controls.current.autoRotate = false; }} />
    </>
  );
}

export default function ClientesGlobo3D(props: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 2.5], fov: 42, near: 0.05, far: 50 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }} onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}>
      <Terra {...props} />
    </Canvas>
  );
}
