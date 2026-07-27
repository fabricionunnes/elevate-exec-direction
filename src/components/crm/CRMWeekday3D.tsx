import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, RoundedBox } from "@react-three/drei";

// Colunas 3D: vendas (verde) e reuniões (azul) por dia da semana.
// Mesmo stack do CRMTeamFlags3D (react-three-fiber + drei), carregado via lazy.

interface Day { dia: string; vendas: number; reunioes: number; }

const money = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `R$ ${Math.round(v)}`;

function BarPair({ x, d, maxV, maxR }: { x: number; d: Day; maxV: number; maxR: number }) {
  const hV = Math.max(0.15, (d.vendas / maxV) * 4);
  const hR = Math.max(0.15, (d.reunioes / maxR) * 4);
  return (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[0.85, hV, 0.85]} radius={0.06} position={[-0.52, hV / 2, 0.62]}>
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={d.vendas > 0 ? 0.25 : 0.05} metalness={0.3} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[0.85, hR, 0.85]} radius={0.06} position={[0.52, hR / 2, -0.62]}>
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={d.reunioes > 0 ? 0.25 : 0.05} metalness={0.3} roughness={0.35} />
      </RoundedBox>
      {d.vendas > 0 && (
        <Html position={[-0.52, hV + 0.5, 0.62]} center distanceFactor={15} style={{ pointerEvents: "none" }}>
          <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "#6ee7b7" }}>{money(d.vendas)}</span>
        </Html>
      )}
      {d.reunioes > 0 && (
        <Html position={[0.52, hR + 0.5, -0.62]} center distanceFactor={15} style={{ pointerEvents: "none" }}>
          <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "#93c5fd" }}>{d.reunioes}</span>
        </Html>
      )}
      <Html position={[0, -0.4, 1.6]} center distanceFactor={15} style={{ pointerEvents: "none" }}>
        <span className="text-[11px] font-semibold tracking-wide" style={{ color: "#94a3b8" }}>{d.dia}</span>
      </Html>
    </group>
  );
}

export default function CRMWeekday3D({ data }: { data: Day[] }) {
  const maxV = Math.max(...data.map(d => d.vendas), 1);
  const maxR = Math.max(...data.map(d => d.reunioes), 1);
  return (
    <div className="h-[300px] rounded-xl overflow-hidden" style={{ background: "radial-gradient(900px 400px at 50% -10%, #17233b 0%, #0b1220 60%, #070d18 100%)" }}>
      <Canvas camera={{ position: [0, 5.5, 11.5], fov: 46 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[6, 10, 6]} intensity={1.1} />
        <gridHelper args={[24, 24, "#1e293b", "#111a2e"]} />
        {data.map((d, i) => (
          <BarPair key={d.dia} x={(i - 3) * 2.35} d={d} maxV={maxV} maxR={maxR} />
        ))}
        <OrbitControls enablePan={false} minPolarAngle={0.5} maxPolarAngle={1.35} minDistance={7} maxDistance={17} />
      </Canvas>
    </div>
  );
}
