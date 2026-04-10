import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays, subMonths,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodType = "today" | "this_week" | "this_month" | "this_year" | "last_30_days" | "last_12_months" | "all";

const NAVIGABLE_PERIODS: PeriodType[] = ["today", "this_week", "this_month", "this_year"];

interface PeriodNavigatorProps {
  period: PeriodType;
  offset: number;
  onPeriodChange: (period: PeriodType) => void;
  onOffsetChange: (offset: number) => void;
  className?: string;
}

export function getDateRangeForPeriod(period: PeriodType, offset: number): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();

  switch (period) {
    case "today": {
      const d = addDays(now, offset);
      const label = format(d, "dd/MM/yyyy");
      return { start: startOfDay(d), end: endOfDay(d), label };
    }
    case "this_week": {
      const base = addWeeks(now, offset);
      const s = startOfWeek(base, { weekStartsOn: 1 });
      const e = endOfWeek(base, { weekStartsOn: 1 });
      const label = offset === 0 ? "Esta semana" : `${format(s, "dd/MM")} - ${format(e, "dd/MM/yy")}`;
      return { start: s, end: e, label };
    }
    case "this_month": {
      const base = addMonths(now, offset);
      const label = offset === 0
        ? "Este mês"
        : format(base, "MMMM yyyy", { locale: ptBR }).replace(/^./, c => c.toUpperCase());
      return { start: startOfMonth(base), end: endOfMonth(base), label };
    }
    case "this_year": {
      const base = addYears(now, offset);
      const label = offset === 0 ? "Este ano" : `${base.getFullYear()}`;
      return { start: startOfYear(base), end: endOfYear(base), label };
    }
    case "last_30_days":
      return { start: subDays(now, 30), end: now, label: "Últimos 30 dias" };
    case "last_12_months":
      return { start: subMonths(now, 12), end: now, label: "Últimos 12 meses" };
    case "all":
      return { start: null, end: null, label: "Todo o período" };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now), label: "Este mês" };
  }
}

export function PeriodNavigator({ period, offset, onPeriodChange, onOffsetChange, className }: PeriodNavigatorProps) {
  const isNavigable = NAVIGABLE_PERIODS.includes(period);
  const { label } = getDateRangeForPeriod(period, offset);

  const handlePeriodChange = (newPeriod: PeriodType) => {
    onOffsetChange(0);
    onPeriodChange(newPeriod);
  };

  return (
    <div className={`flex items-center gap-0.5 ${className || ""}`}>
      {isNavigable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onOffsetChange(offset - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <Select value={period} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
        <SelectTrigger className="w-[200px] h-9">
          <CalendarDays className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate text-sm">{label}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="this_week">Esta semana</SelectItem>
          <SelectItem value="this_month">Este mês</SelectItem>
          <SelectItem value="this_year">Este ano</SelectItem>
          <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
          <SelectItem value="last_12_months">Últimos 12 meses</SelectItem>
          <SelectItem value="all">Todo o período</SelectItem>
        </SelectContent>
      </Select>

      {isNavigable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onOffsetChange(offset + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {isNavigable && offset !== 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-xs text-muted-foreground"
          onClick={() => onOffsetChange(0)}
        >
          Atual
        </Button>
      )}
    </div>
  );
}
