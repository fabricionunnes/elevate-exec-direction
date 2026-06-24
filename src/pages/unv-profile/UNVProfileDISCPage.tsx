import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Copy, ExternalLink, Users, CheckCircle2, Clock, Target, Sparkles, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Bar, Cell, Tooltip as RTooltip } from "recharts";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/publicDomain";

const PROFILE: Record<string, { name: string; color: string; desc: string }> = {
  D: { name: "Dominância", color: "#ef4444", desc: "Foco em resultado, decisão rápida" },
  I: { name: "Influência", color: "#f59e0b", desc: "Comunicação, persuasão, relacionamento" },
  S: { name: "Estabilidade", color: "#10b981", desc: "Paciência, cooperação, consistência" },
  C: { name: "Conformidade", color: "#3b82f6", desc: "Precisão, análise, processo" },
};

const ROLE_LABELS: Record<string, string> = {
  master: "Diretor", admin: "Administrador", consultant: "Consultor", sdr: "SDR",
  closer: "Closer", juridico: "Jurídico", rh: "RH", gerente: "Gerente", manager: "Gerente",
  financeiro: "Financeiro", marketing: "Marketing", trafego: "Gestor de Tráfego", social: "Social Media",
};
const roleLabel = (role?: string | null) => !role ? "Sem cargo" : (ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1));

// Perfil DISC ideal por cargo (referência) — usado pra medir fit cargo x comportamento.
const ROLE_IDEAL: Record<string, string[]> = {
  master: ["D", "C"], gerente: ["D", "C"], manager: ["D", "C"], admin: ["C", "S"],
  consultant: ["I", "S"], sdr: ["I", "D"], closer: ["D", "I"], juridico: ["C"],
  rh: ["S", "I"], financeiro: ["C", "S"], marketing: ["I"], trafego: ["C", "I"], social: ["I"],
};

interface Row {
  emp: any;
  role?: string | null;
  disc: any | null;
  fromCandidate: boolean;
}

