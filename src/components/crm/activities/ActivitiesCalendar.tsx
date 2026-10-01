import { useMemo, useState } from "react";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoToBrasiliaLocal } from "@/lib/crm/activityGoogleSync";

export type CalendarMode = "month" | "week" | "day";

export interface CalendarActivity {
  id: string;
  type: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  lead?: { name: string } | null;
  responsible?: { name: string } | null;
}

interface ActivitiesCalendarProps<T extends CalendarActivity> {
  activities: T[];
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  /** dia de referência (o mês, a semana ou o dia mostrado é o que contém este dia) */
  cursor: Date;
  onCursorChange: (d: Date) => void;
  loading?: boolean;
  colorOf: (type: string) => string;
  labelOf: (type: string) => string;
  onOpen: (activity: T) => void;
  /** clique num dia ou horário vazio: "yyyy-MM-ddTHH:mm" em horário de Brasília */
  onCreate: (localDateTime: string) => void;
  /** arrastou pra outro dia/horário: novo horário em "yyyy-MM-ddTHH:mm" (Brasília) */
  onMove: (activity: T, localDateTime: string) => void;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");
const WEEK_OPTS = { weekStartsOn: 0 as const };
const MODES: { value: CalendarMode; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "week", label: "Semana" },
  { value: "day", label: "Dia" },
];
const DEFAULT_HOUR = "09:00";
const MAX_CHIPS_MONTH = 3;

/** Primeiro e último dia que o calendário mostra pra um modo e um dia de referência. */
export function calendarRange(mode: CalendarMode, cursor: Date): { start: Date; end: Date } {
  if (mode === "day") return { start: cursor, end: cursor };
  if (mode === "week") return { start: startOfWeek(cursor, WEEK_OPTS), end: endOfWeek(cursor, WEEK_OPTS) };
  return { start: startOfWeek(startOfMonth(cursor), WEEK_OPTS), end: endOfWeek(endOfMonth(cursor), WEEK_OPTS) };
}

/**
 * Calendário de atividades (mês, semana, dia). Os dias e horas são sempre os de Brasília,
 * igual aos diálogos de atividade, não importa o fuso do navegador.
 */
