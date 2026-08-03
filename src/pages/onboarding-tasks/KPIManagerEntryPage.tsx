import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Users, Search, Save, CalendarDays, ShieldCheck, RotateCcw } from "lucide-react";
import { toDateString } from "@/lib/dateUtils";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  periodicity: string;
  scope: "company" | "sector" | "team" | "salesperson" | "unit" | null;
  unit_id: string | null;
  team_id: string | null;
  sector_id: string | null;
  salesperson_id: string | null;
  sort_order: number | null;
}

interface Salesperson {
  id: string;
  name: string;
  unit_id: string | null;
  team_id: string | null;
  sector_id: string | null;
}

interface NamedRef {
  id: string;
  name: string;
  unit_id?: string | null;
}

interface LinkInfo {
  company_id: string;
  company_name: string;
  unit_id: string | null;
  label: string | null;
}

const parseNumber = (raw: string): number | null => {
  const s = (raw || "").trim();
  if (!s) return null;
  // aceita 1.234,56 e 1234.56
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return isNaN(n) ? null : n;
};

const formatValue = (v: number, type: string) => {
  if (type === "monetary") {
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);
};

export default function KPIManagerEntryPage() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";

  const [code, setCode] = useState(codeFromUrl);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(!!codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [units, setUnits] = useState<NamedRef[]>([]);
  const [sectors, setSectors] = useState<NamedRef[]>([]);
  const [teams, setTeams] = useState<NamedRef[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [spSectors, setSpSectors] = useState<Record<string, string[]>>({});
  const [kpiUnitIds, setKpiUnitIds] = useState<Record<string, string[]>>({});
  const [kpiSectorIds, setKpiSectorIds] = useState<Record<string, string[]>>({});
  const [kpiTeamIds, setKpiTeamIds] = useState<Record<string, string[]>>({});
  const [kpiSpIds, setKpiSpIds] = useState<Record<string, string[]>>({});

  const [entryDate, setEntryDate] = useState(toDateString(new Date()));
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterSalesperson, setFilterSalesperson] = useState<string>("all");
  const [search, setSearch] = useState("");

  // valores em edição: `${spId}:${kpiId}` -> string
  const [draft, setDraft] = useState<Record<string, string>>({});
  // valores já lançados no banco: `${spId}:${kpiId}` -> number
  const [saved, setSaved] = useState<Record<string, number>>({});

  useEffect(() => {
    if (codeFromUrl) validateCode(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateCode = async (value: string) => {
    const clean = (value || "").trim();
    if (!clean) {
      toast.error("Informe o código de acesso");
      return;
    }
    setAuthLoading(true);
    setLoading(true);
    try {
      // RPC única (security definer): unidades e equipes não são legíveis sem login,
      // então o bootstrap devolve tudo já escopado na empresa do código.
      const { data, error } = await (supabase as any).rpc("kpi_manager_bootstrap", { p_code: clean });
      if (error) throw error;
      const boot = data as any;
      if (!boot || !boot.company_id) {
        toast.error("Código inválido ou desativado");
        return;
      }
      applyBootstrap(boot);
    } catch (err) {
      console.error("[KPIManager] validate error:", err);
      toast.error("Erro ao validar o código");
    } finally {
      setAuthLoading(false);
      setLoading(false);
    }
  };

  const applyBootstrap = (boot: any) => {
    const group = (rows: any[], keyField: string, valField: string) => {
      const map: Record<string, string[]> = {};
      (rows || []).forEach((r: any) => {
        if (!map[r[keyField]]) map[r[keyField]] = [];
        map[r[keyField]].push(r[valField]);
      });
      return map;
    };

    const spList = (boot.salespeople || []) as Salesperson[];

    setUnits((boot.units || []) as NamedRef[]);
    setSectors((boot.sectors || []) as NamedRef[]);
    setTeams((boot.teams || []) as NamedRef[]);
    setSalespeople(spList);
    setKpis((boot.kpis || []) as KPI[]);
    setKpiUnitIds(group(boot.kpi_units || [], "kpi_id", "unit_id"));
    setKpiSectorIds(group(boot.kpi_sectors || [], "kpi_id", "sector_id"));
    setKpiTeamIds(group(boot.kpi_teams || [], "kpi_id", "team_id"));
    setKpiSpIds(group(boot.kpi_salespeople || [], "kpi_id", "salesperson_id"));

    const secMap = group(boot.salesperson_sectors || [], "salesperson_id", "sector_id");
    spList.forEach((sp) => {
      if (sp.sector_id) {
        if (!secMap[sp.id]) secMap[sp.id] = [];
        if (!secMap[sp.id].includes(sp.sector_id)) secMap[sp.id].push(sp.sector_id);
      }
    });
    setSpSectors(secMap);

    setLink({
      company_id: boot.company_id,
      company_name: boot.company_name,
      unit_id: boot.link_unit_id ?? null,
      label: boot.label ?? null,
    });
    if (boot.link_unit_id) setFilterUnit(boot.link_unit_id);
  };

  // ---- escopo: quais KPIs valem pra cada vendedor (mesma regra do link individual)
  const kpiAppliesTo = (kpi: KPI, sp: Salesperson): boolean => {
    const unitIdsForKpi = kpiUnitIds[kpi.id] || (kpi.unit_id ? [kpi.unit_id] : []);
    const sectorIdsForKpi = kpiSectorIds[kpi.id] || (kpi.sector_id ? [kpi.sector_id] : []);
    const teamIdsForKpi = kpiTeamIds[kpi.id] || (kpi.team_id ? [kpi.team_id] : []);
    const spIdsForKpi = kpiSpIds[kpi.id] || (kpi.salesperson_id ? [kpi.salesperson_id] : []);
    const sectorIdsOfSp = spSectors[sp.id] || [];
    const hasSpecificScope = !!kpi.scope && kpi.scope !== "company";

    if (kpi.scope === "salesperson" && spIdsForKpi.length > 0) return spIdsForKpi.includes(sp.id);
    if (kpi.scope === "team" && teamIdsForKpi.length > 0) return !!sp.team_id && teamIdsForKpi.includes(sp.team_id);
    if (kpi.scope === "sector" && sectorIdsForKpi.length > 0) return sectorIdsOfSp.some((s) => sectorIdsForKpi.includes(s));
    if (kpi.scope === "unit" && unitIdsForKpi.length > 0) return !!sp.unit_id && unitIdsForKpi.includes(sp.unit_id);

    if (unitIdsForKpi.length > 0 && !hasSpecificScope) {
      if (sp.unit_id && !unitIdsForKpi.includes(sp.unit_id)) return false;
    }
    if (sectorIdsForKpi.length > 0 && !hasSpecificScope) {
      if (sectorIdsOfSp.length > 0 && !sectorIdsOfSp.some((s) => sectorIdsForKpi.includes(s))) return false;
    }
    if (teamIdsForKpi.length > 0 && !hasSpecificScope) {
      if (sp.team_id && !teamIdsForKpi.includes(sp.team_id)) return false;
    }
    return true;
  };

  const salespersonInSector = (sp: Salesperson, sectorId: string) => (spSectors[sp.id] || []).includes(sectorId);

  const lockedUnit = link?.unit_id || null;

  const visibleUnits = useMemo(
    () => (lockedUnit ? units.filter((u) => u.id === lockedUnit) : units),
    [units, lockedUnit]
  );
  const visibleSectors = useMemo(
    () => (filterUnit === "all" ? sectors : sectors.filter((s) => !s.unit_id || s.unit_id === filterUnit)),
    [sectors, filterUnit]
  );
  const visibleTeams = useMemo(
    () => (filterUnit === "all" ? teams : teams.filter((t) => !t.unit_id || t.unit_id === filterUnit)),
    [teams, filterUnit]
  );

  const filteredSalespeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    return salespeople.filter((sp) => {
      if (lockedUnit && sp.unit_id !== lockedUnit) return false;
      if (filterUnit !== "all" && sp.unit_id !== filterUnit) return false;
      if (filterTeam !== "all" && sp.team_id !== filterTeam) return false;
      if (filterSector !== "all" && !salespersonInSector(sp, filterSector)) return false;
      if (filterSalesperson !== "all" && sp.id !== filterSalesperson) return false;
      if (term && !sp.name.toLowerCase().includes(term)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salespeople, filterUnit, filterTeam, filterSector, filterSalesperson, search, lockedUnit, spSectors]);

  const visibleKpis = useMemo(() => {
    if (filteredSalespeople.length === 0) return [] as KPI[];
    return kpis.filter((k) => filteredSalespeople.some((sp) => kpiAppliesTo(k, sp)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpis, filteredSalespeople, kpiUnitIds, kpiSectorIds, kpiTeamIds, kpiSpIds, spSectors]);

  // ---- lançamentos existentes na data
  useEffect(() => {
    if (!link?.company_id || filteredSalespeople.length === 0) {
      setSaved({});
      setDraft({});
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("kpi_entries")
        .select("salesperson_id, kpi_id, value")
        .eq("company_id", link.company_id)
        .eq("entry_date", entryDate)
        .in("salesperson_id", filteredSalespeople.map((sp) => sp.id));
      if (!alive) return;
      if (error) {
        console.error("[KPIManager] entries error:", error);
        return;
      }
      const map: Record<string, number> = {};
      (data || []).forEach((e: any) => {
        map[`${e.salesperson_id}:${e.kpi_id}`] = Number(e.value) || 0;
      });
      setSaved(map);
      setDraft({});
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.company_id, entryDate, filteredSalespeople.map((s) => s.id).join(",")]);

  const cellKey = (spId: string, kpiId: string) => `${spId}:${kpiId}`;

  const cellValue = (spId: string, kpiId: string) => {
    const key = cellKey(spId, kpiId);
    if (draft[key] !== undefined) return draft[key];
    const s = saved[key];
    if (s === undefined) return "";
    const kpi = kpis.find((k) => k.id === kpiId);
    return formatValue(s, kpi?.kpi_type || "numeric");
  };

  const changedCells = useMemo(() => {
    const out: Array<{ spId: string; kpiId: string; value: number; existed: boolean }> = [];
    Object.entries(draft).forEach(([key, raw]) => {
      const [spId, kpiId] = key.split(":");
      const parsed = parseNumber(raw);
      if (parsed === null) return;
      const existing = saved[key];
      if (existing !== undefined && Math.abs(existing - parsed) < 0.0001) return;
      out.push({ spId, kpiId, value: parsed, existed: existing !== undefined });
    });
    return out;
  }, [draft, saved]);

  const handleSave = async () => {
    if (!link?.company_id) return;
    if (changedCells.length === 0) {
      toast.info("Nada para salvar");
      return;
    }
    setSaving(true);
    try {
      for (const cell of changedCells) {
        const sp = salespeople.find((s) => s.id === cell.spId);
        const kpi = kpis.find((k) => k.id === cell.kpiId);
        if (!sp || !kpi) continue;
        const sectorForEntry = kpi.sector_id || sp.sector_id || (spSectors[sp.id]?.length === 1 ? spSectors[sp.id][0] : null);

        if (cell.existed) {
          const { error } = await supabase
            .from("kpi_entries")
            .update({ value: cell.value, updated_at: new Date().toISOString() })
            .eq("company_id", link.company_id)
            .eq("salesperson_id", cell.spId)
            .eq("kpi_id", cell.kpiId)
            .eq("entry_date", entryDate);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("kpi_entries").insert({
            company_id: link.company_id,
            salesperson_id: cell.spId,
            kpi_id: cell.kpiId,
            entry_date: entryDate,
            value: cell.value,
            unit_id: sp.unit_id,
            team_id: sp.team_id,
            sector_id: sectorForEntry,
            observations: "Lançamento gerencial",
          });
          if (error) throw error;
        }
      }

      const next = { ...saved };
      changedCells.forEach((c) => {
        next[cellKey(c.spId, c.kpiId)] = c.value;
      });
      setSaved(next);
      setDraft({});
      toast.success(`${changedCells.length} lançamento(s) salvo(s)`);
    } catch (err: any) {
      console.error("[KPIManager] save error:", err);
      toast.error(err?.message || "Erro ao salvar os lançamentos");
    } finally {
      setSaving(false);
    }
  };

  // ---- telas
  if (!link) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Lançamento Gerencial de KPIs</CardTitle>
            <CardDescription>Informe o código de acesso do gestor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Código de acesso</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: G7fK2p"
                onKeyDown={(e) => {
                  if (e.key === "Enter") validateCode(code);
                }}
              />
            </div>
            <Button className="w-full" onClick={() => validateCode(code)} disabled={authLoading}>
              {authLoading ? "Validando..." : "Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-background">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">{link.company_name}</h1>
              <p className="text-xs text-muted-foreground">
                Lançamento gerencial de KPIs{link.label ? ` · ${link.label}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lockedUnit && (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {units.find((u) => u.id === lockedUnit)?.name || "Unidade"}
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {filteredSalespeople.length} vendedor{filteredSalespeople.length === 1 ? "" : "es"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Data
                </Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Unidade</Label>
                <Select
                  value={filterUnit}
                  onValueChange={(v) => {
                    setFilterUnit(v);
                    setFilterSector("all");
                    setFilterTeam("all");
                    setFilterSalesperson("all");
                  }}
                  disabled={!!lockedUnit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {!lockedUnit && <SelectItem value="all">Todas</SelectItem>}
                    {visibleUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Setor</Label>
                <Select value={filterSector} onValueChange={(v) => { setFilterSector(v); setFilterSalesperson("all"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {visibleSectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Equipe</Label>
                <Select value={filterTeam} onValueChange={(v) => { setFilterTeam(v); setFilterSalesperson("all"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {visibleTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Vendedor</Label>
                <Select value={filterSalesperson} onValueChange={setFilterSalesperson}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {salespeople
                      .filter((sp) => {
                        if (lockedUnit && sp.unit_id !== lockedUnit) return false;
                        if (filterUnit !== "all" && sp.unit_id !== filterUnit) return false;
                        if (filterTeam !== "all" && sp.team_id !== filterTeam) return false;
                        if (filterSector !== "all" && !salespersonInSector(sp, filterSector)) return false;
                        return true;
                      })
                      .map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do vendedor" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Lançamentos de {entryDate.split("-").reverse().join("/")}</CardTitle>
              <CardDescription>
                Digite o valor de cada KPI. Células já lançadas aparecem preenchidas — editar sobrescreve o lançamento.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {changedCells.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Descartar
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving || changedCells.length === 0}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : `Salvar${changedCells.length > 0 ? ` (${changedCells.length})` : ""}`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">Carregando...</div>
            ) : filteredSalespeople.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">Nenhum vendedor no filtro selecionado</div>
            ) : visibleKpis.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">Nenhum KPI ativo para esses vendedores</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left font-medium px-4 py-2 sticky left-0 bg-muted/50 min-w-[200px]">Vendedor</th>
                      {visibleKpis.map((k) => (
                        <th key={k.id} className="text-left font-medium px-3 py-2 whitespace-nowrap min-w-[130px]">
                          {k.name}
                          {k.kpi_type === "monetary" && <span className="text-muted-foreground font-normal"> (R$)</span>}
                          {k.kpi_type === "percentage" && <span className="text-muted-foreground font-normal"> (%)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalespeople.map((sp) => (
                      <tr key={sp.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 sticky left-0 bg-background">
                          <div className="font-medium">{sp.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {units.find((u) => u.id === sp.unit_id)?.name || "Sem unidade"}
                          </div>
                        </td>
                        {visibleKpis.map((k) => {
                          const applies = kpiAppliesTo(k, sp);
                          const key = cellKey(sp.id, k.id);
                          const isDirty = draft[key] !== undefined;
                          const wasSaved = saved[key] !== undefined;
                          return (
                            <td key={k.id} className="px-3 py-1.5">
                              {applies ? (
                                <Input
                                  value={cellValue(sp.id, k.id)}
                                  onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="—"
                                  inputMode="decimal"
                                  className={`h-8 tabular-nums ${
                                    isDirty
                                      ? "border-primary ring-1 ring-primary/30"
                                      : wasSaved
                                      ? "border-emerald-500/40"
                                      : ""
                                  }`}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">n/a</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
