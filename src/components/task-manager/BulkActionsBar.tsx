import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, CheckCircle, Clock, PlayCircle, UserRound } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["onboarding_task_status"];

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onStaffChange?: (staffId: string | null) => void;
  staffList: StaffMember[];
}

export const BulkActionsBar = ({ count, onClear, onStatusChange, onStaffChange, staffList }: BulkActionsBarProps) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 bg-card border shadow-xl rounded-xl px-5 py-3">
        <span className="text-sm font-medium whitespace-nowrap">
          {count} selecionada{count > 1 ? "s" : ""}
        </span>

        <div className="h-6 w-px bg-border" />

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onStatusChange("pending")}>
          <Clock className="h-3.5 w-3.5" />
          Pendente
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onStatusChange("in_progress")}>
          <PlayCircle className="h-3.5 w-3.5" />
          Em progresso
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onStatusChange("completed")}>
          <CheckCircle className="h-3.5 w-3.5" />
          Concluir
        </Button>

        {onStaffChange && staffList.length > 0 && (
          <>
            <div className="h-6 w-px bg-border" />
            <Select onValueChange={(v) => onStaffChange(v === "none" ? null : v)}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <UserRound className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Transferir para..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {staffList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <div className="h-6 w-px bg-border" />

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
