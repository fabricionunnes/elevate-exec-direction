import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TrendingUp, Trophy, Flame, Sparkles, Pencil, Check, X, Star } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import northStarImg from "@/assets/north-star.png";

interface Props {
  companyId: string;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

const formatBRLFromValue = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

export const NorthStarMetricCard = ({ companyId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [targetCents, setTargetCents] = useState<number>(0);
  const [label, setLabel] = useState<string>("");
  const [achievedValue, setAchievedValue] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [companyRes, kpisRes] = await Promise.all([
        supabase
          .from("onboarding_companies")
          .select("north_star_metric_cents, north_star_metric_label")
          .eq("id", companyId)
          .maybeSingle(),
        supabase
          .from("company_kpis")
          .select("id")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .eq("is_main_goal", true)
          .eq("kpi_type", "monetary"),
      ]);

      const target = Number((companyRes.data as any)?.north_star_metric_cents) || 0;
      setTargetCents(target);
      setLabel((companyRes.data as any)?.north_star_metric_label || "");

      const kpiIds = (kpisRes.data || []).map((k: any) => k.id);
      if (kpiIds.length === 0) {
        setAchievedValue(0);
        return;
      }

      const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date()), "yyyy-MM-dd");
      const { data: entries } = await supabase
        .from("kpi_entries")
        .select("value")
        .eq("company_id", companyId)
        .in("kpi_id", kpiIds)
        .gte("entry_date", start)
        .lte("entry_date", end);

