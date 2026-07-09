import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Brain, RefreshCw, Loader2, Search, Boxes, LayoutGrid,
  AlertTriangle, Handshake, Target, Trophy, Frown, Quote, ExternalLink, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface BrainData {
  momento?: string;
  termometro?: "seguro" | "atencao" | "risco_alto";
  termometro_motivo?: string;
  relacionamento?: string;
  promessas?: { quem?: string; o_que?: string; status?: string; evidencia?: string }[];
  riscos?: { sinal?: string; evidencia?: string; gravidade?: string }[];
  proximas_acoes?: { acao?: string; motivo?: string; urgencia?: string }[];
  vitorias_recentes?: string[];
  dores_atuais?: string[];
  citacoes_chave?: string[];
}
interface BrainRow {
  project_id: string;
  generated_at: string;
  brain: BrainData;
  company_name: string;
  segment: string | null;
  contract_value: number | null;
  consultant_id: string | null;
  consultant_name: string | null;
}

const TERMO = {
  risco_alto: { label: "Risco Alto", color: "#ef4444", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  atencao: { label: "Atenção", color: "#f59e0b", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  seguro: { label: "Seguro", color: "#10b981", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
} as const;
type TermoKey = keyof typeof TERMO;

const termoOf = (b: BrainData): TermoKey =>
  (b.termometro && b.termometro in TERMO ? b.termometro : "atencao") as TermoKey;
const brokenPromises = (b: BrainData) => (b.promessas || []).filter((p) => (p.status || "").toLowerCase().includes("venc")).length;
const highRisks = (b: BrainData) => (b.riscos || []).filter((r) => (r.gravidade || "").toLowerCase() === "alta").length;
const urgentActions = (b: BrainData) => (b.proximas_acoes || []).filter((a) => (a.urgencia || "").toLowerCase() === "hoje").length;
const isStale = (r: BrainRow) => Date.now() - new Date(r.generated_at).getTime() > 24 * 3600 * 1000;
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

// jitter determinístico por id (mesma posição a cada render)
function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

// ── Nó 3D (uma empresa) ────────────────────────────────────────────────────
function BrainNode({ row, onSelect, selected }: { row: BrainRow; onSelect: (r: BrainRow) => void; selected: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const termo = termoOf(row.brain);
  const urg = brokenPromises(row.brain) + highRisks(row.brain);

  // Posição: X por zona de termômetro, Y = urgência (sobe = mais quente), Z espalha
  const bandX = termo === "risco_alto" ? -9 : termo === "atencao" ? 0 : 9;
  const x = bandX + (hash01(row.project_id, 1) - 0.5) * 6.5;
  const z = (hash01(row.project_id, 2) - 0.5) * 12;
  const baseY = 0.9 + Math.min(urg, 6) * 0.55;
  // Tamanho = valor do contrato (log, clamp)
  const value = Math.max(Number(row.contract_value) || 3000, 500);
  const radius = Math.min(1.5, Math.max(0.45, Math.log10(value / 800) * 0.55));

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    const float = Math.sin(t * 0.8 + x) * 0.08;
    mesh.current.position.y = baseY + float;
    // pulso nas de risco alto — chama o olho pra onde dói
    const pulse = termo === "risco_alto" ? 1 + Math.sin(t * 3 + z) * 0.09 : 1;
    const s = (hover || selected ? 1.25 : 1) * pulse;
    mesh.current.scale.setScalar(s);
  });

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={mesh}
        position={[0, baseY, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(row); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "default"; }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={TERMO[termo].color}
          emissive={TERMO[termo].color}
          emissiveIntensity={hover || selected ? 0.9 : termo === "risco_alto" ? 0.45 : 0.2}
          roughness={0.35}
          metalness={0.25}
        />
      </mesh>
      {/* fio até o chão ancora a leitura da altura (urgência) */}
      <mesh position={[0, baseY / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, baseY, 6]} />
        <meshBasicMaterial color={TERMO[termo].color} transparent opacity={0.28} />
      </mesh>
      {hover && (
        <Html position={[0, baseY + radius + 0.7, 0]} center distanceFactor={16} style={{ pointerEvents: "none" }}>
          <div className="rounded-lg bg-slate-900/95 border border-slate-700 px-3 py-2 text-white shadow-xl whitespace-nowrap">
            <p className="text-xs font-bold">{row.company_name}</p>
            <p className="text-[10px] text-slate-300">
              {row.contract_value ? brl(Number(row.contract_value)) : "sem valor"} · {brokenPromises(row.brain)} promessa(s) vencida(s) · {highRisks(row.brain)} risco(s) alto(s)
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

// Zonas do chão (risco / atenção / seguro)
function ZoneFloor() {
  const zones: { x: number; color: string; label: string }[] = [
    { x: -9, color: "#ef4444", label: "RISCO ALTO" },
    { x: 0, color: "#f59e0b", label: "ATENÇÃO" },
    { x: 9, color: "#10b981", label: "SEGURO" },
  ];
  return (
    <group>
      <gridHelper args={[34, 34, "#1e293b", "#111a2e"]} position={[0, 0, 0]} />
      {zones.map((zn) => (
        <group key={zn.label}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[zn.x, 0.01, 0]}>
            <planeGeometry args={[8.2, 15]} />
            <meshBasicMaterial color={zn.color} transparent opacity={0.07} />
          </mesh>
          <Html position={[zn.x, 0.05, 8.6]} center distanceFactor={22} style={{ pointerEvents: "none" }}>
            <span className="text-[11px] font-bold tracking-[0.25em]" style={{ color: zn.color, opacity: 0.85 }}>{zn.label}</span>
          </Html>
        </group>
      ))}
    </group>
  );
}

function Scene({ rows, onSelect, selectedId }: { rows: BrainRow[]; onSelect: (r: BrainRow) => void; selectedId: string | null }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[12, 18, 8]} intensity={0.9} />
      <pointLight position={[-14, 8, -6]} intensity={0.5} color="#60a5fa" />
      <ZoneFloor />
      {rows.map((r) => (
        <BrainNode key={r.project_id} row={r} onSelect={onSelect} selected={selectedId === r.project_id} />
      ))}
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={42}
        maxPolarAngle={Math.PI / 2.15}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
export default function CerebroPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BrainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"3d" | "cards">("3d");
  const [search, setSearch] = useState("");
  const [termoFilter, setTermoFilter] = useState<"all" | TermoKey>("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [freshFilter, setFreshFilter] = useState<"all" | "stale">("all");
  const [selected, setSelected] = useState<BrainRow | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const bulkCancel = useRef(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: brains, error } = await supabase
        .from("client_brain" as never)
        .select("project_id, generated_at, brain")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      const ids = ((brains as any[]) || []).map((b) => b.project_id);
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select("id, status, consultant_id, onboarding_company:onboarding_company_id(name, status, segment, contract_value, consultant_id)")
        .in("id", ids);
      const { data: staff } = await supabase
        .from("onboarding_staff").select("id, name").eq("is_active", true);
      const staffMap = new Map(((staff as any[]) || []).map((s) => [s.id, s.name]));
      const projMap = new Map(((projects as any[]) || []).map((p) => [p.id, p]));

      const out: BrainRow[] = [];
      for (const b of (brains as any[]) || []) {
        const p = projMap.get(b.project_id);
        const comp = p?.onboarding_company;
        // só carteira viva: projeto e empresa ativos
        if (!p || p.status !== "active" || !comp || comp.status !== "active") continue;
        const consultantId = p.consultant_id || comp.consultant_id || null;
        out.push({
          project_id: b.project_id,
          generated_at: b.generated_at,
          brain: (b.brain || {}) as BrainData,
          company_name: comp.name,
          segment: comp.segment,
          contract_value: comp.contract_value,
          consultant_id: consultantId,
          consultant_name: consultantId ? staffMap.get(consultantId) || null : null,
        });
      }
      setRows(out);
    } catch (e: any) {
      toast.error("Erro ao carregar cérebros: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const consultants = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.consultant_id && r.consultant_name) m.set(r.consultant_id, r.consultant_name); });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    let l = rows;
    if (termoFilter !== "all") l = l.filter((r) => termoOf(r.brain) === termoFilter);
    if (consultantFilter !== "all") l = l.filter((r) => r.consultant_id === consultantFilter);
    if (freshFilter === "stale") l = l.filter(isStale);
    if (search.trim()) {
      const q = search.toLowerCase();
      l = l.filter((r) => r.company_name.toLowerCase().includes(q));
    }
    const rank: Record<TermoKey, number> = { risco_alto: 0, atencao: 1, seguro: 2 };
    return [...l].sort((a, b) => rank[termoOf(a.brain)] - rank[termoOf(b.brain)] || (Number(b.contract_value) || 0) - (Number(a.contract_value) || 0));
  }, [rows, termoFilter, consultantFilter, freshFilter, search]);

  const kpis = useMemo(() => ({
    total: rows.length,
    risco: rows.filter((r) => termoOf(r.brain) === "risco_alto").length,
    atencao: rows.filter((r) => termoOf(r.brain) === "atencao").length,
    seguro: rows.filter((r) => termoOf(r.brain) === "seguro").length,
    stale: rows.filter(isStale).length,
    promessasVencidas: rows.reduce((s, r) => s + brokenPromises(r.brain), 0),
    acoesHoje: rows.reduce((s, r) => s + urgentActions(r.brain), 0),
    valorEmRisco: rows.filter((r) => termoOf(r.brain) === "risco_alto").reduce((s, r) => s + (Number(r.contract_value) || 0), 0),
  }), [rows]);

  const regenerate = async (row: BrainRow) => {
    setRegenerating(row.project_id);
    try {
      const { data, error } = await supabase.functions.invoke("client-brain", { body: { projectId: row.project_id, force: true } });
      if (error) throw error;
      toast.success(`Cérebro de ${row.company_name} atualizado`);
      await load();
      if (selected?.project_id === row.project_id && data?.brain) {
        setSelected({ ...row, brain: data.brain, generated_at: new Date().toISOString() });
      }
    } catch (e: any) {
      toast.error("Erro ao regenerar: " + (e?.message || e));
    } finally {
      setRegenerating(null);
    }
  };

  const bulkRefresh = async () => {
    const stale = rows.filter(isStale);
    if (!stale.length) { toast.info("Nenhum cérebro desatualizado."); return; }
    if (!confirm(`Atualizar ${stale.length} cérebro(s) desatualizado(s)?\n\nRoda um por um (~1 min cada) — mantenha a aba aberta. Dá pra cancelar no meio.`)) return;
    bulkCancel.current = false;
    setBulk({ done: 0, total: stale.length });
    for (let i = 0; i < stale.length; i++) {
      if (bulkCancel.current) break;
      try {
        await supabase.functions.invoke("client-brain", { body: { projectId: stale[i].project_id, force: true } });
      } catch { /* segue pro próximo */ }
      setBulk({ done: i + 1, total: stale.length });
    }
    setBulk(null);
    toast.success("Atualização concluída.");
    load();
  };

  const freshness = (r: BrainRow) =>
    formatDistanceToNow(parseISO(r.generated_at), { addSuffix: true, locale: ptBR });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Cérebro da Carteira</h1>
              <p className="text-xs text-muted-foreground">Estado vivo de cada cliente — promessas, riscos e próximas ações</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {bulk ? (
              <Button variant="outline" size="sm" onClick={() => { bulkCancel.current = true; }}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar ({bulk.done}/{bulk.total})
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={bulkRefresh} disabled={kpis.stale === 0}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar desatualizados ({kpis.stale})
              </Button>
            )}
            <div className="flex rounded-lg border overflow-hidden">
              <button className={cn("px-3 py-1.5 text-xs font-medium flex items-center gap-1.5", view === "3d" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")} onClick={() => setView("3d")}>
                <Boxes className="h-3.5 w-3.5" /> 3D
              </button>
              <button className={cn("px-3 py-1.5 text-xs font-medium flex items-center gap-1.5", view === "cards" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")} onClick={() => setView("cards")}>
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: "Cérebros", value: String(kpis.total), cls: "" },
            { label: "Risco alto", value: String(kpis.risco), cls: "text-red-500", onClick: () => setTermoFilter(termoFilter === "risco_alto" ? "all" : "risco_alto"), active: termoFilter === "risco_alto" },
            { label: "Atenção", value: String(kpis.atencao), cls: "text-amber-500", onClick: () => setTermoFilter(termoFilter === "atencao" ? "all" : "atencao"), active: termoFilter === "atencao" },
            { label: "Valor em risco", value: brl(kpis.valorEmRisco), cls: "text-red-500" },
            { label: "Promessas vencidas", value: String(kpis.promessasVencidas), cls: "text-orange-500" },
            { label: "Desatualizados +24h", value: String(kpis.stale), cls: "text-slate-400", onClick: () => setFreshFilter(freshFilter === "stale" ? "all" : "stale"), active: freshFilter === "stale" },
          ].map((k) => (
            <button
              key={k.label}
              onClick={k.onClick}
              disabled={!k.onClick}
              className={cn("rounded-lg border bg-card px-3 py-2 text-left", k.onClick && "hover:bg-muted/50 cursor-pointer", (k as any).active && "ring-2 ring-primary")}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className={cn("text-lg font-bold tabular-nums", k.cls)}>{k.value}</p>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
          <Select value={consultantFilter} onValueChange={setConsultantFilter}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Consultor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={termoFilter} onValueChange={(v) => setTermoFilter(v as any)}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="risco_alto">Risco alto</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
              <SelectItem value="seguro">Seguro</SelectItem>
            </SelectContent>
          </Select>
          {bulk && (
            <Badge variant="outline" className="gap-1.5 h-9 px-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando {bulk.done}/{bulk.total}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} de {rows.length} clientes</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando a carteira...
          </div>
        ) : view === "3d" ? (
          <div className="rounded-xl overflow-hidden border" style={{ background: "radial-gradient(ellipse at 50% 0%, #101a33 0%, #070b16 70%)" }}>
            <div className="h-[560px]">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">Montando o mapa 3D...</div>}>
                <Canvas camera={{ position: [0, 15, 27], fov: 48 }}>
                  <Scene rows={filtered} onSelect={setSelected} selectedId={selected?.project_id || null} />
                </Canvas>
              </Suspense>
            </div>
            <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400">
              <span><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle" style={{ background: "#ef4444" }} />Risco alto (pulsando)</span>
              <span><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle" style={{ background: "#f59e0b" }} />Atenção</span>
              <span><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle" style={{ background: "#10b981" }} />Seguro</span>
              <span className="ml-auto">Tamanho = valor do contrato · Altura = promessas vencidas + riscos altos · Arraste pra girar, role pra zoom, clique pra abrir</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r) => {
              const termo = termoOf(r.brain);
              return (
                <Card key={r.project_id} className={cn("cursor-pointer hover:shadow-md transition-all border-l-4")}
                  style={{ borderLeftColor: TERMO[termo].color }}
                  onClick={() => setSelected(r)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-tight">{r.company_name}</p>
                      <Badge variant="outline" className={cn("shrink-0 text-[10px]", TERMO[termo].cls)}>{TERMO[termo].label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.brain.momento || "—"}</p>
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {brokenPromises(r.brain) > 0 && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">{brokenPromises(r.brain)} promessa(s) vencida(s)</Badge>}
                      {highRisks(r.brain) > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">{highRisks(r.brain)} risco(s) alto(s)</Badge>}
                      {urgentActions(r.brain) > 0 && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">{urgentActions(r.brain)} ação(ões) HOJE</Badge>}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className={cn("text-[10px]", isStale(r) ? "text-amber-500 font-medium" : "text-muted-foreground")}>
                        {isStale(r) ? "⚠ " : ""}{freshness(r)}
                      </span>
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        disabled={regenerating === r.project_id}
                        onClick={(e) => { e.stopPropagation(); regenerate(r); }}
                      >
                        {regenerating === r.project_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-16">Nenhum cérebro com esses filtros.</div>
            )}
          </div>
        )}
      </div>

      {/* Detalhe */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 pr-8">
                  <Brain className="h-5 w-5 text-primary shrink-0" />
                  <span className="truncate">{selected.company_name}</span>
                  <Badge variant="outline" className={cn("ml-auto shrink-0", TERMO[termoOf(selected.brain)].cls)}>
                    {TERMO[termoOf(selected.brain)].label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Gerado {freshness(selected)}{selected.consultant_name ? ` · Consultor: ${selected.consultant_name}` : ""}</span>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/onboarding-tasks/${selected.project_id}`)}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Projeto
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={regenerating === selected.project_id} onClick={() => regenerate(selected)}>
                      {regenerating === selected.project_id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Regenerar
                    </Button>
                  </div>
                </div>

                {selected.brain.momento && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Momento</p>
                    <p>{selected.brain.momento}</p>
                    {selected.brain.termometro_motivo && <p className="text-xs text-muted-foreground mt-2"><strong>Termômetro:</strong> {selected.brain.termometro_motivo}</p>}
                  </div>
                )}

                {(selected.brain.promessas?.length || 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Handshake className="h-3.5 w-3.5" /> Promessas</p>
                    <div className="space-y-1.5">
                      {selected.brain.promessas!.map((p, i) => (
                        <div key={i} className="rounded-md border p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{p.o_que}</span>
                            <Badge variant="outline" className={cn("text-[9px] shrink-0", (p.status || "").includes("venc") ? "bg-red-500/10 text-red-600 border-red-500/30" : "bg-muted")}>{p.status || "—"} · {p.quem || "?"}</Badge>
                          </div>
                          {p.evidencia && <p className="text-muted-foreground mt-1">{p.evidencia}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selected.brain.riscos?.length || 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Riscos</p>
                    <div className="space-y-1.5">
                      {selected.brain.riscos!.map((r, i) => (
                        <div key={i} className={cn("rounded-md border p-2 text-xs", (r.gravidade || "") === "alta" && "border-red-500/40 bg-red-500/5")}>
                          <p className="font-medium">{r.sinal}</p>
                          {r.evidencia && <p className="text-muted-foreground mt-1">{r.evidencia}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selected.brain.proximas_acoes?.length || 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Próximas ações</p>
                    <div className="space-y-1.5">
                      {selected.brain.proximas_acoes!.map((a, i) => (
                        <div key={i} className="rounded-md border p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{a.acao}</span>
                            {a.urgencia && <Badge variant="outline" className={cn("text-[9px] shrink-0", a.urgencia === "hoje" ? "bg-red-500/10 text-red-600 border-red-500/30" : "bg-muted")}>{a.urgencia}</Badge>}
                          </div>
                          {a.motivo && <p className="text-muted-foreground mt-1">{a.motivo}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selected.brain.vitorias_recentes?.length || 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> Vitórias recentes</p>
                    <ul className="list-disc pl-4 text-xs space-y-0.5">{selected.brain.vitorias_recentes!.map((v, i) => <li key={i}>{v}</li>)}</ul>
                  </div>
                )}
                {(selected.brain.dores_atuais?.length || 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Frown className="h-3.5 w-3.5" /> Dores atuais</p>
                    <ul className="list-disc pl-4 text-xs space-y-0.5">{selected.brain.dores_atuais!.map((v, i) => <li key={i}>{v}</li>)}</ul>
                  </div>
                )}
                {(selected.brain.citacoes_chave?.length || 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Quote className="h-3.5 w-3.5" /> Citações-chave</p>
                    <div className="space-y-1">{selected.brain.citacoes_chave!.map((c, i) => <p key={i} className="text-xs italic text-muted-foreground border-l-2 pl-2">"{c}"</p>)}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
