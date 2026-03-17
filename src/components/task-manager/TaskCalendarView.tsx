import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TaskWithProject } from "@/pages/onboarding-tasks/TaskManagerPage";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type TaskStatus = Database["public"]["Enums"]["onboarding_task_status"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
};

interface Props {
  tasks: TaskWithProject[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

export const TaskCalendarView = ({ tasks, onStatusChange }: Props) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithProject[]>();
    tasks.forEach(t => {
      const dateStr = t.start_date || t.due_date;
      if (!dateStr) return;
      const key = dateStr.split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return tasksByDate.get(key) || [];
  }, [selectedDay, tasksByDate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
          <div key={d} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}

        {days.map((d, i) => {
          const key = format(d, "yyyy-MM-dd");
          const dayTasks = tasksByDate.get(key) || [];
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const today = isToday(d);

          return (
            <div
              key={i}
              onClick={() => dayTasks.length > 0 && setSelectedDay(d)}
              className={`bg-card min-h-[90px] p-1.5 transition-colors ${
                !isCurrentMonth ? "opacity-40" : ""
              } ${today ? "ring-2 ring-primary/30 ring-inset" : ""} ${
                dayTasks.length > 0 ? "cursor-pointer hover:bg-accent/50" : ""
              }`}
            >
              <div className={`text-xs font-medium mb-1 ${today ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 text-[10px] leading-tight truncate"
                  >
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusColors[t.status] || "bg-gray-400"}`} />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-3">
                    +{dayTasks.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && format(selectedDay, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {selectedDayTasks.map(t => (
                <Card key={t.id} className="p-3">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{t.title}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          t.status === "completed"
                            ? "bg-green-500/10 text-green-600"
                            : t.status === "in_progress"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-yellow-500/10 text-yellow-600"
                        }`}
                      >
                        {t.status === "completed" ? "Concluída" : t.status === "in_progress" ? "Em progresso" : "Pendente"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>{t.company_name} · {t.project_name}</span>
                    </div>
                    {t.status !== "completed" && (
                      <div className="flex gap-1.5 pt-1">
                        {t.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => onStatusChange(t.id, "in_progress")}>
                            Iniciar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-700"
                          onClick={() => onStatusChange(t.id, "completed")}>
                          Concluir
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
