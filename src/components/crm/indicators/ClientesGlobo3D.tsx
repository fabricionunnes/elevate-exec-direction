// Globo 3D do bloco "Onde estão nossos clientes" (Visão geral). Pedido do Fabrício em
// 30/09/2026: "um mapa mundi mostrando onde tem mais clientes, focando no Brasil, em 3D".
// Esfera com os países desenhados numa textura de canvas (topojson world-atlas 110m,
// embutido em src/assets, ~100 KB), barras por UF no centroide de cada estado (altura e cor pelos
// CLIENTES, ou pelos leads do período no toggle) e anel vermelho onde há empresas ativas em
// carteira. Câmera começa no Brasil,
// gira devagar sozinha e para quando a pessoa interage. Carregado por lazy no pai.
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import countriesTopo from "@/assets/countries-110m.json";

const NAVY = "#0D2B5E";
const VERMELHO = "#CC1B1B";
const OCEANO = "#EDF1F7";
const TERRA = "#B9C6DA";
const BRASIL = "#7C93B8";
const RAIO = 1;

// Centroides aproximados das 27 UFs (lat, lng)
export const UF_CENTRO: Record<string, [number, number]> = {
  AC: [-9.0, -70.5], AL: [-9.6, -36.6], AM: [-4.2, -64.7], AP: [1.4, -51.8], BA: [-12.6, -41.7], CE: [-5.3, -39.3], DF: [-15.8, -47.9],
  ES: [-19.6, -40.7], GO: [-16.0, -49.6], MA: [-5.1, -45.3], MG: [-18.5, -44.6], MS: [-20.5, -54.6], MT: [-12.9, -55.9], PA: [-4.0, -52.9],
  PB: [-7.2, -36.7], PE: [-8.4, -37.9], PI: [-7.4, -42.9], PR: [-24.6, -51.6], RJ: [-22.3, -42.7], RN: [-5.8, -36.6], RO: [-10.9, -63.0],
  RR: [2.0, -61.4], RS: [-30.0, -53.5], SC: [-27.2, -50.4], SE: [-10.6, -37.4], SP: [-22.3, -48.7], TO: [-10.2, -48.3],
};

export interface PontoUF { uf: string; /** métrica que dá altura e cor (clientes ou leads do período) */ valor: number; leads: number; clientes: number; ganhos: number; ativos: number; receita: number }

interface Props {
  pontos: PontoUF[];
  selecionado: string | null;
  onSelect: (uf: string | null) => void;
  onHover: (p: PontoUF | null) => void;
  /** 0 = Brasil (padrão), 1 = mundo; muda quando a pessoa clica nos botões */
  foco: { modo: "brasil" | "mundo"; tick: number };
}

