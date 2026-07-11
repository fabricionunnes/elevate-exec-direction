import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Flag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlagRow {
  staff_id: string;
  staff_name: string;
  papel: "closer" | "sdr" | "head";
  ref_month: string;
  flag: "red" | "yellow" | "green" | "none";
  pct: number | null;
  target_value: number | null;
  achieved: number | null;
  metric: "vendas" | "agendamentos";
}

const COLOR: Record<string, string> = { red: "#ef4444", yellow: "#f59e0b", green: "#10b981", none: "#334155" };
const CLS: Record<string, string> = {
  red: "bg-red-500/15 text-red-600 border-red-500/30",
  yellow: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  green: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  none: "bg-muted text-muted-foreground border-border",
};
const PAPEL_LABEL: Record<string, string> = { closer: "Closer", sdr: "SDR", head: "Head" };

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const fmtVal = (v: number | null, metric: string) =>
  v == null ? "—" : metric === "vendas" ? brl(Number(v)) : Math.round(Number(v)).toLocaleString("pt-BR");
const monthShort = (my: string) => {
  const [y, m] = my.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1] || m}/${y.slice(2)}`;
};

const SPACING = 1.7;
const H_SCALE = 26; // pct/H_SCALE = altura da barra
const CAP = 150;

// Barra 3D (pessoa × mês). Detalhes do hover vão pra faixa fixa FORA do canvas
// (nada de tooltip dentro do 3D — cortava nas bordas).
function FlagBar({ x, z, row, delayIdx, isFront, onHover, dimmed }: {
  x: number; z: number; row: FlagRow | undefined; delayIdx: number; isFront: boolean;
  onHover: (r: FlagRow | null) => void; dimmed: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const pct = row?.pct != null ? Math.max(Number(row.pct), 3) : 0;
  const hasFlag = !!row && row.flag !== "none";
  const targetH = hasFlag ? Math.min(pct, CAP) / H_SCALE : 0.1;
  const color = COLOR[row?.flag || "none"];

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    const grow = Math.min(Math.max(t * 1.3 - delayIdx * 0.07, 0), 1);
    const h = 0.1 + (targetH - 0.1) * (1 - Math.pow(1 - grow, 3));
    mesh.current.scale.y = h;
    mesh.current.position.y = h / 2;
    const mat = mesh.current.material as THREE.MeshStandardMaterial;
    const basePulse = row?.flag === "red" ? 0.42 + Math.sin(t * 3) * 0.14 : 0.3;
    mat.emissiveIntensity = hover ? 1 : basePulse;
    mat.opacity = dimmed ? 0.18 : hasFlag ? 0.96 : 0.3;
    if (glow.current) {
      glow.current.scale.setScalar(hover ? 1.35 : 1);
      (glow.current.material as THREE.MeshBasicMaterial).opacity = dimmed ? 0.04 : hover ? 0.4 : 0.16;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* halo no chão */}
      <mesh ref={glow} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} />
      </mesh>
      <RoundedBox
        ref={mesh as any}
        args={[0.82, 1, 0.82]}
        radius={0.09}
        smoothness={3}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); if (row) onHover(row); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); onHover(null); document.body.style.cursor = "default"; }}
      >
        <meshStandardMaterial color={color} emissive={color} roughness={0.25} metalness={0.35} transparent />
      </RoundedBox>
      {/* % fixo no topo — só na fileira da frente (mês vigente) pra não poluir */}
      {isFront && hasFlag && !dimmed && (
        <Html position={[0, targetH + 0.55, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <span className="text-[11px] font-extrabold drop-shadow" style={{ color }}>{Math.round(Number(row!.pct))}%</span>
        </Html>
      )}
    </group>
  );
}

function GoalLine({ width }: { width: number }) {
  const y = 100 / H_SCALE;
  return (
    <group>
      {/* linha fina da meta atravessando o palco */}
      <mesh position={[width / 2, y, 1.7]}>
        <boxGeometry args={[width + 4.5, 0.025, 0.025]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.85} />
      </mesh>
      <mesh position={[width / 2, y, 1.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 4.5, 5.6]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.035} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[width + 2.55, y + 0.05, 1.7]} center distanceFactor={15} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <span className="text-[10px] font-bold tracking-widest text-emerald-400 whitespace-nowrap">META 100%</span>
      </Html>
    </group>
  );
}

function Scene({ people, months, byKey, onHover, hoveredId }: {
  people: { id: string; name: string; papel: string }[];
  months: string[];
  byKey: Map<string, FlagRow>;
  onHover: (r: FlagRow | null) => void;
  hoveredId: string | null;
}) {
  const width = (people.length - 1) * SPACING;
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 16, 7]} intensity={1.0} />
      <pointLight position={[-9, 7, -3]} intensity={0.5} color="#6366f1" />
      <pointLight position={[width + 9, 5, 6]} intensity={0.35} color="#0ea5e9" />
      <fog attach="fog" args={["#070b16", 26, 46]} />

      {/* palco */}
      <gridHelper args={[Math.max(width + 9, 14), 18, "#1c2942", "#0f1626"]} position={[width / 2, 0, 1.7]} />
      <mesh position={[width / 2, 0.002, 1.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.max(width / 2 + 4, 7), 48]} />
        <meshBasicMaterial color="#0e1730" transparent opacity={0.55} />
      </mesh>

      <GoalLine width={width} />

      {people.map((p, i) =>
        months.map((m, j) => (
          <FlagBar
            key={`${p.id}-${m}`}
            x={i * SPACING}
            z={(months.length - 1 - j) * 1.7}
            row={byKey.get(`${p.id}|${m}`)}
            delayIdx={i * months.length + j}
            isFront={j === 0}
            onHover={onHover}
            dimmed={hoveredId != null && hoveredId !== p.id}
          />
        )),
      )}

      {/* nomes na frente do palco */}
      {people.map((p, i) => (
        <Html key={p.id} position={[i * SPACING, 0.02, months.length * 1.7 + 0.75]} center distanceFactor={14} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div className={cn("text-center whitespace-nowrap transition-opacity", hoveredId != null && hoveredId !== p.id && "opacity-30")}>
            <p className="text-[11px] font-bold text-slate-100 leading-tight">{p.name.split(" ")[0]}</p>
            <p className="text-[8px] tracking-widest text-slate-400 uppercase">{PAPEL_LABEL[p.papel]}</p>
          </div>
        </Html>
      ))}
      {/* meses na lateral */}
      {months.map((m, j) => (
        <Html key={m} position={[-1.9, 0.15, (months.length - 1 - j) * 1.7]} center distanceFactor={15} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <span className={cn("text-[9px] font-semibold whitespace-nowrap", j === 0 ? "text-slate-100" : "text-slate-500")}>{monthShort(m)}</span>
        </Html>
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={26}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.25}
        target={new THREE.Vector3(width / 2, 1.5, 1.4)}
        autoRotate
        autoRotateSpeed={0.45}
      />
    </>
  );
}

/** Flags do time comercial interno (closers, head e SDRs) nos 3 últimos meses
 * fechados — <70% red · 70–100% yellow · >100% green — com visão 3D:
 * altura = % da meta; a linha verde marca os 100%. */
export const CRMTeamFlags3D = () => {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<FlagRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase.rpc as any)("get_crm_staff_flags");
      if (!error && Array.isArray(data)) setRows(data as FlagRow[]);
      setLoading(false);
    })();
  }, []);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.ref_month))).sort().reverse(), [rows]);
  const people = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; papel: string }>();
    rows.forEach((r) => { if (!seen.has(r.staff_id)) seen.set(r.staff_id, { id: r.staff_id, name: r.staff_name, papel: r.papel }); });
    const withFlag = new Set(rows.filter((r) => r.flag !== "none").map((r) => r.staff_id));
    const rank: Record<string, number> = { head: 0, closer: 1, sdr: 2 };
    return Array.from(seen.values())
      .filter((p) => withFlag.has(p.id))
      .sort((a, b) => rank[a.papel] - rank[b.papel] || a.name.localeCompare(b.name));
  }, [rows]);
  const byKey = useMemo(() => {
    const m = new Map<string, FlagRow>();
    rows.forEach((r) => m.set(`${r.staff_id}|${r.ref_month}`, r));
    return m;
  }, [rows]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Calculando flags do time...
        </CardContent>
      </Card>
    );
  }
  if (!people.length || !months.length) return null;

  const latest = months[0];
  const latestRows = people.map((p) => byKey.get(`${p.id}|${latest}`)).filter(Boolean) as FlagRow[];
  const counts = {
    red: latestRows.filter((r) => r.flag === "red").length,
    yellow: latestRows.filter((r) => r.flag === "yellow").length,
    green: latestRows.filter((r) => r.flag === "green").length,
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          Flags do Time Comercial
          <span className="text-xs font-normal text-muted-foreground">· últimos 3 meses fechados</span>
        </CardTitle>
        <CardDescription className="text-xs flex flex-wrap items-center gap-3">
          <span className="font-medium">{monthShort(latest)}:</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> {counts.red} red</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> {counts.yellow} yellow</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> {counts.green} green</span>
          <span className="text-muted-foreground/70">&lt;70% red · 70–100% yellow · &gt;100% green · altura = % da meta</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid lg:grid-cols-[1fr_290px]">
          {/* 3D */}
          <div className="relative h-[420px]" style={{ background: "radial-gradient(ellipse at 50% -10%, #14204080 0%, transparent 55%), linear-gradient(180deg, #0b1224 0%, #070b16 100%)" }}>
            <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">Montando visão 3D...</div>}>
              <Canvas camera={{ position: [people.length * 0.85, 6.5, 14.5], fov: 44 }}>
                <Scene people={people} months={months} byKey={byKey} onHover={setHovered} hoveredId={hovered?.staff_id ?? null} />
              </Canvas>
            </Suspense>
            {/* Faixa de detalhes FIXA (fora do 3D — nunca corta) */}
            <div className={cn(
              "absolute left-3 top-3 rounded-lg border border-slate-700/70 bg-slate-900/90 backdrop-blur px-3.5 py-2.5 shadow-xl transition-all duration-150",
              hovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none",
            )}>
              {hovered && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[hovered.flag] }} />
                    <p className="text-sm font-bold text-white">{hovered.staff_name}</p>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">{PAPEL_LABEL[hovered.papel]} · {monthShort(hovered.ref_month)}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 tabular-nums">
                    <span className="font-bold" style={{ color: COLOR[hovered.flag] }}>{hovered.pct}%</span>
                    {" — "}{fmtVal(hovered.achieved, hovered.metric)} de {fmtVal(hovered.target_value, hovered.metric)}
                    <span className="text-slate-400"> · {hovered.metric}</span>
                  </p>
                </>
              )}
            </div>
            {/* dica de interação */}
            <div className="absolute right-3 bottom-2.5 text-[10px] text-slate-500 pointer-events-none">
              arraste pra girar · role pra zoom · passe o mouse nas barras
            </div>
          </div>
          {/* Resumo por pessoa */}
          <div className="border-t lg:border-t-0 lg:border-l divide-y max-h-[420px] overflow-y-auto">
            {people.map((p) => {
              const cur = byKey.get(`${p.id}|${latest}`);
              return (
                <div
                  key={p.id}
                  className={cn("px-3 py-2.5 flex items-center gap-2 transition-colors", hovered?.staff_id === p.id && "bg-muted/60")}
                  onMouseEnter={() => { const r = byKey.get(`${p.id}|${latest}`); if (r) setHovered(r); }}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase">{PAPEL_LABEL[p.papel]}</span>
                      <div className="flex items-center gap-1">
                        {months.slice().reverse().map((m) => {
                          const r = byKey.get(`${p.id}|${m}`);
                          return (
                            <span
                              key={m}
                              title={`${monthShort(m)}: ${r && r.flag !== "none" ? `${r.pct}%` : "sem meta"}`}
                              className="h-2.5 w-2.5 rounded-full inline-block"
                              style={{ background: COLOR[r?.flag || "none"], opacity: r?.flag === "none" ? 0.35 : 1 }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {cur && cur.flag !== "none" ? (
                    <Badge variant="outline" className={cn("shrink-0 tabular-nums text-[10px]", CLS[cur.flag])}>{cur.pct}%</Badge>
                  ) : (
                    <Badge variant="outline" className={cn("shrink-0 text-[10px]", CLS.none)}>sem meta</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CRMTeamFlags3D;
