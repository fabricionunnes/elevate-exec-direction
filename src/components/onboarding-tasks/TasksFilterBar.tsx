import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";

export type TaskStatusFilter = "all" | "pending" | "in_progress" | "completed" | "overdue";
export type TaskSortOrder = "due_date_asc" | "due_date_desc";

interface TaskCounts {
  all: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

interface TasksFilterBarProps {
  statusFilter: TaskStatusFilter;
  onStatusFilterChange: (filter: TaskStatusFilter) => void;
  sortOrder: TaskSortOrder;
  onSortOrderChange: (order: TaskSortOrder) => void;
  counts: TaskCounts;
}

export const TasksFilterBar = ({
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
  counts,
}: TasksFilterBarProps) => {
  const filters: { value: TaskStatusFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "all", label: "Todas", icon: null, color: "bg-primary" },
    { value: "pending", label: "Pendentes", icon: <Circle className="h-3 w-3" />, color: "bg-muted-foreground" },
    { value: "in_progress", label: "Em andamento", icon: <Clock className="h-3 w-3" />, color: "bg-amber-500" },
    { value: "completed", label: "Concluídas", icon: <CheckCircle2 className="h-3 w-3" />, color: "bg-emerald-500" },
    { value: "overdue", label: "Atrasadas", icon: <AlertTriangle className="h-3 w-3" />, color: "bg-destructive" },
  ];

  const getCount = (filter: TaskStatusFilter) => counts[filter];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
      {/* Status filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 w-full sm:w-auto">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => onStatusFilterChange(filter.value)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              whitespace-nowrap transition-all flex-shrink-0
              ${statusFilter === filter.value
                ? `${filter.color} text-white`
                : "bg-muted text-muted-foreground hover:bg-muted/80"
              }
            `}
          >
            {filter.icon}
            {filter.label}
            <Badge 
              variant="secondary" 
              className={`ml-0.5 h-5 min-w-5 px-1.5 text-[10px] ${
                statusFilter === filter.value 
                  ? "bg-white/20 text-white" 
                  : ""
              }`}
            >
              {getCount(filter.value)}
            </Badge>
          </button>
        ))}
      </div>

      {/* Sort order */}
      <div className="flex items-center gap-2 ml-auto">
        <Select value={sortOrder} onValueChange={(v) => onSortOrderChange(v as TaskSortOrder)}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1.5" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due_date_asc">
              <span className="flex items-center gap-1.5">
                <ArrowUp className="h-3 w-3" />
                Data (mais próxima)
              </span>
            </SelectItem>
            <SelectItem value="due_date_desc">
              <span className="flex items-center gap-1.5">
                <ArrowDown className="h-3 w-3" />
                Data (mais distante)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters button */}
        {(statusFilter !== "all" || sortOrder !== "due_date_asc") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => {
              onStatusFilterChange("all");
              onSortOrderChange("due_date_asc");
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
};