export function ActivitiesCalendar<T extends CalendarActivity>({
  activities, mode, onModeChange, cursor, onCursorChange, loading = false,
  colorOf, labelOf, onOpen, onCreate, onMove,
}: ActivitiesCalendarProps<T>) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const nowLocal = isoToBrasiliaLocal(new Date().toISOString());
  const todayKey = nowLocal.slice(0, 10);

  // dia -> atividades (já em ordem de horário)
  const byDay = useMemo(() => {
    const map = new Map<string, { a: T; time: string }[]>();
    for (const a of activities) {
      if (!a.scheduled_at) continue;
      const local = isoToBrasiliaLocal(a.scheduled_at);
      const k = local.slice(0, 10);
      const arr = map.get(k);
      const item = { a, time: local.slice(11, 16) };
      if (arr) arr.push(item); else map.set(k, [item]);
    }
    for (const arr of map.values()) arr.sort((x, y) => x.time.localeCompare(y.time));
    return map;
  }, [activities]);

  const { start, end } = calendarRange(mode, cursor);
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const step = (dir: 1 | -1) => {
    if (mode === "month") onCursorChange(addMonths(cursor, dir));
    else if (mode === "week") onCursorChange(addWeeks(cursor, dir));
    else onCursorChange(addDays(cursor, dir));
  };

  const title =
    mode === "month" ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
    : mode === "week" ? `${format(start, "d 'de' MMM", { locale: ptBR })} a ${format(end, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
    : format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const isOverdue = (a: T, k: string, time: string) => a.status === "pending" && `${k}T${time}` < nowLocal;

  const dropOn = (e: React.DragEvent, k: string, hour?: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const found = activities.find((x) => x.id === id);
    if (!found || !found.scheduled_at) return;
    const local = isoToBrasiliaLocal(found.scheduled_at);
    // soltar num dia mantém a hora; soltar numa faixa de hora mantém os minutos
    const target = `${k}T${hour ? `${hour}:${local.slice(14, 16)}` : local.slice(11, 16)}`;
    if (target !== local) onMove(found, target);
  };
  const dragProps = (key: string, k: string, hour?: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" as const; if (dragOver !== key) setDragOver(key); },
    onDragLeave: () => { if (dragOver === key) setDragOver(null); },
    onDrop: (e: React.DragEvent) => dropOn(e, k, hour),
  });

  const chip = (a: T, k: string, time: string, full = false) => {
    const color = colorOf(a.type);
    const done = a.status === "completed";
    return (
      <button
        key={a.id}
        type="button"
        draggable={!done}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }}
        onClick={(e) => { e.stopPropagation(); onOpen(a); }}
        title={`${time} ${a.title}${a.lead?.name ? `, ${a.lead.name}` : ""} (${labelOf(a.type)})${done ? ", concluída" : ""}`}
        className={cn(
          "w-full text-left rounded border-l-[3px] px-1.5 text-foreground hover:brightness-95 dark:hover:brightness-125 transition",
          full ? "py-1 text-xs" : "py-0.5 text-[11px] leading-tight",
          done && "opacity-60 line-through",
        )}
        style={{ borderLeftColor: color, backgroundColor: `${color}26` }}
      >
        <span className="flex items-center gap-1 min-w-0">
          <span className={cn("shrink-0 tabular-nums", isOverdue(a, k, time) ? "text-destructive font-semibold" : "text-muted-foreground")}>{time}</span>
          <span className="truncate font-medium">{a.title}</span>
        </span>
        {full && (a.lead?.name || a.responsible?.name) && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {[a.lead?.name, a.responsible?.name].filter(Boolean).join(" · ")}
          </span>
        )}
      </button>
    );
  };

  // ------------------------------------------------------------------ mês
  const renderMonth = () => (
    <div className="h-full flex flex-col min-h-[480px]">
      <div className="grid grid-cols-7 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
        {days.slice(0, 7).map((d) => (
          <div key={dayKey(d)} className="px-2 py-1.5 text-center">{format(d, "EEE", { locale: ptBR })}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(96px, 1fr))` }}>
        {days.map((d) => {
          const k = dayKey(d);
          const items = byDay.get(k) || [];
          const outside = d.getMonth() !== cursor.getMonth();
          return (
            <div
              key={k}
              onClick={() => onCreate(`${k}T${DEFAULT_HOUR}`)}
              {...dragProps(k, k)}
              className={cn(
                "border-b border-r border-border p-1 space-y-0.5 cursor-pointer overflow-hidden min-w-0 hover:bg-muted/40 transition-colors",
                outside && "bg-muted/20",
                dragOver === k && "bg-primary/10 ring-1 ring-inset ring-primary/40",
              )}
              title="Clique num espaço vazio pra criar uma atividade neste dia"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCursorChange(d); onModeChange("day"); }}
                  className={cn(
                    "h-5 min-w-5 px-1 rounded-full text-[11px] tabular-nums hover:bg-muted",
                    k === todayKey ? "bg-primary text-primary-foreground font-semibold hover:bg-primary" : outside ? "text-muted-foreground/60" : "text-muted-foreground",
                  )}
                  title="Abrir o dia"
                >
                  {format(d, "d")}
                </button>
              </div>
              {items.slice(0, MAX_CHIPS_MONTH).map(({ a, time }) => chip(a, k, time))}
              {items.length > MAX_CHIPS_MONTH && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCursorChange(d); onModeChange("day"); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground px-1"
                >
                  +{items.length - MAX_CHIPS_MONTH} mais
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ------------------------------------------------------------------ semana
  const renderWeek = () => (
    <div className="h-full grid grid-cols-7 min-h-[420px] min-w-[840px]">
      {days.map((d) => {
        const k = dayKey(d);
        const items = byDay.get(k) || [];
        return (
          <div
            key={k}
            onClick={() => onCreate(`${k}T${DEFAULT_HOUR}`)}
            {...dragProps(k, k)}
            className={cn(
              "border-r border-border flex flex-col min-w-0 cursor-pointer hover:bg-muted/30 transition-colors",
              dragOver === k && "bg-primary/10 ring-1 ring-inset ring-primary/40",
            )}
            title="Clique num espaço vazio pra criar uma atividade neste dia"
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCursorChange(d); onModeChange("day"); }}
              className="px-2 py-1.5 border-b border-border text-center hover:bg-muted/60"
              title="Abrir o dia"
            >
              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</span>
              <span className={cn("inline-flex items-center justify-center h-6 min-w-6 px-1 rounded-full text-sm tabular-nums", k === todayKey && "bg-primary text-primary-foreground font-semibold")}>
                {format(d, "d")}
              </span>
            </button>
            <div className="flex-1 p-1 space-y-1 overflow-y-auto">
              {items.map(({ a, time }) => chip(a, k, time, true))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ------------------------------------------------------------------ dia
  const renderDay = () => {
    const k = dayKey(cursor);
    const items = byDay.get(k) || [];
    const hoursUsed = items.map((i) => Number(i.time.slice(0, 2)));
    const from = Math.min(7, ...hoursUsed);
    const to = Math.max(20, ...hoursUsed);
    const hours: string[] = [];
    for (let h = from; h <= to; h++) hours.push(String(h).padStart(2, "0"));
    return (
      <div className="divide-y divide-border">
        {hours.map((h) => {
          const key = `${k}T${h}`;
          const inHour = items.filter((i) => i.time.slice(0, 2) === h);
          return (
            <div
              key={h}
              onClick={() => onCreate(`${k}T${h}:00`)}
              {...dragProps(key, k, h)}
              className={cn(
                "flex gap-3 px-3 py-1.5 min-h-[44px] cursor-pointer hover:bg-muted/40 transition-colors",
                dragOver === key && "bg-primary/10",
              )}
              title="Clique num espaço vazio pra criar uma atividade neste horário"
            >
              <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums pt-1">{h}:00</span>
              <div className="flex-1 min-w-0 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {inHour.map(({ a, time }) => chip(a, k, time, true))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Barra do calendário */}
      <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-1)} title="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)} title="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onCursorChange(new Date(`${todayKey}T12:00:00`))}>
            Hoje
          </Button>
        </div>
        <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2">
          <span className="inline-block first-letter:uppercase">{title}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </h2>
        <div className="ml-auto flex items-center rounded-md border border-border overflow-hidden">
          {MODES.map((m, i) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              className={cn(
                "h-8 px-3 text-xs",
                i > 0 && "border-l border-border",
                mode === m.value ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {mode === "month" ? renderMonth() : mode === "week" ? renderWeek() : renderDay()}
      </div>
    </div>
  );
}