      const total = (entries || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
      setAchievedValue(total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const startEdit = () => {
    setEditValue(targetCents / 100);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const newCents = Math.round((editValue || 0) * 100);
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ north_star_metric_cents: newCents } as any)
        .eq("id", companyId);
      if (error) throw error;
      setTargetCents(newCents);
      setEditing(false);
      toast({ title: "Norte Estratégico atualizado", description: "Nova meta salva com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message || "Tente novamente", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const targetValue = targetCents / 100;
  const pct = targetValue > 0 ? Math.min(999, Math.round((achievedValue / targetValue) * 100)) : 0;
  const reached = pct >= 100;
  const close90 = pct >= 90 && pct < 100;
  const close70 = pct >= 70 && pct < 90;
  const remaining = Math.max(0, targetValue - achievedValue);

  const Icon = reached ? Trophy : close90 ? Flame : close70 ? TrendingUp : Star;

  // Paleta VIBRANTE roxa/violeta como cor principal de destaque (diferente dos outros cards)
  const palette = reached
    ? {
        gradient: "from-emerald-500 via-teal-500 to-green-500",
        ring: "ring-emerald-300/70",
        glow: "shadow-[0_0_80px_-10px_hsl(142_76%_45%/0.7)]",
        accent: "text-emerald-100",
        bar: "bg-gradient-to-r from-emerald-300 via-teal-200 to-green-300",
        chip: "bg-white/25 text-white border-white/40",
      }
    : close90
    ? {
        gradient: "from-orange-500 via-amber-500 to-rose-500",
        ring: "ring-amber-300/70",
        glow: "shadow-[0_0_80px_-10px_hsl(38_95%_55%/0.7)]",
        accent: "text-amber-50",
        bar: "bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200",
        chip: "bg-white/25 text-white border-white/40",
      }
    : close70
    ? {
        gradient: "from-blue-600 via-indigo-600 to-cyan-500",
        ring: "ring-sky-300/70",
        glow: "shadow-[0_0_80px_-10px_hsl(217_91%_60%/0.7)]",
        accent: "text-sky-50",
        bar: "bg-gradient-to-r from-sky-200 via-blue-200 to-indigo-200",
        chip: "bg-white/25 text-white border-white/40",
      }
    : {
        // Destaque principal: violeta/fúcsia vibrante
        gradient: "from-violet-600 via-fuchsia-600 to-purple-700",
        ring: "ring-fuchsia-300/70",
        glow: "shadow-[0_0_80px_-10px_hsl(292_84%_61%/0.7)]",
        accent: "text-fuchsia-50",
        bar: "bg-gradient-to-r from-fuchsia-200 via-violet-200 to-purple-200",
        chip: "bg-white/25 text-white border-white/40",
      };

  return (
    <div className="relative">
      {/* Halo / glow externo intenso */}
      <div
        aria-hidden
        className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${palette.gradient} blur-2xl opacity-80 animate-pulse`}
      />
      <Card
        className={`relative overflow-hidden rounded-3xl border-0 ring-2 ${palette.ring} ${palette.glow} bg-gradient-to-br ${palette.gradient}`}
      >
        {/* Brilho decorativo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-black/20 blur-3xl"
        />
        {/* Estrelas decorativas */}
        <Star className="absolute top-4 right-8 h-3 w-3 text-white/40 animate-pulse" />
        <Sparkles className="absolute top-12 right-20 h-4 w-4 text-white/50 animate-pulse" style={{ animationDelay: "0.5s" }} />
        <Star className="absolute bottom-8 right-12 h-2 w-2 text-white/40 animate-pulse" style={{ animationDelay: "1s" }} />

        <CardContent className="relative p-7 md:p-8 space-y-6 text-white">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-amber-300/40 blur-2xl animate-pulse"
                />
                <img
                  src={northStarImg}
                  alt="North Star"
                  width={96}
                  height={96}
                  loading="lazy"
                  className="relative h-20 w-20 md:h-24 md:w-24 drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]"
                />
                {reached && (
                  <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-200 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="uppercase tracking-[0.25em] text-[11px] font-bold text-white/90 drop-shadow inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    North Star Metric
                  </span>
                  <Badge className="bg-white/20 text-white border-white/40 hover:bg-white/30 text-[10px] uppercase tracking-wider backdrop-blur">
                    {format(new Date(), "MMMM yyyy", { locale: ptBR })}
                  </Badge>
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mt-1 drop-shadow-lg">
                  North Star Metric
                </h2>
                {label && <p className="text-sm text-white/80 mt-1 font-medium">{label}</p>}
              </div>
            </div>

            {targetCents > 0 && (
              <div className={`px-5 py-3 rounded-2xl border-2 ${palette.chip} backdrop-blur-md shadow-xl`}>
                <p className="text-[10px] uppercase tracking-wider opacity-90 font-bold">Atingido</p>
                <p className="text-3xl font-black leading-none drop-shadow">{pct}%</p>
              </div>
            )}
          </div>

          {/* Métricas / Edição da Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/15 backdrop-blur-md p-4 ring-1 ring-white/30 shadow-lg">
              <p className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Realizado</p>
              <p className="text-xl md:text-2xl font-black text-white drop-shadow mt-1">
                {formatBRLFromValue(achievedValue)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/20 backdrop-blur-md p-4 ring-2 ring-white/40 shadow-lg relative">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-white/90 font-bold">Meta NSM</p>
                {!editing && (
                  <button
                    onClick={startEdit}
                    className="text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/20"
                    title="Editar meta"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editing ? (
                <div className="flex items-center gap-2 mt-1">
                  <CurrencyInput
                    value={editValue}
                    onChange={setEditValue}
                    className="h-9 bg-white/90 text-foreground border-0 font-bold"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    onClick={saveEdit}
                    disabled={saving}
                    className="h-9 w-9 bg-white text-foreground hover:bg-white/90 shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="h-9 w-9 text-white hover:bg-white/20 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-xl md:text-2xl font-black text-white drop-shadow mt-1">
                  {targetCents > 0 ? formatBRL(targetCents) : "Defina a meta"}
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white/15 backdrop-blur-md p-4 ring-1 ring-white/30 shadow-lg">
              <p className="text-[10px] uppercase tracking-wider text-white/80 font-bold">
                {reached ? "Excedeu" : "Faltam"}
              </p>
              <p className="text-xl md:text-2xl font-black text-white drop-shadow mt-1">
                {targetCents > 0
                  ? formatBRLFromValue(reached ? achievedValue - targetValue : remaining)
                  : "—"}
              </p>
            </div>
          </div>

          {/* Progresso custom */}
          {targetCents > 0 && (
            <div className="space-y-2">
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-black/25 ring-1 ring-white/30 shadow-inner">
                <div
                  className={`h-full ${palette.bar} transition-all duration-700 ease-out shadow-lg`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
                <div className="absolute inset-y-0 left-[70%] w-px bg-white/40" />
                <div className="absolute inset-y-0 left-[90%] w-px bg-white/40" />
              </div>
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-white/80 font-bold">
                <span>0%</span>
                <span>70%</span>
                <span>90%</span>
                <span className="text-white">100%</span>
              </div>
            </div>
          )}

          {reached && (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 backdrop-blur-md ring-2 ring-white/40 py-3 shadow-xl">
              <Trophy className="h-5 w-5 text-amber-200" />
              <p className="text-base font-black text-white drop-shadow">
                🎉 Norte Estratégico atingido neste mês!
              </p>
              <Sparkles className="h-5 w-5 text-amber-200 animate-pulse" />
            </div>
          )}

          {!targetCents && !editing && (
            <p className="text-sm text-white/90 text-center font-medium">
              Defina a meta principal de faturamento mensal clicando no ícone de edição acima ou no formulário de Kickoff.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
