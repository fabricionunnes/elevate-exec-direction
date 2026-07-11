import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
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

const COLOR: Record<string, string> = { red: "#ef4444", yellow: "#f59e0b", green: "#10b981", none: "#475569" };
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

// Barra 3D de um mês de uma pessoa: altura = % da meta (cap 160), cor = flag.
function FlagBar({ x, z, row, delayIdx }: { x: number; z: number; row: FlagRow | undefined; delayIdx: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const pct = row?.pct != null ? Math.max(Number(row.pct), 2) : 0;
  const targetH = row && row.flag !== "none" ? Math.min(pct, 160) / 26 : 0.12;
  const color = COLOR[row?.flag || "none"];

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    // anima o crescimento na entrada (escalonado por barra)
    const grow = Math.min(Math.max(t * 1.4 - delayIdx * 0.06, 0), 1);
    const h = 0.12 + (targetH - 0.12) * (1 - Math.pow(1 - grow, 3));
    mesh.current.scale.y = h;
    mesh.current.position.y = h / 2;
    const mat = mesh.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = hover ? 0.85 : row?.flag === "red" ? 0.4 + Math.sin(t * 3) * 0.15 : 0.22;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "default"; }}
      >
        <boxGeometry args={[0.85, 1, 0.85]} />
        <meshStandardMaterial color={color} emissive={color} roughness={0.3} metalness={0.3} transparent opacity={row?.flag === "none" ? 0.35 : 0.95} />
      </mesh>
      {hover && row && (
        <Html position={[0, targetH + 0.9, 0]} center distanceFactor={13} style={{ pointerEvents: "none" }}>
          <div className="rounded-lg bg-slate-900/95 border border-slate-700 px-3 py-2 text-white shadow-xl whitespace-nowrap">
            <p className="text-xs font-bold">{row.staff_name} · {monthShort(row.ref_month)}</p>
            <p className="text-[10px] text-slate-300">
              {row.flag === "none"
                ? "sem meta configurada"
                : `${row.pct}% — ${fmtVal(row.achieved, row.metric)} de ${fmtVal(row.target_value, row.metric)} (${row.metric})`}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({ people, months, byKey }: {
  people: { id: string; name: string; papel: string }[];
  months: string[];
  byKey: Map<string, FlagRow>;
}) {
  const spacing = 1.6;
  const width = (people.length - 1) * spacing;
  // linha de 100% da meta (referência)
  const goalY = 100 / 26;
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 14, 6]} intensity={0.9} />
      <pointLight position={[-10, 6, -4]} intensity={0.45} color="#818cf8" />
      <gridHelper args={[Math.max(width + 6, 12), 16, "#1e293b", "#131c31"]} position={[width / 2, 0, 1.6]} />

      {/* plano da meta (100%) — quem fura o plano bateu a meta */}
      <mesh position={[width / 2, goalY, 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.max(width + 5, 11), 7.5]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.07} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[width + 2.4, goalY, 1.6]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
        <span className="text-[10px] font-bold text-emerald-400/80 whitespace-nowrap">META 100%</span>
      </Html>

      {people.map((p, i) =>
        months.map((m, j) => (
          <FlagBar
            key={`${p.id}-${m}`}
            x={i * spacing}
            z={(months.length - 1 - j) * 1.6} // mês mais recente na frente
            row={byKey.get(`${p.id}|${m}`)}
            delayIdx={i * months.length + j}
          />
        )),
      )}

      {/* nomes embaixo de cada coluna */}
      {people.map((p, i) => (
        <Html key={p.id} position={[i * spacing, -0.15, months.length * 1.6 + 0.6]} center distanceFactor={16} style={{ pointerEvents: "none" }}>
          <div className="text-center whitespace-nowrap">
            <p className="text-[10px] font-bold text-slate-200">{p.name.split(" ")[0]}</p>
            <p className="text-[8px] text-slate-400 uppercase">{PAPEL_LABEL[p.papel]}</p>
          </div>
        </Html>
      ))}
      {/* rótulos dos meses na lateral esquerda */}
      {months.map((m, j) => (
        <Html key={m} position={[-1.7, 0.15, (months.length - 1 - j) * 1.6]} center distanceFactor={16} style={{ pointerEvents: "none" }}>
          <span className={cn("text-[9px] font-semibold whitespace-nowrap", j === 0 ? "text-slate-100" : "text-slate-400")}>{monthShort(m)}</span>
        </Html>
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
        target={new THREE.Vector3(width / 2, 1.6, 1.6)}
        autoRotate
        autoRotateSpeed={0.6}
      />
    </>
  );
}

/** Flags do time comercial interno (closers, head e SDRs) nos 3 últimos meses
 * fechados — <70% red · 70–100% yellow · >100% green — com visão 3D:
 * altura da barra = % da meta; o plano verde marca os 100%. */
export const CRMTeamFlags3D = () => {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    // só quem tem alguma flag real em algum mês
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
          <div className="h-[360px]" style={{ background: "radial-gradient(ellipse at 50% 0%, #111b36 0%, #080c18 75%)" }}>
            <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">Montando visão 3D...</div>}>
              <Canvas camera={{ position: [people.length * 0.8, 7, 13], fov: 46 }}>
                <Scene people={people} months={months} byKey={byKey} />
              </Canvas>
            </Suspense>
          </div>
          {/* Resumo por pessoa */}
          <div className="border-t lg:border-t-0 lg:border-l divide-y max-h-[360px] overflow-y-auto">
            {people.map((p) => {
              const cur = byKey.get(`${p.id}|${latest}`);
              return (
                <div key={p.id} className="px-3 py-2.5 flex items-center gap-2">
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
