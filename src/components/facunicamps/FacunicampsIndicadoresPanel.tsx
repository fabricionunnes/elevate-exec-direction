import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Settings,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Search,
  DollarSign,
  Target,
  CalendarDays,
  Wallet,
  Activity,
  PieChart,
  BarChart3,
  Check,
  ChevronsUpDown,
  Minus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Cell,
  LabelList,
  AreaChart,
  Area,
  ComposedChart,
  Legend,
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Matricula {
  id: string;
  data_venda: string | null;
  vendedor: string | null;
  cliente: string | null;
  forma_ingresso: string | null;
  modalidade: string | null;
  curso: string | null;
  valor_matricula: number | null;
  valor_total: number | null;
}

interface MetaRow {
  id: string;
  mes: string; // ISO date "YYYY-MM-DD"
  meta: number;
  super: number;
  hiper: number;
  atendimentos: number;
  meta_faturamento: number;
}

interface MetaVendedorRow {
  id: string;
  mes: string;
  vendedor: string;
  meta: number;
  super: number;
  hiper: number;
  meta_faturamento: number;
}

type ActiveView = "mes-atual" | "historico" | "comparar";

// ─── Constants ────────────────────────────────────────────────────────────────

const CANCELLED_TYPES = ["CANCELADO", "TRANSFERIDO"];
const EXCLUDED_SELLERS = ["SECRETARIA", "ALUNO"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toMonthKey(date: string | null): string | null {
  if (!date) return null;
  return date.slice(0, 7);
}

function monthLabel(isoMonthKey: string) {
  try {
    return format(parseISO(isoMonthKey + "-01"), "MMM/yy", { locale: ptBR });
  } catch {
    return isoMonthKey;
  }
}

function truncateName(name: string, max = 12) {
  return name.length > max ? name.slice(0, max) + "..." : name;
}

function countWorkdaysRemaining(referenceDate: Date): number {
  const end = endOfMonth(referenceDate);
  const start = referenceDate > end ? end : referenceDate;
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

function countTotalWorkdaysInMonth(monthFirstDay: Date): number {
  const start = startOfMonth(monthFirstDay);
  const end = endOfMonth(monthFirstDay);
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

function countElapsedWorkdaysInMonth(monthFirstDay: Date, today: Date): number {
  const start = startOfMonth(monthFirstDay);
  const end = today < endOfMonth(monthFirstDay) ? today : endOfMonth(monthFirstDay);
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

function isCancelled(row: Matricula) {
  return CANCELLED_TYPES.includes((row.forma_ingresso ?? "").toUpperCase());
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl shadow-2xl p-3 min-w-[160px] border border-white/10" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))", backdropFilter: "blur(16px)" }}>
      <p className="text-[11px] font-bold text-white/50 mb-2 tracking-widest uppercase">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}80` }} />
            <span className="text-[11px] text-white/60">{p.name}</span>
          </div>
          <span className="text-[12px] font-bold text-white">
            {typeof p.value === "number" && p.value > 1000 ? fmtBRL(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  accentColor = "#16a34a",
  icon: Icon,
}: {
  title: string;
  value: string;
  sub?: string;
  accentColor?: string;
  icon?: React.ElementType;
}) {
  return (
    <div
      className="rounded-2xl p-3 sm:p-5 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden min-w-0"
      style={{
        background: `linear-gradient(135deg, #0f172a 0%, ${accentColor}22 100%)`,
        border: `1px solid ${accentColor}30`,
      }}
    >
      {Icon && (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4" style={{ color: accentColor, opacity: 0.2 }}>
          <Icon className="h-7 w-7 sm:h-10 sm:w-10" />
        </div>
      )}
      {/* glow orb */}
      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full blur-2xl" style={{ backgroundColor: accentColor, opacity: 0.2 }} />
      <p className="text-[9px] sm:text-[10px] font-bold text-white/50 uppercase tracking-[0.12em] sm:tracking-[0.18em] mb-1 sm:mb-2 truncate pr-8">{title}</p>
      <p className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tabular-nums tracking-tight break-words leading-tight">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-white/40 mt-1 sm:mt-1.5 truncate">{sub}</p>}
      <div className="mt-2 sm:mt-4 h-0.5 sm:h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}30)` }} />
    </div>
  );
}

// ─── Metas Config Modal ───────────────────────────────────────────────────────