export default function UNVProfileDISCPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: emps } = await supabase
        .from("profile_employees")
        .select("id, full_name, email, avatar_url, staff_id, tenant_id, contract_type")
        .eq("status", "active")
        .neq("employee_type", "external")
        .order("created_at", { ascending: false });
      // dedup por staff_id + tira terceirizados (não fazem parte do time interno)
      const seen = new Set<string>();
      const deduped = (emps || []).filter((e: any) => {
        if (e.contract_type === "terceirizado") return false;
        const k = e.staff_id || e.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const ids = deduped.map((e: any) => e.id);
      const emails = deduped.map((e: any) => (e.email || "").toLowerCase()).filter(Boolean);

      // papéis (cargo)
      const staffIds = [...new Set(deduped.map((e: any) => e.staff_id).filter(Boolean))] as string[];
      const roleByStaff: Record<string, string> = {};
      if (staffIds.length) {
        const { data: staff } = await supabase.from("onboarding_staff").select("id, role").in("id", staffIds);
        (staff || []).forEach((s: any) => { if (s.id) roleByStaff[s.id] = s.role; });
      }

      // DISC dos colaboradores
      const discByEmp: Record<string, any> = {};
      if (ids.length) {
        const { data: d } = await supabase.from("profile_disc_results").select("employee_id,d_score,i_score,s_score,c_score,dominant,taken_at").in("employee_id", ids).order("taken_at", { ascending: false });
        (d || []).forEach((x: any) => { if (x.employee_id && !discByEmp[x.employee_id]) discByEmp[x.employee_id] = x; });
      }
      // DISC vindo da candidatura (mesmo email) — candidato do sistema já vem preenchido
      const discByEmail: Record<string, any> = {};
      if (emails.length) {
        const { data: cd } = await supabase
          .from("profile_disc_results")
          .select("d_score,i_score,s_score,c_score,dominant,taken_at,profile_candidates!inner(email)")
          .not("candidate_id", "is", null)
          .order("taken_at", { ascending: false });
        (cd || []).forEach((x: any) => {
          const em = (x.profile_candidates?.email || "").toLowerCase();
          if (em && !discByEmail[em]) discByEmail[em] = x;
        });
      }

      setRows(deduped.map((e: any) => {
        const empDisc = discByEmp[e.id];
        const candDisc = !empDisc ? discByEmail[(e.email || "").toLowerCase()] : null;
        return { emp: e, role: e.staff_id ? roleByStaff[e.staff_id] : null, disc: empDisc || candDisc || null, fromCandidate: !empDisc && !!candDisc };
      }));
      setLoading(false);
    })();
  }, []);

  const discLink = (emp: any) => {
    const params = new URLSearchParams();
    if (emp.tenant_id) params.set("tenant", emp.tenant_id);
    params.set("employee", emp.id);
    return `${getPublicBaseUrl()}/#/disc-publico?${params.toString()}`;
  };
  const copyLink = (emp: any) => navigator.clipboard.writeText(discLink(emp)).then(() => toast.success("Link individual copiado — só esse colaborador preenche.")).catch(() => toast.error("Não consegui copiar"));
  const copyAllPending = () => {
    const txt = rows.filter(r => !r.disc).map(r => `${r.emp.full_name}: ${discLink(r.emp)}`).join("\n");
    if (!txt) return toast.info("Todos já fizeram o DISC!");
    navigator.clipboard.writeText(txt).then(() => toast.success("Links dos pendentes copiados")).catch(() => toast.error("Não consegui copiar"));
  };

  const done = rows.filter(r => r.disc);
  const pending = rows.filter(r => !r.disc);
  const distribution = ["D", "I", "S", "C"].map(p => ({ key: p, name: PROFILE[p].name, value: done.filter(r => r.disc?.dominant === p).length, fill: PROFILE[p].color }));
  const predominant = distribution.slice().sort((a, b) => b.value - a.value)[0];

  // Cargo x DISC: agrupa por cargo
  const byRole = useMemo(() => {
    const map: Record<string, Row[]> = {};
    rows.forEach(r => { const k = r.role || "_none"; (map[k] ||= []).push(r); });
    return Object.entries(map).map(([role, list]) => {
      const ideal = ROLE_IDEAL[role] || [];
      const withDisc = list.filter(r => r.disc);
      const fitCount = withDisc.filter(r => ideal.includes(r.disc.dominant)).length;
      return { role, label: roleLabel(role === "_none" ? null : role), ideal, list, withDisc, fitCount };
    }).sort((a, b) => b.list.length - a.list.length);
  }, [rows]);

  const filtered = rows.filter(r => !search || r.emp.full_name?.toLowerCase().includes(search.toLowerCase()));

  const Kpi = ({ icon, label, value, color }: any) => (
    <div className="rounded-xl border p-4 bg-gradient-to-br from-muted/30 to-transparent">
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${color}`}>{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> Perfil DISC do Time</h1>
          <p className="text-sm text-muted-foreground">Mapa comportamental dos colaboradores, fit por cargo e insights</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={copyAllPending}><Link2 className="w-4 h-4" />Copiar links dos pendentes ({pending.length})</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Users className="w-4 h-4" />} label="Colaboradores" value={rows.length} color="text-indigo-400" />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Fizeram DISC" value={done.length} color="text-emerald-400" />
        <Kpi icon={<Clock className="w-4 h-4" />} label="Pendentes" value={pending.length} color="text-amber-400" />
        <Kpi icon={<Sparkles className="w-4 h-4" />} label="Perfil predominante" value={predominant?.value ? predominant.key : "—"} color="text-rose-400" />
      </div>

      {/* Distribuição */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Distribuição comportamental do time</CardTitle></CardHeader>
        <CardContent className="h-64">
          {done.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Nenhum DISC respondido ainda. Envie os links abaixo.</div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={distribution}>
                <defs>
                  {["D", "I", "S", "C"].map(p => (
                    <linearGradient key={p} id={`disc-${p}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PROFILE[p].color} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={PROFILE[p].color} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <RTooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={70}>
                  {distribution.map((d) => <Cell key={d.key} fill={`url(#disc-${d.key})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cargo x DISC + insights */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Cargo × DISC — bate ou não?</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Cada cargo tem um perfil comportamental ideal. Abaixo, o perfil esperado vs o que o time tem.</p>
          {byRole.filter(g => g.role !== "_none").map(g => (
            <div key={g.role} className="rounded-lg border p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{g.label}</span>
                  <span className="text-[11px] text-muted-foreground">({g.list.length})</span>
                  {g.ideal.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px]">ideal:
                      {g.ideal.map(p => <Badge key={p} style={{ backgroundColor: PROFILE[p].color }} className="text-white text-[10px] px-1.5">{p}</Badge>)}
                    </span>
                  )}
                </div>
                {g.withDisc.length > 0 && (
                  <Badge variant="outline" className={g.fitCount === g.withDisc.length ? "text-emerald-500 border-emerald-500/40" : g.fitCount === 0 ? "text-rose-500 border-rose-500/40" : "text-amber-500 border-amber-500/40"}>
                    {g.fitCount}/{g.withDisc.length} no perfil
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.list.map(r => {
                  const dom = r.disc?.dominant;
                  const fit = dom ? g.ideal.includes(dom) : null;
                  return (
                    <span key={r.emp.id} className="inline-flex items-center gap-1.5 text-xs rounded-full border px-2 py-1">
                      <Avatar className="h-5 w-5"><AvatarImage src={r.emp.avatar_url || undefined} /><AvatarFallback className="text-[8px]">{r.emp.full_name?.[0]}</AvatarFallback></Avatar>
                      {r.emp.full_name?.split(" ")[0]}
                      {dom ? (
                        <Badge style={{ backgroundColor: PROFILE[dom].color }} className="text-white text-[9px] px-1">{dom}</Badge>
                      ) : <span className="text-[10px] text-muted-foreground">pendente</span>}
                      {fit === true && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      {fit === false && <span className="text-[10px] text-amber-500">atenção</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Referência: melhor perfil por cargo */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Insight: melhor perfil por cargo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(ROLE_IDEAL).filter(([role]) => rows.some(r => r.role === role)).map(([role, ideal]) => (
              <div key={role} className="rounded-lg border p-2.5">
                <p className="text-xs font-semibold">{roleLabel(role)}</p>
                <div className="flex gap-1 mt-1">{ideal.map(p => <Badge key={p} style={{ backgroundColor: PROFILE[p].color }} className="text-white text-[10px] px-1.5" title={PROFILE[p].name}>{p}</Badge>)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">{ideal.map(p => PROFILE[p].name).join(" + ")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de colaboradores */}
      <div>
        <Input placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md mb-3" />
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(r => {
              const dom = r.disc?.dominant;
              const ideal = ROLE_IDEAL[r.role || ""] || [];
              const fit = dom ? ideal.includes(dom) : null;
              return (
                <Card key={r.emp.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-11 w-11 ring-2 ring-background"><AvatarImage src={r.emp.avatar_url || undefined} /><AvatarFallback>{r.emp.full_name?.[0]}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.emp.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.fromCandidate && " · DISC da candidatura"}</p>
                      {r.disc ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          {(["D", "I", "S", "C"] as const).map(k => (
                            <div key={k} className="flex items-center gap-0.5" title={`${PROFILE[k].name}: ${r.disc[`${k.toLowerCase()}_score`] ?? 0}`}>
                              <span className="text-[9px] font-bold" style={{ color: PROFILE[k].color }}>{k}</span>
                              <span className="text-[9px] text-muted-foreground">{r.disc[`${k.toLowerCase()}_score`] ?? 0}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-6 mt-1 gap-1 text-[11px]" onClick={() => copyLink(r.emp)}><Copy className="w-3 h-3" />Copiar link</Button>
                      )}
                    </div>
                    {r.disc ? (
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Badge style={{ backgroundColor: PROFILE[dom].color }} className="text-white">{dom}</Badge>
                        {fit === true && <span className="text-[9px] text-emerald-500 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />no perfil</span>}
                        {fit === false && <span className="text-[9px] text-amber-500">fora do perfil</span>}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/40 shrink-0">Pendente</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && <p className="col-span-full text-sm text-muted-foreground text-center py-12">Nenhum colaborador encontrado.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
