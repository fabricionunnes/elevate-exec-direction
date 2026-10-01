// Mapa 3D do Brasil por UF (bloco "Onde estão nossos clientes" da Visão geral). Pedido do
// Fabrício em 01/10/2026: "quero o mapa, 3D mesmo, porém um mapa de calor". Cada estado é um
// prisma baixo extrudado da malha do IBGE: a cor vem da escala de calor (um matiz só) pela
// métrica do toggle e a altura acompanha de leve. Arrastar gira, scroll aproxima, hover
// destaca, clique abre a lista da UF. Carregado por lazy no pai.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { centroUF, corCalor, fundoEscuro, intensidade, paleta, projetar, type MalhaUF, type PontoUF } from "./mapaCalor";

interface Props {
  malha: MalhaUF;
  pontos: Map<string, PontoUF>;
  max: number;
  escuro: boolean;
  selecionado: string | null;
  onSelect: (uf: string) => void;
  onHover: (uf: string | null) => void;
  /** muda quando clicam em "Brasil": volta a câmera pro enquadramento inicial */
  resetTick: number;
}

const CAMERA: [number, number, number] = [0, 2.15, 1.75];

function Estado({ uf, pols, ponto, max, escuro, ativo, onSelect, onHover }: {
  uf: string; pols: [number, number][][][]; ponto?: PontoUF; max: number; escuro: boolean; ativo: boolean;
  onSelect: Props["onSelect"]; onHover: Props["onHover"];
}) {
  const [hover, setHover] = useState(false);
  const valor = ponto?.valor || 0;
  const t = intensidade(valor, max);
  const altura = 0.025 + t * 0.2;
  const p = paleta(escuro);
  const cor = corCalor(valor, max, escuro);

  const { geom, centro, grande } = useMemo(() => {
    const shapes = pols.map((pol) => {
      const s = new THREE.Shape(pol[0].map(([lng, lat]) => new THREE.Vector2(...projetar(lng, lat))));
      pol.slice(1).forEach((furo) => s.holes.push(new THREE.Path(furo.map(([lng, lat]) => new THREE.Vector2(...projetar(lng, lat))))));
      return s;
    });
    const g = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false });
    const c = centroUF(pols);
    return { geom: g, centro: projetar(c.lng, c.lat), grande: c.area > 9 };
  }, [pols]);
  useEffect(() => () => geom.dispose(), [geom]);
  const bordas = useMemo(() => new THREE.EdgesGeometry(geom, 40), [geom]);
  useEffect(() => () => bordas.dispose(), [bordas]);

  const destacado = hover || ativo;
  // rótulo: sigla + número só onde cabe (UF grande) ou quando o estado está em foco
  const mostraRotulo = (valor > 0 && grande) || destacado;
  const textoClaro = fundoEscuro(destacado ? p.destaque : cor);

  return (
    <group>
      {/* a forma é desenhada no plano XY e extrudada em Z; o grupo pai deita o mapa */}
      <mesh geometry={geom} scale={[1, 1, altura]}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); onHover(uf); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); onHover(null); document.body.style.cursor = "default"; }}
        onClick={(e) => { e.stopPropagation(); onSelect(uf); }}>
        <meshStandardMaterial color={ativo ? p.destaque : cor} emissive={hover ? (escuro ? "#ffffff" : "#000000") : "#000000"} emissiveIntensity={hover ? (escuro ? 0.18 : 0.12) : 0} roughness={0.75} metalness={0.02} />
      </mesh>
      <lineSegments geometry={bordas} scale={[1, 1, altura]}>
        <lineBasicMaterial color={p.borda} transparent opacity={escuro ? 0.7 : 0.9} />
      </lineSegments>
      {mostraRotulo && (
        <Html position={[centro[0], centro[1], altura + 0.012]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ textAlign: "center", lineHeight: 1, whiteSpace: "nowrap", color: textoClaro ? "#fff" : "#0D2B5E", textShadow: textoClaro ? "0 0 3px rgba(0,0,0,.55)" : "0 0 3px rgba(255,255,255,.8)" }}>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{uf}</div>
            {valor > 0 && <div style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}>{valor.toLocaleString("pt-BR")}</div>}
          </div>
        </Html>
      )}
    </group>
  );
}

function Cena({ malha, pontos, max, escuro, selecionado, onSelect, onHover, resetTick }: Props) {
  const controls = useRef<any>(null);
  useEffect(() => { controls.current?.reset(); }, [resetTick]);
  return (
    <>
      <ambientLight intensity={escuro ? 0.9 : 1.15} />
      <directionalLight position={[2.5, 4, 2]} intensity={escuro ? 0.9 : 0.75} />
      <directionalLight position={[-3, 2, -2]} intensity={0.25} />
      {/* deita o mapa: XY vira o chão, a extrusão (Z) vira a altura (Y); norte fica ao fundo */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.08]}>
        {Object.keys(malha).map((uf) => (
          <Estado key={uf} uf={uf} pols={malha[uf]} ponto={pontos.get(uf)} max={max} escuro={escuro} ativo={selecionado === uf} onSelect={onSelect} onHover={onHover} />
        ))}
      </group>
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.4} maxDistance={4.5}
        minPolarAngle={0.15} maxPolarAngle={Math.PI / 2 - 0.12} rotateSpeed={0.6} zoomSpeed={0.7} target={[0, 0, 0]} />
    </>
  );
}

export default function BrasilMapa3D(props: Props) {
  return (
    <Canvas camera={{ position: CAMERA, fov: 40, near: 0.05, far: 50 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }} onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
      onPointerMissed={() => props.onHover(null)}>
      <Cena {...props} />
    </Canvas>
  );
}