function MetasConfigModal({
  open,
  onClose,
  metas,
  metasVendedor,
  vendedores,
  availableMonths,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  metas: MetaRow[];
  metasVendedor: MetaVendedorRow[];
  vendedores: string[];
  availableMonths: string[];
  onSaved: () => void;
}) {
  const sortedMonths = [...availableMonths].sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [vendorRows, setVendorRows] = useState<Record<string, { meta: string; super: string; hiper: string; meta_faturamento: string }>>({});
  const [atendimentos, setAtendimentos] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load data when month or source data changes
  useEffect(() => {
    if (!open) return;
    const init: typeof vendorRows = {};
    for (const v of vendedores) {
      const existing = metasVendedor.find(m => m.mes.slice(0, 7) === selectedMonth && m.vendedor === v);
      init[v] = {
        meta: existing ? String(existing.meta) : "",
        super: existing ? String(existing.super) : "",
        hiper: existing ? String(existing.hiper) : "",
        meta_faturamento: existing ? String(existing.meta_faturamento) : "",
      };
    }
    setVendorRows(init);
    const gen = metas.find(m => m.mes.slice(0, 7) === selectedMonth);
    setAtendimentos(gen ? String(gen.atendimentos) : "");
  }, [open, selectedMonth, metasVendedor, metas, vendedores]);

  const updateVendor = (vendedor: string, field: string, val: string) => {
    setVendorRows(prev => ({ ...prev, [vendedor]: { ...prev[vendedor], [field]: val } }));
  };

  const totals = {
    meta: Object.values(vendorRows).reduce((s, v) => s + (parseInt(v.meta) || 0), 0),
    super: Object.values(vendorRows).reduce((s, v) => s + (parseInt(v.super) || 0), 0),
    hiper: Object.values(vendorRows).reduce((s, v) => s + (parseInt(v.hiper) || 0), 0),
    meta_faturamento: Object.values(vendorRows).reduce((s, v) => s + (parseFloat(v.meta_faturamento) || 0), 0),
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save per-vendor metas
      const upserts = Object.entries(vendorRows)
        .filter(([, v]) => v.meta || v.super || v.hiper || v.meta_faturamento)
        .map(([vendedor, v]) => ({
          mes: selectedMonth + "-01",
          vendedor,
          meta: parseInt(v.meta || "0") || 0,
          super: parseInt(v.super || "0") || 0,
          hiper: parseInt(v.hiper || "0") || 0,
          meta_faturamento: parseFloat(v.meta_faturamento || "0") || 0,
          updated_at: new Date().toISOString(),
        }));

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("facunicamps_metas_vendedor")
          .upsert(upserts, { onConflict: "mes,vendedor" });
        if (error) throw error;
      }

      // Save general meta (atendimentos + computed totals)
      const { error: genErr } = await supabase
        .from("facunicamps_metas")
        .upsert({
          mes: selectedMonth + "-01",
          meta: totals.meta,
          super: totals.super,
          hiper: totals.hiper,
          atendimentos: parseInt(atendimentos || "0") || 0,
          meta_faturamento: totals.meta_faturamento,
          updated_at: new Date().toISOString(),
        }, { onConflict: "mes" });
      if (genErr) throw genErr;

      toast.success("Metas salvas com sucesso");
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error("Erro ao salvar metas: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Configurar Metas por Vendedor</DialogTitle>
        </DialogHeader>

        {/* Month selector */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-muted-foreground">Mês:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortedMonths.map((m) => (
                <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {vendedores.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum vendedor encontrado nos dados. Sincronize para carregar.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Vendedor</TableHead>
                  <TableHead>Meta (qtde)</TableHead>
                  <TableHead>Super</TableHead>
                  <TableHead>Hiper</TableHead>
                  <TableHead>Meta Fat. (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.map((vendedor) => (
                  <TableRow key={vendedor}>
                    <TableCell className="font-medium text-sm">{vendedor}</TableCell>
                    {(["meta", "super", "hiper", "meta_faturamento"] as const).map((field) => (
                      <TableCell key={field}>
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={vendorRows[vendedor]?.[field] ?? ""}
                          onChange={(e) => updateVendor(vendedor, field, e.target.value)}
                          placeholder="0"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell className="font-bold text-sm">TOTAL GERAL</TableCell>
                  <TableCell><span className="text-sm font-bold text-primary">{totals.meta}</span></TableCell>
                  <TableCell><span className="text-sm font-bold text-primary">{totals.super}</span></TableCell>
                  <TableCell><span className="text-sm font-bold text-primary">{totals.hiper}</span></TableCell>
                  <TableCell><span className="text-sm font-bold text-primary">{fmtBRL(totals.meta_faturamento)}</span></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Atendimentos (general) */}
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Atendimentos no mês:</span>
          <Input
            type="number"
            className="w-32 h-8 text-sm"
            value={atendimentos}
            onChange={(e) => setAtendimentos(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Metas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ranking Chart ────────────────────────────────────────────────────────────

function RankingBarChart({
  title,
  data,
  color = C3D.green,
  limit = 16,
}: {
  title: string;
  data: { name: string; value: number }[];
  color?: { front: string; top: string; side: string };
  nameKey?: string;
  valueKey?: string;
  limit?: number;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, limit);
  if (sorted.length === 0) {
    return (
      <DarkChartCard title={title} accentColor={color.front}>
        <p className="text-white/40 text-sm">Sem dados</p>
      </DarkChartCard>
    );
  }
  const chartData = sorted.map((d) => ({ value: d.value, name: truncateName(d.name, 20), fullName: d.name }));
  const chartHeight = Math.max(200, chartData.length * 36);
  return (
    <DarkChartCard title={title} accentColor={color.front}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 52, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_COLOR} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={90} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entry = payload[0];
              const full = (entry.payload as { fullName?: string }).fullName ?? entry.payload.name;
              return (
                <div className="rounded-xl shadow-2xl p-3 border border-white/10 max-w-[260px]" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))" }}>
                  <p className="text-[11px] font-bold text-white/50 mb-1 uppercase tracking-widest">Curso / Vendedor</p>
                  <p className="text-xs font-semibold text-white mb-1 leading-snug">{full}</p>
                  <p className="text-[11px] text-white/60">Qtde: <span className="font-bold text-white">{entry.value}</span></p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            name="Qtde."
            radius={[0, 4, 4, 0]}
            shape={(props: Record<string, unknown>) => (
              <ThreeDBar {...props} frontColor={color.front} topColor={color.top} sideColor={color.side} />
            )}
          >
            <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "rgba(255,255,255,0.8)", fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </DarkChartCard>
  );
}

// ─── Progress Bar for Metas ───────────────────────────────────────────────────

function MetaProgressBar({
  label,
  current,
  target,
  color,
  dashed = false,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  dashed?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isAchieved = current >= target && target > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-white/60">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">{current} / {target}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}25`, color }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
            opacity: dashed ? 0.7 : 1,
            boxShadow: isAchieved ? `0 0 8px ${color}60` : undefined,
          }}
        />
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-6 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/30" />
      <h3 className="text-base font-bold text-foreground">{title}</h3>
    </div>
  );
}

// ─── Multi-select Searchable Select ──────────────────────────────────────────

function MultiSearchableSelect({
  values,
  onValuesChange,
  placeholder,
  emptyLabel,
  options,
  className,
}: {
  values: string[];
  onValuesChange: (v: string[]) => void;
  placeholder: string;
  emptyLabel: string;
  options: { label: string; value: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    if (values.includes(v)) {
      onValuesChange(values.filter((x) => x !== v));
    } else {
      onValuesChange([...values, v]);
    }
  };

  const displayLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? options.find((o) => o.value === values[0])?.label ?? values[0]
      : `${values.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`h-8 text-xs justify-between font-normal w-full ${className ?? ""}`}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">Nenhum resultado</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => onValuesChange([])}
                className="text-xs"
              >
                <Check className={`mr-2 h-3 w-3 ${values.length === 0 ? "opacity-100" : "opacity-0"}`} />
                {emptyLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => toggle(opt.value)}
                  className="text-xs"
                >
                  <div className={`mr-2 h-3 w-3 rounded border flex items-center justify-center ${values.includes(opt.value) ? "bg-primary border-primary" : "border-border"}`}>
                    {values.includes(opt.value) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {values.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button size="sm" variant="ghost" className="w-full text-xs h-7" onClick={() => onValuesChange([])}>
              Limpar seleção ({values.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Term Vision Card (identical to ProjectTermVisionCard but uses spreadsheet data) ──

interface TermVisionProps {
  /** Pre-computed monthly revenue map: { "YYYY-MM": totalFaturamento } */
  monthlyRevenue: Record<string, number>;
  titleSuffix?: string;
}

function FacunicampsTermVisionCard({ monthlyRevenue, titleSuffix }: TermVisionProps) {
  const now = new Date();

  // Build 12-point series ending at the latest month that has data
  const allKeys = Object.keys(monthlyRevenue).sort();
  const latestKey = allKeys[allKeys.length - 1] ?? format(now, "yyyy-MM");
  const latestDate = parseISO(latestKey + "-01");

  const chartData = useMemo(() => {
    const data: {
      month: string; monthLabel: string; shortLabel: string;
      revenue: number; qtr: number; ytd: number; mat: number;
    }[] = [];

    for (let i = 11; i >= 0; i--) {
      const md = subMonths(latestDate, i);
      const mk = format(md, "yyyy-MM");
      const ml = format(md, "MMMM", { locale: ptBR });
      const sl = format(md, "MMM", { locale: ptBR }).replace(".", "");
      const rev = monthlyRevenue[mk] ?? 0;

      // QTR: avg of 3 months BEFORE this month
      let qS = 0;
      for (let j = 1; j <= 3; j++) qS += monthlyRevenue[format(subMonths(md, j), "yyyy-MM")] ?? 0;
      const qtr = qS / 3;

      // YTD: avg monthly from Jan 1 of same year up to (but not including) this month
      const yr = md.getFullYear(), mo = md.getMonth();
      let yS = 0, yC = 0;
      for (let m = 0; m < mo; m++) {
        yS += monthlyRevenue[format(new Date(yr, m, 1), "yyyy-MM")] ?? 0;
        yC++;
      }
      const ytd = yC > 0 ? yS / yC : 0;

      // MAT: avg of 12 months BEFORE this month
      let mS = 0;
      for (let j = 1; j <= 12; j++) mS += monthlyRevenue[format(subMonths(md, j), "yyyy-MM")] ?? 0;
      const mat = mS / 12;

      data.push({
        month: mk,
        monthLabel: ml.charAt(0).toUpperCase() + ml.slice(1),
        shortLabel: sl.charAt(0).toUpperCase() + sl.slice(1),
        revenue: rev, qtr, ytd, mat,
      });
    }
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyRevenue]);

  const last = chartData[chartData.length - 1];
  const kpis = {
    currentMonth: last?.revenue ?? 0,
    qtr: last?.qtr ?? 0,
    ytd: last?.ytd ?? 0,
    mat: last?.mat ?? 0,
    currentVsQtr: last?.qtr && last.qtr > 0 ? ((last.revenue - last.qtr) / last.qtr) * 100 : 0,
    qtrVsYtd: last?.ytd && last.ytd > 0 ? ((last.qtr - last.ytd) / last.ytd) * 100 : 0,
    ytdVsMat: last?.mat && last.mat > 0 ? ((last.ytd - last.mat) / last.mat) * 100 : 0,
  };

  const fmtCur = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}mi`;
    if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}mil`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
  };
  const fmtAxis = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}mi`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return v.toString();
  };

  const VarBadge = ({ value, label }: { value: number; label: string }) => {
    const neutral = Math.abs(value) < 0.1;
    const pos = value > 0;
    const Icon = neutral ? Minus : pos ? TrendingUp : TrendingDown;
    const col = neutral ? "rgba(255,255,255,0.3)" : pos ? "#34d399" : "#fb7185";
    return (
      <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: col }}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}% {label}
      </span>
    );
  };

  const TermTooltip = ({ active, payload }: { active?: boolean; payload?: { dataKey: string; color: string; value: number; payload: { monthLabel: string } }[] }) => {
    if (!active || !payload?.length) return null;
    const lblMap: Record<string, string> = { revenue: "Vendas", qtr: "QTR", ytd: "YTD", mat: "MAT" };
    return (
      <div className="rounded-2xl shadow-2xl p-4 min-w-[180px] border border-white/10" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))", backdropFilter: "blur(16px)" }}>
        <p className="text-[11px] font-bold text-white/50 mb-2.5 tracking-widest uppercase">{payload[0]?.payload?.monthLabel}</p>
        {payload.map((e, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color, boxShadow: `0 0 8px ${e.color}60` }} />
              <span className="text-[11px] text-white/60 font-medium">{lblMap[e.dataKey] ?? e.dataKey}</span>
            </div>
            <span className="text-[12px] font-bold text-white">{fmtCur(e.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const lines = [
    { key: "revenue", label: "VENDAS", color: "#34d399", opacity: 0.25, w: 3, dash: "6 3" },
    { key: "qtr",     label: "QTR",    color: "#c084fc", opacity: 0.15, w: 2, dash: undefined },
    { key: "ytd",     label: "YTD",    color: "#60a5fa", opacity: 0.12, w: 2, dash: undefined },
    { key: "mat",     label: "MAT",    color: "#fbbf24", opacity: 0.10, w: 2, dash: undefined },
  ] as const;

  const cards = [
    { label: "Mês Atual",  value: kpis.currentMonth, varVal: kpis.currentVsQtr, vl: "vs QTR",  color: "#34d399" },
    { label: "QTR (3m)",   value: kpis.qtr,           varVal: kpis.qtrVsYtd,     vl: "vs YTD",  color: "#c084fc" },
    { label: "YTD",        value: kpis.ytd,            varVal: kpis.ytdVsMat,     vl: "vs MAT",  color: "#60a5fa" },
    { label: "MAT (12m)",  value: kpis.mat,            varVal: null,              vl: "",         color: "#fbbf24" },
  ];

  if (chartData.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="relative overflow-hidden rounded-2xl border-0 shadow-2xl" style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}>
        {/* Ambient glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)" }} />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full blur-[60px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.12), transparent 70%)" }} />
        <div className="absolute top-1/3 left-1/2 w-40 h-40 rounded-full blur-[50px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(96,165,250,0.08), transparent 70%)" }} />

        {/* Header */}
        <div className="relative z-10 px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(96,165,250,0.2))" }}>
            <Activity className="h-5 w-5 text-purple-300" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Visão de Curto, Médio e Longo Prazo{titleSuffix ? ` — ${titleSuffix}` : ""}
            </h3>
            <p className="text-[11px] text-white/40 font-medium">Análise de tendência • Últimos 12 meses</p>
          </div>
        </div>

        <div className="relative z-10 px-5 pb-5 space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {cards.map((c, idx) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: idx * 0.07 }}
                className="relative overflow-hidden rounded-2xl p-3.5 border border-white/[0.06]"
                style={{ background: `linear-gradient(135deg, ${c.color}15, ${c.color}05)` }}
              >
                <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: `${c.color}99` }}>{c.label}</span>
                <p className="text-xl sm:text-2xl font-extrabold mt-1 tracking-tight text-white">{fmtCur(c.value)}</p>
                <div className="mt-2">
                  {c.varVal !== null
                    ? <VarBadge value={c.varVal} label={c.vl} />
                    : <span className="text-[10px] text-white/30 font-medium">Média anual</span>
                  }
                </div>
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full opacity-20 blur-md" style={{ backgroundColor: c.color }} />
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl p-3 pt-4 border border-white/[0.06]"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))" }}
          >
            <div className="h-[280px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    {lines.map(l => (
                      <linearGradient key={`atv-${l.key}`} id={`atv-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={l.color} stopOpacity={l.opacity} />
                        <stop offset="85%" stopColor={l.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)", fontWeight: 600 }} interval={0} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)", fontWeight: 500 }} width={45} axisLine={false} tickLine={false} />
                  <Tooltip content={<TermTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                  {lines.map(l => (
                    <Area
                      key={l.key} type="monotone" dataKey={l.key} name={l.label}
                      stroke={l.color} strokeWidth={l.w} fill={`url(#atv-${l.key})`}
                      dot={{ fill: l.color, strokeWidth: 0, r: l.key === "revenue" ? 4 : 2.5 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: "#0f172a", fill: l.color }}
                      strokeDasharray={l.dash}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-2">
            {lines.map(l => (
              <div key={l.key} className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/[0.06]" style={{ background: `linear-gradient(135deg, ${l.color}10, transparent)` }}>
                <div className="relative">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                  <div className="absolute inset-0 w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: l.color, opacity: 0.15, animationDuration: "3s" }} />
                </div>
                <span className="text-[11px] font-bold text-white/60 tracking-wide">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── 3D Chart constants ───────────────────────────────────────────────────────

const DARK_BG = "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)";
const DARK_BORDER = "1px solid rgba(255,255,255,0.06)";
const AXIS_TICK = { fontSize: 10, fill: "rgba(255,255,255,0.40)" as string };
const GRID_COLOR = "rgba(255,255,255,0.05)";

// 3D color palettes
const C3D = {
  green:   { front: "#22c55e", top: "#86efac", side: "#15803d" },
  blue:    { front: "#3b82f6", top: "#93c5fd", side: "#1e3a8a" },
  purple:  { front: "#a855f7", top: "#d8b4fe", side: "#6b21a8" },
  orange:  { front: "#f97316", top: "#fdba74", side: "#9a3412" },
  emerald: { front: "#10b981", top: "#6ee7b7", side: "#065f46" },
};

// ─── 3D Bar shape ─────────────────────────────────────────────────────────────

function ThreeDBar(props: Record<string, unknown>) {
  const x = (props.x as number) ?? 0;
  const y = (props.y as number) ?? 0;
  const width = (props.width as number) ?? 0;
  const height = (props.height as number) ?? 0;
  const frontColor = (props.frontColor as string) ?? C3D.blue.front;
  const topColor   = (props.topColor   as string) ?? C3D.blue.top;
  const sideColor  = (props.sideColor  as string) ?? C3D.blue.side;
  if (!height || height <= 0 || !width || width <= 0) return null;
  const d = 6;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={frontColor} rx={2} />
      <path d={`M${x},${y} L${x+d},${y-d} L${x+width+d},${y-d} L${x+width},${y} Z`} fill={topColor} />
      <path d={`M${x+width},${y} L${x+width+d},${y-d} L${x+width+d},${y+height-d} L${x+width},${y+height} Z`} fill={sideColor} />
    </g>
  );
}

// ─── Dark Chart Card wrapper ──────────────────────────────────────────────────

function DarkChartCard({ title, accentColor = "#8b5cf6", children }: {
  title: string;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl" style={{ background: DARK_BG, border: DARK_BORDER }}>
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[50px] pointer-events-none" style={{ backgroundColor: accentColor, opacity: 0.15 }} />
      <div className="relative z-10 px-5 pt-4 pb-1 flex items-center gap-3">
        <div className="h-5 w-1 rounded-full" style={{ background: `linear-gradient(180deg, ${accentColor}, ${accentColor}40)` }} />
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <div className="relative z-10 px-5 pb-5 pt-2">
        {children}
      </div>
    </div>
  );
}

// ─── Modalidade Badge ─────────────────────────────────────────────────────────

function ModalidadeBadge({ modalidade }: { modalidade: string | null }) {
  if (!modalidade) return <Badge variant="outline">--</Badge>;
  if (modalidade === "EAD") return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-xs">{modalidade}</Badge>;
  if (modalidade.toLowerCase().includes("presencial")) return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-xs">{modalidade}</Badge>;
  return <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-xs">{modalidade}</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FacunicampsIndicadoresPanel() {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [metas, setMetas] = useState<MetaRow[]>([]);
  const [metasVendedor, setMetasVendedor] = useState<MetaVendedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("mes-atual");
  const [showFilters, setShowFilters] = useState(false);
  const [showMetasConfig, setShowMetasConfig] = useState(false);

  // Selected month override (null = use latest from data)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Filters (multi-select — arrays of selected values)
  const [filterModalidade, setFilterModalidade] = useState<string[]>([]);
  const [filterVendedorAtivo, setFilterVendedorAtivo] = useState<string[]>([]);
  const [filterFormaIngresso, setFilterFormaIngresso] = useState<string[]>([]);
  const [filterVendedorDesligado, setFilterVendedorDesligado] = useState<string[]>([]);

  // Date range filter
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Compare view
  const [compareFrom1, setCompareFrom1] = useState("");
  const [compareTo1, setCompareTo1] = useState("");
  const [compareFrom2, setCompareFrom2] = useState("");
  const [compareTo2, setCompareTo2] = useState("");

  // Show cancelled toggle (default false = cancelados ocultos)
  const [showCancelled, setShowCancelled] = useState(false);

  // Table search & sort
  const [tableSearch, setTableSearch] = useState("");
  const [tableSortCol, setTableSortCol] = useState<string>("data_venda");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");
  const [rankingLimit, setRankingLimit] = useState<number>(16);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch matriculas in pages of 1000 until all records are loaded
      const PAGE_SIZE = 1000;
      let allMats: Matricula[] = [];
      let page = 0;
      while (true) {
        const { data, error } = await supabase
          .from("facunicamps_matriculas")
          .select("*")
          .order("data_venda", { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allMats = [...allMats, ...(data as Matricula[])];
        if (data.length < PAGE_SIZE) break; // última página
        page++;
      }

      const [{ data: metasData, error: metasErr }, { data: metasVenData, error: metasVenErr }] =
        await Promise.all([
          supabase.from("facunicamps_metas").select("*").order("mes", { ascending: true }),
          supabase.from("facunicamps_metas_vendedor").select("*").order("mes", { ascending: true }),
        ]);
      if (metasErr) throw metasErr;
      if (metasVenErr) throw metasVenErr;
      setMatriculas(allMats);
      setMetas((metasData as MetaRow[]) ?? []);
      setMetasVendedor((metasVenData as MetaVendedorRow[]) ?? []);
    } catch (err: unknown) {
      toast.error("Erro ao carregar dados: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Sync ──────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("facunicamps-sync", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Sync failed");
      toast.success(`Sincronização concluída: ${data.rows_imported} matrículas importadas`);
      await fetchData();
    } catch (err: unknown) {
      toast.error("Erro na sincronização: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSyncing(false);
    }
  };

  // ── Derived lists for filters ──────────────────────────────────────────────

  const uniqueModalidades = useMemo(
    () => [...new Set(matriculas.map((m) => m.modalidade).filter(Boolean) as string[])].sort(),
    [matriculas]
  );
  const uniqueVendedores = useMemo(
    () => [...new Set(matriculas.map((m) => m.vendedor).filter(Boolean) as string[])].sort(),
    [matriculas]
  );
  const uniqueFormasIngresso = useMemo(
    () =>
      [...new Set(matriculas.map((m) => m.forma_ingresso).filter(Boolean) as string[])].sort(),
    [matriculas]
  );

  // ── Available months for metas config ──────────────────────────────────────

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const m of matriculas) {
      const k = toMonthKey(m.data_venda);
      if (k) set.add(k);
    }
    const now = format(new Date(), "yyyy-MM");
    set.add(now);
    return [...set].sort();
  }, [matriculas]);

  // ── Derive effective current month key (latest month with data or override) ──

  const currentMonthKey = useMemo(() => {
    if (selectedMonthKey) return selectedMonthKey;
    return format(new Date(), "yyyy-MM");
  }, [selectedMonthKey]);

  // All months from earliest data to today (newest first)
  const dataMonthKeys = useMemo(() => {
    const keys = matriculas.map(m => toMonthKey(m.data_venda)).filter(Boolean) as string[];
    if (keys.length === 0) return [format(new Date(), "yyyy-MM")];
    const earliest = [...keys].sort()[0];
    const today = format(new Date(), "yyyy-MM");
    const result: string[] = [];
    let cur = parseISO(earliest + "-01");
    const endDate = parseISO(today + "-01");
    while (cur <= endDate) {
      result.push(format(cur, "yyyy-MM"));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return result.reverse();
  }, [matriculas]);

  // ── Apply filters ──────────────────────────────────────────────────────────

  const filteredAll = useMemo(() => {
    let rows = matriculas;
    if (filterModalidade.length > 0) rows = rows.filter((m) => filterModalidade.includes(m.modalidade ?? ""));
    if (filterVendedorAtivo.length > 0) rows = rows.filter((m) => filterVendedorAtivo.includes(m.vendedor ?? ""));
    if (filterFormaIngresso.length > 0) rows = rows.filter((m) => filterFormaIngresso.includes(m.forma_ingresso ?? ""));
    if (filterVendedorDesligado.length > 0) rows = rows.filter((m) => !filterVendedorDesligado.includes(m.vendedor ?? ""));
    if (filterDateFrom) rows = rows.filter((m) => m.data_venda != null && m.data_venda >= filterDateFrom);
    if (filterDateTo) rows = rows.filter((m) => m.data_venda != null && m.data_venda <= filterDateTo);
    return rows;
  }, [matriculas, filterModalidade, filterVendedorAtivo, filterFormaIngresso, filterVendedorDesligado, filterDateFrom, filterDateTo]);

  // Active sales only (no CANCELADO/TRANSFERIDO)
  const activeSales = useMemo(
    () => showCancelled ? filteredAll : filteredAll.filter((m) => !isCancelled(m)),
    [filteredAll, showCancelled]
  );

  // ── Current month data ────────────────────────────────────────────────────

  const currentMonthSales = useMemo(
    () => activeSales.filter((m) => toMonthKey(m.data_venda) === currentMonthKey),
    [activeSales, currentMonthKey]
  );

  const currentMeta = useMemo(
    () => metas.find((m) => m.mes.slice(0, 7) === currentMonthKey),
    [metas, currentMonthKey]
  );

  // Effective meta: vendor-specific if single vendor filter, else sum of all vendors, else fallback to general
  const effectiveMeta = useMemo(() => {
    const vendRows = metasVendedor.filter(m => m.mes.slice(0, 7) === currentMonthKey);

    if (filterVendedorAtivo.length === 1) {
      const vendorRow = vendRows.find(m => m.vendedor === filterVendedorAtivo[0]);
      if (vendorRow) return { meta: vendorRow.meta, super: vendorRow.super, hiper: vendorRow.hiper, meta_faturamento: vendorRow.meta_faturamento };
    }

    if (vendRows.length > 0) {
      return {
        meta: vendRows.reduce((s, m) => s + m.meta, 0),
        super: vendRows.reduce((s, m) => s + m.super, 0),
        hiper: vendRows.reduce((s, m) => s + m.hiper, 0),
        meta_faturamento: vendRows.reduce((s, m) => s + m.meta_faturamento, 0),
      };
    }

    if (currentMeta) return { meta: currentMeta.meta, super: currentMeta.super, hiper: currentMeta.hiper, meta_faturamento: currentMeta.meta_faturamento };
    return null;
  }, [metasVendedor, currentMonthKey, filterVendedorAtivo, currentMeta]);

  // Use a reference date for the selected month (first day of that month)
  const referenceDate = useMemo(() => {
    try {
      return parseISO(currentMonthKey + "-01");
    } catch {
      return new Date();
    }
  }, [currentMonthKey]);

  // ── Current month KPIs ────────────────────────────────────────────────────

  const cmKpis = useMemo(() => {
    const count = currentMonthSales.length;
    const valorMatricula = currentMonthSales.reduce((s, m) => s + (m.valor_matricula ?? 0), 0);
    const valorTotal = currentMonthSales.reduce((s, m) => s + (m.valor_total ?? 0), 0);
    const paidMat = currentMonthSales.filter((m) => (m.valor_matricula ?? 0) > 0);
    const paidTotal = currentMonthSales.filter((m) => (m.valor_total ?? 0) > 0);
    const ticketMat = paidMat.length > 0 ? valorMatricula / paidMat.length : 0;
    const ticketTotal = paidTotal.length > 0 ? valorTotal / paidTotal.length : 0;
    const metaCount = effectiveMeta?.meta ?? 0;
    const remaining = metaCount > 0 ? Math.max(0, metaCount - count) : 0;
    const workdays = countWorkdaysRemaining(referenceDate);
    const diaria = workdays > 0 && remaining > 0 ? Math.ceil(remaining / workdays) : 0;
    return { count, valorMatricula, valorTotal, ticketMat, ticketTotal, metaCount, remaining, diaria };
  }, [currentMonthSales, effectiveMeta, referenceDate]);

  // ── Daily targets & averages ──────────────────────────────────────────────

  const dailyMetrics = useMemo(() => {
    const totalWorkdays = countTotalWorkdaysInMonth(referenceDate);
    const elapsedWorkdays = countElapsedWorkdaysInMonth(referenceDate, new Date());

    const metaDiariaVendas = effectiveMeta?.meta && totalWorkdays > 0
      ? effectiveMeta.meta / totalWorkdays
      : null;
    const metaDiariaFaturamento = effectiveMeta?.meta_faturamento && totalWorkdays > 0
      ? effectiveMeta.meta_faturamento / totalWorkdays
      : null;

    const mediaVendasDiarias = elapsedWorkdays > 0
      ? cmKpis.count / elapsedWorkdays
      : 0;
    const mediaFaturamentoDiario = elapsedWorkdays > 0
      ? cmKpis.valorTotal / elapsedWorkdays
      : 0;

    return { metaDiariaVendas, metaDiariaFaturamento, mediaVendasDiarias, mediaFaturamentoDiario, totalWorkdays, elapsedWorkdays };
  }, [effectiveMeta, referenceDate, cmKpis]);

  // ── Sales per day chart ───────────────────────────────────────────────────

  const salesPerDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of currentMonthSales) {
      if (!m.data_venda) continue;
      map.set(m.data_venda, (map.get(m.data_venda) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: format(parseISO(date), "dd/MM", { locale: ptBR }),
        count,
      }));
  }, [currentMonthSales]);

  // ── Vendedores ranking ────────────────────────────────────────────────────

  const buildVendedoresRanking = (rows: Matricula[]) => {
    const map = new Map<string, number>();
    for (const m of rows) {
      const v = (m.vendedor ?? "").toUpperCase();
      if (EXCLUDED_SELLERS.some((ex) => v.includes(ex))) continue;
      map.set(m.vendedor ?? "?", (map.get(m.vendedor ?? "?") ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  };

  const cmVendedoresRanking = useMemo(() => buildVendedoresRanking(currentMonthSales), [currentMonthSales]);

  // ── Cursos ranking ────────────────────────────────────────────────────────

  const buildCursosRanking = (rows: Matricula[]) => {
    const map = new Map<string, number>();
    for (const m of rows) {
      const c = m.curso ?? "?";
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  };

  const cmCursosRanking = useMemo(() => buildCursosRanking(currentMonthSales), [currentMonthSales]);

  // ── Historical monthly aggregation ────────────────────────────────────────

  const monthlyData = useMemo(() => {
    const map = new Map<string, { count: number; valorTotal: number; valorMatricula: number }>();
    for (const m of activeSales) {
      const k = toMonthKey(m.data_venda);
      if (!k) continue;
      const cur = map.get(k) ?? { count: 0, valorTotal: 0, valorMatricula: 0 };
      cur.count++;
      cur.valorTotal += m.valor_total ?? 0;
      cur.valorMatricula += m.valor_matricula ?? 0;
      map.set(k, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        label: monthLabel(month),
        ...v,
      }));
  }, [activeSales]);

  // Historical KPIs
  const histKpis = useMemo(() => {
    const count = activeSales.length;
    const valorMatricula = activeSales.reduce((s, m) => s + (m.valor_matricula ?? 0), 0);
    const valorTotal = activeSales.reduce((s, m) => s + (m.valor_total ?? 0), 0);
    const totalMeta = metas.reduce((s, m) => s + m.meta, 0);
    return { count, valorMatricula, valorTotal, totalMeta };
  }, [activeSales, metas]);

  // Historical vendedores ranking
  const histVendedoresRanking = useMemo(() => buildVendedoresRanking(activeSales), [activeSales]);
  const histCursosRanking = useMemo(() => buildCursosRanking(activeSales), [activeSales]);

  // Vendas vs Meta historical chart
  const vendasVsMetaData = useMemo(() => {
    return monthlyData.map((md) => {
      const metaRow = metas.find((m) => m.mes.slice(0, 7) === md.month);
      return {
        label: md.label,
        vendas: md.count,
        meta: metaRow?.meta || null,
        super: metaRow?.super || null,
        hiper: metaRow?.hiper || null,
      };
    });
  }, [monthlyData, metas]);

  // Monthly data with % change for bar labels
  const monthlyDataWithPct = useMemo(() => {
    return monthlyData.map((md, idx) => {
      const prev = idx > 0 ? monthlyData[idx - 1].valorTotal : null;
      const pct = prev && prev > 0 ? ((md.valorTotal - prev) / prev) * 100 : null;
      return { ...md, pct };
    });
  }, [monthlyData]);

  // Funnel
  const totalAtendimentos = useMemo(() => metas.reduce((s, m) => s + m.atendimentos, 0), [metas]);
  const totalVendas = activeSales.length;
  const conversionRate = totalAtendimentos > 0 ? ((totalVendas / totalAtendimentos) * 100).toFixed(1) : null;

  // ── Curto / Médio / Longo prazo ───────────────────────────────────────────

  const prazoStats = useMemo(() => {
    const sortedMonths = [...new Set(activeSales.map(m => toMonthKey(m.data_venda)).filter(Boolean) as string[])].sort().reverse();
    const latestMonth = sortedMonths[0];
    if (!latestMonth) return null;

    const getStats = (monthKeys: string[], label: string) => {
      const rows = activeSales.filter(m => {
        const k = toMonthKey(m.data_venda);
        return k && monthKeys.includes(k);
      });
      const count = rows.length;
      const valorTotal = rows.reduce((s, m) => s + (m.valor_total ?? 0), 0);
      const paid = rows.filter(m => (m.valor_total ?? 0) > 0);
      const ticketMedio = paid.length > 0 ? valorTotal / paid.length : 0;
      // avg per month
      const avgVendasMes = monthKeys.length > 0 ? count / monthKeys.length : 0;
      const avgFatMes = monthKeys.length > 0 ? valorTotal / monthKeys.length : 0;
      return { label, count, valorTotal, ticketMedio, avgVendasMes, avgFatMes, months: monthKeys.length };
    };

    const curto = [latestMonth]; // último mês
    const medio = sortedMonths.slice(0, 3); // últimos 3 meses
    const longo = sortedMonths.slice(0, 12); // últimos 12 meses

    return {
      curto: getStats(curto, "Curto Prazo (1 mês)"),
      medio: getStats(medio, "Médio Prazo (3 meses)"),
      longo: getStats(longo, "Longo Prazo (12 meses)"),
    };
  }, [activeSales]);

  // ── Monthly revenue map (for TermVisionCard) ─────────────────────────────

  const monthlyRevenueMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of activeSales) {
      const k = toMonthKey(m.data_venda);
      if (!k) continue;
      map[k] = (map[k] ?? 0) + (m.valor_total ?? 0);
    }
    return map;
  }, [activeSales]);

  // ── Prazo chart data (per month breakdown for each horizon) ──────────────

  const prazoChartData = useMemo(() => {
    const sortedKeys = [...new Set(activeSales.map(m => toMonthKey(m.data_venda)).filter(Boolean) as string[])].sort().reverse();
    const latestKey = sortedKeys[0];
    if (!latestKey) return null;

    const curtoKeys = sortedKeys.slice(0, 1);
    const medioKeys = sortedKeys.slice(0, 3);
    const longoKeys = sortedKeys.slice(0, 12);

    const buildSeries = (keys: string[]) =>
      [...keys].sort().map((k) => {
        const rows = activeSales.filter(m => toMonthKey(m.data_venda) === k);
        const count = rows.length;
        const valorTotal = rows.reduce((s, m) => s + (m.valor_total ?? 0), 0);
        const metaRow = metas.find(m => m.mes.slice(0, 7) === k);
        return {
          label: monthLabel(k),
          vendas: count,
          faturamento: valorTotal,
          meta: metaRow?.meta ?? null,
        };
      });

    return {
      curto: buildSeries(curtoKeys),
      medio: buildSeries(medioKeys),
      longo: buildSeries(longoKeys),
    };
  }, [activeSales, metas]);

  // ── Compare periods ────────────────────────────────────────────────────────

  const availableMonthsList = useMemo(() => {
    const keys = activeSales.map(m => toMonthKey(m.data_venda)).filter(Boolean) as string[];
    if (keys.length === 0) return [];
    const earliest = [...keys].sort()[0];
    const today = format(new Date(), "yyyy-MM");
    const result: string[] = [];
    let cur = parseISO(earliest + "-01");
    const endDate = parseISO(today + "-01");
    while (cur <= endDate) {
      result.push(format(cur, "yyyy-MM"));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return result;
  }, [activeSales]);

  const getPeriodStats = (from: string, to: string) => {
    const rows = activeSales.filter((m) => {
      if (!m.data_venda) return false;
      if (from && m.data_venda < from) return false;
      if (to && m.data_venda > to) return false;
      return true;
    });
    const count = rows.length;
    const valorTotal = rows.reduce((s, m) => s + (m.valor_total ?? 0), 0);
    const paid = rows.filter((m) => (m.valor_total ?? 0) > 0);
    const ticketMedio = paid.length > 0 ? valorTotal / paid.length : 0;
    const cursosMap = new Map<string, number>();
    const vendsMap = new Map<string, number>();
    for (const m of rows) {
      cursosMap.set(m.curso ?? "?", (cursosMap.get(m.curso ?? "?") ?? 0) + 1);
      const v = m.vendedor ?? "?";
      if (!EXCLUDED_SELLERS.some((ex) => v.toUpperCase().includes(ex))) {
        vendsMap.set(v, (vendsMap.get(v) ?? 0) + 1);
      }
    }
    const topCursos = [...cursosMap.entries()].sort(([, a], [, b]) => b - a).slice(0, 3);
    const topVendedores = [...vendsMap.entries()].sort(([, a], [, b]) => b - a).slice(0, 3);
    return { count, valorTotal, ticketMedio, topCursos, topVendedores };
  };

  const period1Stats = compareFrom1 && compareTo1 ? getPeriodStats(compareFrom1, compareTo1) : null;
  const period2Stats = compareFrom2 && compareTo2 ? getPeriodStats(compareFrom2, compareTo2) : null;

  // ── Current month table data (sortable + searchable) ──────────────────────

  const tableData = useMemo(() => {
    let rows = filteredAll.filter(m => toMonthKey(m.data_venda) === currentMonthKey);

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      rows = rows.filter(m =>
        (m.vendedor ?? "").toLowerCase().includes(q) ||
        (m.cliente ?? "").toLowerCase().includes(q) ||
        (m.curso ?? "").toLowerCase().includes(q)
      );
    }

    rows = [...rows].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      if (tableSortCol === "data_venda") { valA = a.data_venda ?? ""; valB = b.data_venda ?? ""; }
      else if (tableSortCol === "vendedor") { valA = (a.vendedor ?? "").toLowerCase(); valB = (b.vendedor ?? "").toLowerCase(); }
      else if (tableSortCol === "cliente") { valA = (a.cliente ?? "").toLowerCase(); valB = (b.cliente ?? "").toLowerCase(); }
      else if (tableSortCol === "modalidade") { valA = (a.modalidade ?? "").toLowerCase(); valB = (b.modalidade ?? "").toLowerCase(); }
      else if (tableSortCol === "curso") { valA = (a.curso ?? "").toLowerCase(); valB = (b.curso ?? "").toLowerCase(); }
      else if (tableSortCol === "forma_ingresso") { valA = (a.forma_ingresso ?? "").toLowerCase(); valB = (b.forma_ingresso ?? "").toLowerCase(); }
      else if (tableSortCol === "valor_total") { valA = a.valor_total ?? 0; valB = b.valor_total ?? 0; }

      if (valA < valB) return tableSortDir === "asc" ? -1 : 1;
      if (valA > valB) return tableSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [filteredAll, currentMonthKey, tableSearch, tableSortCol, tableSortDir]);

  // Total rows before search filter (for the count display)
  const tableDataTotal = useMemo(
    () => filteredAll.filter(m => toMonthKey(m.data_venda) === currentMonthKey).length,
    [filteredAll, currentMonthKey]
  );

  // ── Render loading ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Derive KPI accent color based on meta progress ─────────────────────────

  const metaAccentColor = effectiveMeta
    ? cmKpis.count >= effectiveMeta.meta
      ? "#16a34a"
      : "#dc2626"
    : "#94a3b8";

  // ── Sortable header helper ─────────────────────────────────────────────────

  const SortableHeader = ({ col, label, align }: { col: string; label: string; align?: "right" }) => (
    <TableHead
      className={`text-xs cursor-pointer select-none text-white/50 hover:text-white transition-colors${align === "right" ? " text-right" : ""}`}
      onClick={() => {
        if (tableSortCol === col) setTableSortDir(d => d === "asc" ? "desc" : "asc");
        else { setTableSortCol(col); setTableSortDir("asc"); }
      }}
    >
      <span className={`flex items-center gap-1${align === "right" ? " justify-end" : ""}`}>
        {label}
        {tableSortCol === col
          ? tableSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          : <span className="h-3 w-3 opacity-20">↕</span>}
      </span>
    </TableHead>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 sm:space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="rounded-xl p-3 sm:p-4 space-y-2" style={{ background: "#0D2B5E" }}>
        {/* Row 1: brand + month selectors + actions */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Brand */}
          <span className="text-white font-bold text-sm sm:text-base tracking-wider shrink-0">FACUNICAMPS</span>

          {/* Month selectors — only in mes-atual */}
          {activeView === "mes-atual" && dataMonthKeys.length > 0 && (() => {
            const MONTHS_PT = [
              { v: "01", l: "Jan" }, { v: "02", l: "Fev" }, { v: "03", l: "Mar" },
              { v: "04", l: "Abr" }, { v: "05", l: "Mai" }, { v: "06", l: "Jun" },
              { v: "07", l: "Jul" }, { v: "08", l: "Ago" }, { v: "09", l: "Set" },
              { v: "10", l: "Out" }, { v: "11", l: "Nov" }, { v: "12", l: "Dez" },
            ];
            const availYears = [...new Set(dataMonthKeys.map(k => k.slice(0, 4)))].sort().reverse();
            const selYear = currentMonthKey.slice(0, 4);
            const selMon = currentMonthKey.slice(5, 7);
            const setYM = (y: string, m: string) => setSelectedMonthKey(`${y}-${m}`);
            return (
              <div className="flex items-center gap-1 shrink-0">
                <Select value={selMon} onValueChange={(m) => setYM(selYear, m)}>
                  <SelectTrigger className="h-7 text-xs w-[56px] bg-white/10 border-white/20 text-white hover:bg-white/20 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_PT.map(({ v, l }) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selYear} onValueChange={(y) => setYM(y, selMon)}>
                  <SelectTrigger className="h-7 text-xs w-[58px] bg-white/10 border-white/20 text-white hover:bg-white/20 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availYears.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <a
              href="https://docs.google.com/spreadsheets/d/1ber4uoSTITnMwFWrRLUJ9o_22Z0dnXN3sUKl1dLmpP0/edit?gid=1586475744#gid=1586475744"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Abrir Planilha"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`p-1 sm:p-2 rounded-lg transition-colors ${showFilters ? "bg-white text-[#0D2B5E]" : "text-white/70 hover:text-white hover:bg-white/10"}`}
              title="Filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1 sm:p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Sincronizar"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowMetasConfig(true)}
              className="p-1 sm:p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Configurar Metas"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Row 2: tabs — full width */}
        <div className="flex gap-1 bg-white/10 rounded-full p-1 w-full">
          {(["mes-atual", "historico", "comparar"] as ActiveView[]).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`flex-1 text-xs px-2 py-1.5 rounded-full font-medium transition-all text-center whitespace-nowrap ${
                activeView === v ? "bg-white text-[#0D2B5E]" : "text-white/70 hover:text-white"
              }`}
            >
              {v === "mes-atual" ? "Mês Atual" : v === "historico" ? "Histórico" : "Comparar"}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Modalidade</p>
              <MultiSearchableSelect
                values={filterModalidade}
                onValuesChange={setFilterModalidade}
                placeholder="Todas"
                emptyLabel="Todas"
                options={uniqueModalidades.map((m) => ({ label: m, value: m }))}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Vendedor Ativo</p>
              <MultiSearchableSelect
                values={filterVendedorAtivo}
                onValuesChange={setFilterVendedorAtivo}
                placeholder="Todos"
                emptyLabel="Todos"
                options={uniqueVendedores.map((v) => ({ label: v, value: v }))}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Forma de Ingresso</p>
              <MultiSearchableSelect
                values={filterFormaIngresso}
                onValuesChange={setFilterFormaIngresso}
                placeholder="Todas"
                emptyLabel="Todas"
                options={uniqueFormasIngresso.map((f) => ({ label: f, value: f }))}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Excluir Vendedor</p>
              <MultiSearchableSelect
                values={filterVendedorDesligado}
                onValuesChange={setFilterVendedorDesligado}
                placeholder="Nenhum"
                emptyLabel="Nenhum"
                options={uniqueVendedores.map((v) => ({ label: v, value: v }))}
              />
            </div>
          </div>
          {/* Date range filter */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground mb-1">De (data)</p>
              <Input
                type="date"
                className="h-8 text-xs"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Até (data)</p>
              <Input
                type="date"
                className="h-8 text-xs"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>
          {/* Show cancelled toggle */}
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <button
              onClick={() => setShowCancelled(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showCancelled ? "bg-amber-500" : "bg-muted"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showCancelled ? "translate-x-4" : "translate-x-1"}`} />
            </button>
            <span className="text-xs text-muted-foreground">Incluir Cancelados{showCancelled ? " (ativo)" : ""}</span>
          </div>
          <div className="flex justify-between items-center">
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
              setFilterModalidade([]);
              setFilterVendedorAtivo([]);
              setFilterFormaIngresso([]);
              setFilterVendedorDesligado([]);
              setFilterDateFrom("");
              setFilterDateTo("");
              setShowCancelled(false);
            }}>
              Limpar todos
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowFilters(false)}>
              Aplicar / Fechar
            </Button>
          </div>
        </div>
      )}

      {/* Active filters badges */}
      {(filterModalidade.length > 0 || filterVendedorAtivo.length > 0 || filterFormaIngresso.length > 0 || filterVendedorDesligado.length > 0 || filterDateFrom || filterDateTo || showCancelled) && (
        <div className="flex flex-wrap gap-2">
          {filterModalidade.map((v) => (
            <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => setFilterModalidade(filterModalidade.filter(x => x !== v))}>
              Modalidade: {v} ×
            </Badge>
          ))}
          {filterVendedorAtivo.map((v) => (
            <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => setFilterVendedorAtivo(filterVendedorAtivo.filter(x => x !== v))}>
              Vendedor: {v} ×
            </Badge>
          ))}
          {filterFormaIngresso.map((v) => (
            <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => setFilterFormaIngresso(filterFormaIngresso.filter(x => x !== v))}>
              Forma: {v} ×
            </Badge>
          ))}
          {filterVendedorDesligado.map((v) => (
            <Badge key={v} variant="destructive" className="cursor-pointer" onClick={() => setFilterVendedorDesligado(filterVendedorDesligado.filter(x => x !== v))}>
              Excluindo: {v} ×
            </Badge>
          ))}
          {filterDateFrom && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setFilterDateFrom("")}>
              De: {format(parseISO(filterDateFrom), "dd/MM/yyyy")} ×
            </Badge>
          )}
          {filterDateTo && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setFilterDateTo("")}>
              Até: {format(parseISO(filterDateTo), "dd/MM/yyyy")} ×
            </Badge>
          )}
          {showCancelled && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 cursor-pointer" onClick={() => setShowCancelled(false)}>
              + Cancelados ×
            </Badge>
          )}
        </div>
      )}

      {/* ── MÊS ATUAL VIEW ────────────────────────────────────────────────────── */}
      {activeView === "mes-atual" && (
        <div className="space-y-6">
          {currentMonthSales.length === 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 text-sm">Sem dados para {monthLabel(currentMonthKey)}.</span>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-xs text-amber-300 underline hover:no-underline"
              >
                {syncing ? "Sincronizando..." : "Clique aqui para sincronizar"}
              </button>
            </div>
          )}
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <KpiCard
              title="Valor Matrícula"
              value={fmtBRL(cmKpis.valorMatricula)}
              sub={`Ticket Médio: ${fmtBRL(cmKpis.ticketMat)}`}
              accentColor="#3b82f6"
              icon={DollarSign}
            />
            <KpiCard
              title="Qtde. Vendas"
              value={String(cmKpis.count)}
              sub={effectiveMeta ? `Restante: ${cmKpis.remaining}` : "Restante: --"}
              accentColor={metaAccentColor}
              icon={TrendingUp}
            />
            <KpiCard
              title="Valor Total"
              value={fmtBRL(cmKpis.valorTotal)}
              sub={`Ticket Médio: ${fmtBRL(cmKpis.ticketTotal)}`}
              accentColor="#8b5cf6"
              icon={BarChart3}
            />
            <KpiCard
              title="Meta Qtde. Vendas"
              value={effectiveMeta ? String(effectiveMeta.meta) : "--"}
              sub={effectiveMeta ? `Diária sugerida: ${cmKpis.diaria}` : "Diária: --"}
              accentColor={metaAccentColor}
              icon={Target}
            />
          </div>

          {/* Daily targets & averages */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <KpiCard
              title="Meta Diária — Vendas"
              value={dailyMetrics.metaDiariaVendas !== null ? dailyMetrics.metaDiariaVendas.toFixed(1) : "--"}
              sub={`${dailyMetrics.totalWorkdays} dias úteis no mês`}
              accentColor="#f97316"
              icon={CalendarDays}
            />
            <KpiCard
              title="Meta Diária — Faturamento"
              value={dailyMetrics.metaDiariaFaturamento !== null ? fmtBRL(dailyMetrics.metaDiariaFaturamento) : "--"}
              sub="Baseado na meta de faturamento"
              accentColor="#f97316"
              icon={Wallet}
            />
            <KpiCard
              title="Média Vendas Diárias (real)"
              value={dailyMetrics.mediaVendasDiarias.toFixed(1)}
              sub={`Últimos ${dailyMetrics.elapsedWorkdays} dias úteis`}
              accentColor={dailyMetrics.metaDiariaVendas !== null && dailyMetrics.mediaVendasDiarias >= dailyMetrics.metaDiariaVendas ? "#16a34a" : "#94a3b8"}
              icon={Activity}
            />
            <KpiCard
              title="Média Faturamento Diário (real)"
              value={fmtBRL(dailyMetrics.mediaFaturamentoDiario)}
              sub={`Últimos ${dailyMetrics.elapsedWorkdays} dias úteis`}
              accentColor={dailyMetrics.metaDiariaFaturamento !== null && dailyMetrics.mediaFaturamentoDiario >= dailyMetrics.metaDiariaFaturamento ? "#16a34a" : "#94a3b8"}
              icon={PieChart}
            />
          </div>

          {/* Sales per day area chart */}
          <DarkChartCard title="Vendas no período" accentColor="#10b981">
            {salesPerDay.length === 0 ? (
              <p className="text-white/40 text-sm">Sem vendas no período selecionado</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesPerDay} margin={{ left: 0, right: 16, top: 24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vendasGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="90%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <filter id="vendasGlow">
                      <feGaussianBlur stdDeviation="3" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#vendasGrad)"
                    dot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#0f172a" }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: "#0f172a", fill: "#10b981" }}
                    filter="url(#vendasGlow)"
                    name="Vendas"
                  >
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "rgba(255,255,255,0.8)", fontWeight: 700 }} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </DarkChartCard>

          {/* Vendas vs Metas — progress bars */}
          <DarkChartCard title="Vendas VS Metas" accentColor="#22c55e">
            {!effectiveMeta ? (
              <p className="text-white/40 text-sm">Configure as metas para visualizar</p>
            ) : (
              <div className="space-y-4">
                <MetaProgressBar label={`Meta (${effectiveMeta.meta})`} current={cmKpis.count} target={effectiveMeta.meta} color="#22c55e" />
                {effectiveMeta.super > 0 && (
                  <MetaProgressBar label={`Super (${effectiveMeta.super})`} current={cmKpis.count} target={effectiveMeta.super} color="#f97316" dashed />
                )}
                {effectiveMeta.hiper > 0 && (
                  <MetaProgressBar label={`Hiper (${effectiveMeta.hiper})`} current={cmKpis.count} target={effectiveMeta.hiper} color="#a855f7" dashed />
                )}
                <div className="pt-3 border-t border-white/10">
                  <div className="flex gap-4 text-xs text-white/50 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      Qtde. atual: <span className="font-bold text-white">{cmKpis.count}</span>
                    </span>
                    {cmKpis.diaria > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                        Necessário/dia: <span className="font-bold text-white">{cmKpis.diaria}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DarkChartCard>

          {/* Rankings */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">Rankings</span>
              <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
                {[10, 15, 16, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => setRankingLimit(n)}
                    className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                      rankingLimit === n
                        ? "bg-green-500 text-white"
                        : "text-white/50 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RankingBarChart title={`Ranking Vendedores — Top ${rankingLimit} (mês)`} data={cmVendedoresRanking} limit={rankingLimit} />
              <RankingBarChart title={`Ranking Cursos — Top ${rankingLimit} (mês)`} data={cmCursosRanking} limit={rankingLimit} />
            </div>
          </div>

          {/* Data table */}
          <div className="relative overflow-hidden rounded-2xl shadow-2xl" style={{ background: DARK_BG, border: DARK_BORDER }}>
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[50px] pointer-events-none" style={{ backgroundColor: "#6366f1", opacity: 0.12 }} />
            {/* Sticky title + search — always visible above scroll */}
            <div className="relative z-20 px-5 pt-4 pb-2" style={{ background: DARK_BG }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-400/30" />
                <h3 className="text-sm font-bold text-white">Matrículas no mês</h3>
              </div>
              {/* Search input */}
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <Input
                  className="pl-8 h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  placeholder="Buscar por vendedor, cliente ou curso..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
              <p className="text-xs text-white/40 mt-1.5">
                Exibindo {tableData.length} de {tableDataTotal} matrículas
              </p>
            </div>
            <div className="relative z-10 overflow-x-auto" style={{ maxHeight: 380, overflowY: "auto" }}>
              {tableData.length === 0 ? (
                <p className="text-white/40 text-sm p-4">Sem registros no período selecionado</p>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10" style={{ background: "#0f172a" }}>
                    <TableRow>
                      <SortableHeader col="data_venda" label="Data" />
                      <SortableHeader col="vendedor" label="Vendedor(a)" />
                      <SortableHeader col="cliente" label="Cliente" />
                      <SortableHeader col="modalidade" label="Modalidade" />
                      <SortableHeader col="curso" label="Curso" />
                      <SortableHeader col="forma_ingresso" label="Forma" />
                      <SortableHeader col="valor_matricula" label="Vl. Matrícula" align="right" />
                      <SortableHeader col="valor_total" label="Vl. Total" align="right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row, i) => (
                      <TableRow key={row.id ?? i} className={`hover:bg-white/5 transition-colors${isCancelled(row) ? " opacity-50" : ""}`}>
                        <TableCell className="text-xs text-white/80">
                          {row.data_venda ? format(parseISO(row.data_venda), "dd/MM/yyyy") : "--"}
                        </TableCell>
                        <TableCell className="text-xs text-white/80">{row.vendedor ?? "--"}</TableCell>
                        <TableCell className="text-xs text-white/80">{row.cliente ?? "--"}</TableCell>
                        <TableCell className="text-xs text-white/80">
                          <ModalidadeBadge modalidade={row.modalidade} />
                        </TableCell>
                        <TableCell className="text-xs text-white/80 max-w-[180px] truncate">{row.curso ?? "--"}</TableCell>
                        <TableCell className="text-xs text-white/80">
                          {isCancelled(row) ? (
                            <Badge variant="destructive" className="text-xs">{row.forma_ingresso}</Badge>
                          ) : (
                            row.forma_ingresso ?? "--"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-white/80 text-right">{fmtBRL(row.valor_matricula ?? 0)}</TableCell>
                        <TableCell className="text-xs text-white/80 text-right">{fmtBRL(row.valor_total ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {/* Sticky totals footer */}
                  <tfoot className="sticky bottom-0 z-10" style={{ background: "#0f172a" }}>
                    <tr style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                      <td colSpan={6} className="px-4 py-2 text-xs font-bold text-white/70">
                        Total ({tableData.length} registros)
                      </td>
                      <td className="px-4 py-2 text-xs font-bold text-right text-indigo-300">
                        {fmtBRL(tableData.reduce((s, r) => s + (r.valor_matricula ?? 0), 0))}
                      </td>
                      <td className="px-4 py-2 text-xs font-bold text-right text-emerald-300">
                        {fmtBRL(tableData.reduce((s, r) => s + (r.valor_total ?? 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTÓRICO VIEW ─────────────────────────────────────────────────────── */}
      {activeView === "historico" && (
        <div className="space-y-6">
          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
            <span className="text-xs text-white/50 font-medium shrink-0">Período:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/40">De</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="h-7 text-xs rounded-lg px-2 bg-white/10 border border-white/15 text-white [color-scheme:dark]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/40">Até</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="h-7 text-xs rounded-lg px-2 bg-white/10 border border-white/15 text-white [color-scheme:dark]"
                />
              </div>
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                  className="text-xs text-white/40 hover:text-white/80 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <KpiCard title="Valor Matrícula Total" value={fmtBRL(histKpis.valorMatricula)} accentColor="#3b82f6" icon={DollarSign} />
            <KpiCard title="Qtde. Vendas Total" value={String(histKpis.count)} accentColor="#16a34a" icon={TrendingUp} />
            <KpiCard title="Valor Total Histórico" value={fmtBRL(histKpis.valorTotal)} accentColor="#8b5cf6" icon={BarChart3} />
            <KpiCard title="Meta Total Configurada" value={histKpis.totalMeta > 0 ? String(histKpis.totalMeta) : "--"} accentColor="#f97316" icon={Target} />
          </div>

          {/* Valor Total Mensal BarChart with % change labels */}
          <DarkChartCard title="Valor Total no período (mensal)" accentColor="#3b82f6">
            {monthlyDataWithPct.length === 0 ? (
              <p className="text-white/40 text-sm">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyDataWithPct} margin={{ left: 8, right: 16, top: 36, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v) => `R$${Math.round(v/1000)}k`} width={60} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const cur = payload[0].value as number;
                      const item = monthlyDataWithPct.find((d) => d.label === label);
                      const pct = item?.pct ?? null;
                      return (
                        <div className="rounded-2xl shadow-2xl p-3 border border-white/10" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))" }}>
                          <p className="text-[11px] font-bold text-white/50 mb-1 uppercase tracking-widest">{label}</p>
                          <p className="text-sm font-bold text-white">{fmtBRL(cur)}</p>
                          {pct !== null && (
                            <p className={`text-xs font-semibold ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      );
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar
                    dataKey="valorTotal"
                    name="Valor Total"
                    radius={[4, 4, 0, 0]}
                    shape={(props: Record<string, unknown>) => (
                      <ThreeDBar {...props} frontColor={C3D.blue.front} topColor={C3D.blue.top} sideColor={C3D.blue.side} />
                    )}
                  >
                    <LabelList
                      content={(props) => {
                        const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
                        const item = monthlyDataWithPct[index];
                        if (!item) return null;
                        const pct = item.pct;
                        const pctLabel = pct !== null ? (pct >= 0 ? `+${pct.toFixed(0)}%▲` : `${pct.toFixed(0)}%▼`) : null;
                        const pctColor = pct !== null ? (pct >= 0 ? "#4ade80" : "#f87171") : "rgba(255,255,255,0.4)";
                        return (
                          <g>
                            <text x={x + (width as number) / 2} y={(y as number) - 18} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">
                              {value > 0 ? `R$${Math.round(value/1000)}k` : ""}
                            </text>
                            {pctLabel && (
                              <text x={x + (width as number) / 2} y={(y as number) - 6} textAnchor="middle" fontSize={9} fill={pctColor} fontWeight={700}>
                                {pctLabel}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </DarkChartCard>

          {/* Vendas vs Meta LineChart */}
          <DarkChartCard title="Vendas vs Meta (histórico)" accentColor="#22c55e">
            {vendasVsMetaData.length === 0 ? (
              <p className="text-white/40 text-sm">Sem dados</p>
            ) : (
              <>
                <div className="flex gap-3 text-xs mb-4 flex-wrap">
                  {[["#22c55e","Vendas"],["#f87171","Meta"],["#fb923c","Super"],["#c084fc","Hiper"]].map(([color, lbl]) => (
                    <span key={lbl} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.06]" style={{ background: `${color}12` }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-white/60 font-medium">{lbl}</span>
                    </span>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={vendasVsMetaData} margin={{ left: 0, right: 16, top: 12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="vendas" stroke="#22c55e" strokeWidth={3} dot={{ r: 5, fill: "#22c55e", stroke: "#0f172a", strokeWidth: 2 }} activeDot={{ r: 7 }} name="Vendas">
                      <LabelList dataKey="vendas" position="top" style={{ fontSize: 10, fill: "rgba(255,255,255,0.7)", fontWeight: 700 }} />
                    </Line>
                    <Line type="monotone" dataKey="meta" stroke="#f87171" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: "#f87171" }} name="Meta" connectNulls />
                    <Line type="monotone" dataKey="super" stroke="#fb923c" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: "#fb923c" }} name="Super" connectNulls />
                    <Line type="monotone" dataKey="hiper" stroke="#c084fc" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: "#c084fc" }} name="Hiper" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </DarkChartCard>

          {/* Visão de Curto, Médio e Longo Prazo — TermVisionCard */}
          {Object.keys(monthlyRevenueMap).length > 0 && (
            <FacunicampsTermVisionCard monthlyRevenue={monthlyRevenueMap} titleSuffix="Faturamento" />
          )}

          {/* Rankings */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">Rankings</span>
              <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
                {[10, 15, 16, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => setRankingLimit(n)}
                    className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                      rankingLimit === n
                        ? "bg-green-500 text-white"
                        : "text-white/50 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RankingBarChart title={`Ranking Vendedores — Top ${rankingLimit}`} data={histVendedoresRanking} limit={rankingLimit} />
              <RankingBarChart title={`Ranking Cursos — Top ${rankingLimit}`} data={histCursosRanking} limit={rankingLimit} />
            </div>
          </div>

          {/* Funil de Vendas */}
          <DarkChartCard title="Funil de Vendas" accentColor="#3b82f6">
            {totalAtendimentos === 0 ? (
              <p className="text-white/40 text-sm">Configure Atendimentos nas Metas para visualizar o funil</p>
            ) : (
              <div className="space-y-3 max-w-md">
                <div>
                  <div className="flex justify-between text-xs text-white/50 mb-2">
                    <span>Atendimentos</span>
                    <span className="font-bold text-white">{totalAtendimentos}</span>
                  </div>
                  <div className="h-10 rounded-xl flex items-center px-4" style={{ background: "linear-gradient(90deg, #3b82f6, #60a5fa)", boxShadow: "0 0 20px rgba(59,130,246,0.4)" }}>
                    <span className="text-white text-xs font-bold">100%</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-white/50 mb-2">
                    <span>Vendas</span>
                    <span className="font-bold text-white">{totalVendas}</span>
                  </div>
                  <div
                    className="h-10 rounded-xl flex items-center px-4"
                    style={{ width: `${Math.min(100, (totalVendas / totalAtendimentos) * 100)}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)", boxShadow: "0 0 20px rgba(34,197,94,0.4)" }}
                  >
                    <span className="text-white text-xs font-bold">{conversionRate}%</span>
                  </div>
                </div>
              </div>
            )}
          </DarkChartCard>

          {/* Projeção Vendedores */}
          <DarkChartCard title="Projeção Vendedores Ativos" accentColor="#a855f7">
            <p className="text-xs text-white/40 mb-3">
              Total de vendedores únicos: <span className="font-bold text-white">{histVendedoresRanking.length}</span>
            </p>
            <ResponsiveContainer width="100%" height={Math.max(200, Math.min(15, histVendedoresRanking.length) * 36)}>
              <BarChart
                data={[...histVendedoresRanking].sort((a, b) => b.value - a.value).slice(0, 15).map((d) => ({ ...d, name: truncateName(d.name) }))}
                layout="vertical"
                margin={{ left: 8, right: 52, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_COLOR} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={95} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar
                  dataKey="value"
                  name="Vendas"
                  radius={[0, 4, 4, 0]}
                  shape={(props: Record<string, unknown>) => (
                    <ThreeDBar {...props} frontColor={C3D.purple.front} topColor={C3D.purple.top} sideColor={C3D.purple.side} />
                  )}
                >
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "rgba(255,255,255,0.8)", fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DarkChartCard>
        </div>
      )}

      {/* ── COMPARAR PERÍODOS VIEW ─────────────────────────────────────────────── */}
      {activeView === "comparar" && (
        <div className="space-y-4">
          {/* Period selectors */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Período 1 */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 sm:p-4 space-y-2">
              <p className="text-[10px] sm:text-xs font-bold text-blue-400 uppercase tracking-widest">Período 1</p>
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] text-white/50 mb-1">De</p>
                  <input
                    type="date"
                    className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    style={{ colorScheme: "dark", minHeight: 34 }}
                    value={compareFrom1}
                    onChange={(e) => setCompareFrom1(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-white/50 mb-1">Até</p>
                  <input
                    type="date"
                    className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    style={{ colorScheme: "dark", minHeight: 34 }}
                    value={compareTo1}
                    onChange={(e) => setCompareTo1(e.target.value)}
                  />
                </div>
              </div>
              {compareFrom1 && compareTo1 && (
                <p className="text-[10px] text-blue-300/70 leading-tight">
                  {format(parseISO(compareFrom1), "dd/MM/yy")} → {format(parseISO(compareTo1), "dd/MM/yy")}
                </p>
              )}
            </div>

            {/* Período 2 */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 sm:p-4 space-y-2">
              <p className="text-[10px] sm:text-xs font-bold text-purple-400 uppercase tracking-widest">Período 2</p>
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] text-white/50 mb-1">De</p>
                  <input
                    type="date"
                    className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                    style={{ colorScheme: "dark", minHeight: 34 }}
                    value={compareFrom2}
                    onChange={(e) => setCompareFrom2(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-white/50 mb-1">Até</p>
                  <input
                    type="date"
                    className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                    style={{ colorScheme: "dark", minHeight: 34 }}
                    value={compareTo2}
                    onChange={(e) => setCompareTo2(e.target.value)}
                  />
                </div>
              </div>
              {compareFrom2 && compareTo2 && (
                <p className="text-[10px] text-purple-300/70 leading-tight">
                  {format(parseISO(compareFrom2), "dd/MM/yy")} → {format(parseISO(compareTo2), "dd/MM/yy")}
                </p>
              )}
            </div>
          </div>

          {period1Stats && period2Stats ? (() => {
            // ── Insights engine ──────────────────────────────────────────────
            const attention: string[] = [];
            const improvement: string[] = [];
            const pct = (a: number, b: number) => b > 0 ? ((a - b) / b * 100) : 0;
            const sign = (n: number) => n >= 0 ? "+" : "";

            // Sales volume
            const countDiff = period2Stats.count - period1Stats.count;
            const countPct = pct(period2Stats.count, period1Stats.count);
            if (countDiff > 0) improvement.push(`Matrículas cresceram ${countPct.toFixed(1)}% (${sign(countDiff)}${countDiff} em relação ao Período 1)`);
            else if (countDiff < 0) attention.push(`Matrículas caíram ${Math.abs(countPct).toFixed(1)}% (${countDiff} em relação ao Período 1) — revisar ações comerciais`);

            // Revenue
            const revDiff = period2Stats.valorTotal - period1Stats.valorTotal;
            const revPct = pct(period2Stats.valorTotal, period1Stats.valorTotal);
            if (revDiff > 0) improvement.push(`Faturamento cresceu ${revPct.toFixed(1)}% (${sign(revDiff)}${fmtBRL(revDiff)})`);
            else if (revDiff < 0) attention.push(`Faturamento caiu ${Math.abs(revPct).toFixed(1)}% (${fmtBRL(revDiff)}) — acompanhar conversão e ticket`);

            // Ticket médio
            const tickDiff = period2Stats.ticketMedio - period1Stats.ticketMedio;
            const tickPct = pct(period2Stats.ticketMedio, period1Stats.ticketMedio);
            if (tickDiff > 2) improvement.push(`Ticket médio subiu ${tickPct.toFixed(1)}% → ${fmtBRL(period2Stats.ticketMedio)}`);
            else if (tickDiff < -2) attention.push(`Ticket médio caiu ${Math.abs(tickPct).toFixed(1)}% → ${fmtBRL(period2Stats.ticketMedio)} — verificar mix de cursos e descontos`);

            // Courses
            const p1Courses = period1Stats.topCursos.map(([n]) => n);
            const p2Courses = period2Stats.topCursos.map(([n]) => n);
            p2Courses.filter(c => !p1Courses.includes(c)).forEach(c =>
              improvement.push(`"${c}" entrou no top 3 de cursos — demanda em crescimento`)
            );
            p1Courses.filter(c => !p2Courses.includes(c)).forEach(c =>
              attention.push(`"${c}" saiu do top 3 de cursos — monitorar queda de interesse`)
            );

            // Course volume drop for courses still in top
            period2Stats.topCursos.forEach(([name, cnt2]) => {
              const cnt1 = period1Stats.topCursos.find(([n]) => n === name)?.[1];
              if (cnt1 && cnt2 < cnt1 * 0.8) attention.push(`"${name}" caiu ${(((cnt1 - cnt2) / cnt1) * 100).toFixed(0)}% em matrículas (${cnt1} → ${cnt2})`);
              if (cnt1 && cnt2 > cnt1 * 1.3) improvement.push(`"${name}" cresceu ${(((cnt2 - cnt1) / cnt1) * 100).toFixed(0)}% em matrículas (${cnt1} → ${cnt2})`);
            });

            // Sellers
            const p1Sellers = period1Stats.topVendedores.map(([n]) => n);
            const p2Sellers = period2Stats.topVendedores.map(([n]) => n);
            p2Sellers.filter(s => !p1Sellers.includes(s)).forEach(s =>
              improvement.push(`${s} entrou no top 3 — performance em alta`)
            );
            p1Sellers.filter(s => !p2Sellers.includes(s)).forEach(s =>
              attention.push(`${s} saiu do top 3 — acompanhar ritmo de vendas`)
            );

            // Top seller highlight
            if (period2Stats.topVendedores.length > 0) {
              const [topName, topCnt] = period2Stats.topVendedores[0];
              const prev = period1Stats.topVendedores.find(([n]) => n === topName)?.[1] ?? 0;
              if (topCnt > prev + 3) improvement.push(`${topName} foi o destaque do Período 2: ${topCnt} matrículas (${sign(topCnt - prev)}${topCnt - prev} vs Período 1)`);
            }

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Period 1 card */}
                  <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(145deg, #0f172a, #1e3a5f)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <div className="px-3 sm:px-5 py-3 border-b border-blue-500/20">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">Período 1</p>
                      <p className="text-sm font-semibold text-white">{compareFrom1 && compareTo1 ? `${format(parseISO(compareFrom1), "dd/MM/yy")} → ${format(parseISO(compareTo1), "dd/MM/yy")}` : "—"}</p>
                    </div>
                    <div className="px-3 sm:px-5 py-3 space-y-3">
                      <CompareMetric label="Qtde. Vendas" value={period1Stats.count} other={period2Stats.count} />
                      <CompareMetric label="Valor Total" value={period1Stats.valorTotal} other={period2Stats.valorTotal} isCurrency />
                      <CompareMetric label="Ticket Médio" value={period1Stats.ticketMedio} other={period2Stats.ticketMedio} isCurrency />
                      <div className="pt-1 space-y-1.5">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Top 3 Cursos</p>
                        {period1Stats.topCursos.map(([name, cnt]) => (
                          <div key={name} className="flex justify-between items-center text-xs py-0.5">
                            <span className="truncate max-w-[120px] sm:max-w-[160px] text-white/70">{name}</span>
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs shrink-0">{cnt}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Top 3 Vendedores</p>
                        {period1Stats.topVendedores.map(([name, cnt]) => (
                          <div key={name} className="flex justify-between items-center text-xs py-0.5">
                            <span className="truncate max-w-[120px] sm:max-w-[160px] text-white/70">{name}</span>
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs shrink-0">{cnt}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Period 2 card */}
                  <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(145deg, #0f172a, #2d1b5e)", border: "1px solid rgba(168,85,247,0.2)" }}>
                    <div className="px-3 sm:px-5 py-3 border-b border-purple-500/20">
                      <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-0.5">Período 2</p>
                      <p className="text-sm font-semibold text-white">{compareFrom2 && compareTo2 ? `${format(parseISO(compareFrom2), "dd/MM/yy")} → ${format(parseISO(compareTo2), "dd/MM/yy")}` : "—"}</p>
                    </div>
                    <div className="px-3 sm:px-5 py-3 space-y-3">
                      <CompareMetric label="Qtde. Vendas" value={period2Stats.count} other={period1Stats.count} />
                      <CompareMetric label="Valor Total" value={period2Stats.valorTotal} other={period1Stats.valorTotal} isCurrency />
                      <CompareMetric label="Ticket Médio" value={period2Stats.ticketMedio} other={period1Stats.ticketMedio} isCurrency />
                      <div className="pt-1 space-y-1.5">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Top 3 Cursos</p>
                        {period2Stats.topCursos.map(([name, cnt]) => (
                          <div key={name} className="flex justify-between items-center text-xs py-0.5">
                            <span className="truncate max-w-[120px] sm:max-w-[160px] text-white/70">{name}</span>
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs shrink-0">{cnt}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Top 3 Vendedores</p>
                        {period2Stats.topVendedores.map(([name, cnt]) => (
                          <div key={name} className="flex justify-between items-center text-xs py-0.5">
                            <span className="truncate max-w-[120px] sm:max-w-[160px] text-white/70">{name}</span>
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs shrink-0">{cnt}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Insights ── */}
                {(attention.length > 0 || improvement.length > 0) && (
                  <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(145deg, #0f172a, #111827)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-400/20" />
                      <p className="text-xs font-bold text-white uppercase tracking-widest">Insights da Comparação</p>
                    </div>
                    <div className="p-4 space-y-4">
                      {attention.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-0.5 w-3 rounded-full bg-red-500" />
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Pontos de Atenção</p>
                          </div>
                          {attention.map((msg, i) => (
                            <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                              <span className="text-red-400 text-sm leading-none mt-0.5 shrink-0">⚠</span>
                              <p className="text-xs text-white/80 leading-relaxed">{msg}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {improvement.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-0.5 w-3 rounded-full bg-emerald-500" />
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Pontos de Melhoria</p>
                          </div>
                          {improvement.map((msg, i) => (
                            <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                              <span className="text-emerald-400 text-sm leading-none mt-0.5 shrink-0">↑</span>
                              <p className="text-xs text-white/80 leading-relaxed">{msg}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
              <p className="text-white/40 text-sm">Defina o intervalo de datas dos dois períodos para comparar</p>
              <p className="text-white/20 text-xs mt-1">Ex: Período 1 = 01/03/2026 → 31/03/2026 · Período 2 = 01/04/2026 → 30/04/2026</p>
            </div>
          )}
        </div>
      )}

      {/* Metas Config Modal */}
      <MetasConfigModal
        open={showMetasConfig}
        onClose={() => setShowMetasConfig(false)}
        metas={metas}
        metasVendedor={metasVendedor}
        vendedores={uniqueVendedores}
        availableMonths={availableMonths}
        onSaved={fetchData}
      />
    </div>
  );
}

// ─── Compare Metric Helper ────────────────────────────────────────────────────

function CompareMetric({
  label,
  value,
  other,
  isCurrency = false,
}: {
  label: string;
  value: number;
  other: number;
  isCurrency?: boolean;
}) {
  const better = value > other;
  const equal = value === other;
  const diff = other > 0 ? ((value - other) / other) * 100 : 0;
  const display = isCurrency ? fmtBRL(value) : String(value);

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-foreground">{display}</span>
        {!equal && (
          <span className={`text-xs flex items-center ${better ? "text-green-600" : "text-red-500"}`}>
            {better ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(diff).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