/** lat/lng → ponto na esfera, na mesma convenção de UV da SphereGeometry do three */
function paraXYZ(lat: number, lng: number, r = RAIO): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(lng + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

// ------------------------------------------------------------------ textura dos países
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

function texturaMundo(): THREE.CanvasTexture {
  const W = 2048, H = 1024;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = OCEANO; ctx.fillRect(0, 0, W, H);
  // graticule discreta
  ctx.strokeStyle = "rgba(13, 43, 94, 0.08)"; ctx.lineWidth = 1;
  for (let lng = -180; lng <= 180; lng += 30) { const x = ((lng + 180) / 360) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { const y = ((90 - lat) / 180) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const topo = countriesTopo as unknown as Topo;
  const arcos = decodificarArcos(topo);
  const px = ([lng, lat]: [number, number]) => [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
  const desenhar = (poligonos: number[][][], cor: string) => {
    ctx.beginPath();
    for (const pol of poligonos) {
      for (const ringIdx of pol) {
        const pts = anel(ringIdx, arcos);
        pts.forEach((p, i) => { const [x, y] = px(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.closePath();
      }
    }
    ctx.fillStyle = cor; ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(13, 43, 94, 0.25)"; ctx.lineWidth = 1.2; ctx.stroke();
  };
  for (const g of topo.objects.countries.geometries) {
    const pols: number[][][] = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
    desenhar(pols, g.id === "076" ? BRASIL : TERRA);  // 076 = Brasil
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------------ cena
function Barra({ p, max, ativo, onSelect, onHover }: { p: PontoUF; max: number; ativo: boolean; onSelect: Props["onSelect"]; onHover: Props["onHover"] }) {
  const centro = UF_CENTRO[p.uf];
  if (!centro) return null;
  const [lat, lng] = centro;
  const base = paraXYZ(lat, lng, RAIO + 0.002);
  const normal = base.clone().normalize();
  // cilindro cresce no eixo Y; o torus tem o eixo em Z: cada um ganha o seu quaternion pra ficar "em pé" na esfera
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const quatAnel = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const intensidade = max > 0 ? Math.log1p(p.valor) / Math.log1p(max) : 0;
  const altura = p.valor > 0 ? 0.03 + intensidade * 0.28 : 0.012;
  const cor = p.valor > 0 ? new THREE.Color("#B9C6DA").lerp(new THREE.Color(NAVY), 0.25 + intensidade * 0.75) : new THREE.Color("#C9D2E0");
  const pos = base.clone().add(normal.clone().multiplyScalar(altura / 2));
  const raioAnel = 0.02 + Math.min(0.05, Math.sqrt(p.ativos) * 0.012);
  return (
    <group>
      <mesh position={pos} quaternion={quat}
        onPointerOver={(e) => { e.stopPropagation(); onHover(p); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "default"; }}
        onClick={(e) => { e.stopPropagation(); onSelect(ativo ? null : p.uf); }}>
        <cylinderGeometry args={[0.013, 0.016, altura, 12]} />
        <meshStandardMaterial color={ativo ? VERMELHO : cor} emissive={ativo ? VERMELHO : "#000"} emissiveIntensity={ativo ? 0.35 : 0} roughness={0.6} />
      </mesh>
      {p.ativos > 0 && (
        <mesh position={base.clone().add(normal.clone().multiplyScalar(0.004))} quaternion={quatAnel}>
          <torusGeometry args={[raioAnel, 0.005, 8, 32]} />
          <meshStandardMaterial color={VERMELHO} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

function Terra({ pontos, selecionado, onSelect, onHover, foco }: Props) {
  const textura = useMemo(() => texturaMundo(), []);
  useEffect(() => () => textura.dispose(), [textura]);
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const alvo = useRef<{ pos: THREE.Vector3; t: number } | null>(null);
  const max = Math.max(0, ...pontos.map((p) => p.valor));

  // Câmera no Brasil ao abrir e quando clicam em "Brasil"/"Mundo"; a rotação automática volta junto.
  useEffect(() => {
    const dist = foco.modo === "mundo" ? 3.6 : 2.05;
    alvo.current = { pos: paraXYZ(-14, -52, dist), t: 0 };
    if (controls.current) controls.current.autoRotate = true;
  }, [foco.modo, foco.tick]);

  useFrame((_, dt) => {
    if (alvo.current) {
      alvo.current.t += dt;
      camera.position.lerp(alvo.current.pos, Math.min(1, dt * 4));
      camera.lookAt(0, 0, 0);
      if (camera.position.distanceTo(alvo.current.pos) < 0.005 || alvo.current.t > 2) alvo.current = null;
      controls.current?.update();
    }
  });

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 3, 5]} intensity={0.9} />
      <directionalLight position={[-4, -2, -3]} intensity={0.35} />
      <mesh onClick={() => onSelect(null)}>
        <sphereGeometry args={[RAIO, 96, 64]} />
        <meshStandardMaterial map={textura} roughness={0.85} metalness={0} />
      </mesh>
      {/* halo discreto */}
      <mesh>
        <sphereGeometry args={[RAIO * 1.015, 48, 32]} />
        <meshBasicMaterial color={NAVY} transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
      {pontos.map((p) => <Barra key={p.uf} p={p} max={max} ativo={selecionado === p.uf} onSelect={onSelect} onHover={onHover} />)}
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.35} maxDistance={4.5}
        autoRotate autoRotateSpeed={0.35} rotateSpeed={0.55} zoomSpeed={0.7}
        onStart={() => { alvo.current = null; if (controls.current) controls.current.autoRotate = false; }} />
    </>
  );
}

export default function ClientesGlobo3D(props: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 2.05], fov: 42, near: 0.05, far: 50 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }} onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}>
      <Terra {...props} />
    </Canvas>
  );
}
