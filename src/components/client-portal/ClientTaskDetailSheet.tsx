import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  User,
  FileText,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed";
  observations: string | null;
  assignee?: { id: string; name: string; role: string };
  responsible_staff?: { id: string; name: string } | null;
}

interface ClientTaskDetailSheetProps {
  task: OnboardingTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientTaskDetailSheet = ({ task, open, onOpenChange }: ClientTaskDetailSheetProps) => {
  if (!task) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getResponsibleName = (task: OnboardingTask) => {
    if (task.responsible_staff?.name) return task.responsible_staff.name;
    if (task.assignee?.name) return task.assignee.name;
    return null;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "cs": return "Customer Success";
      case "consultant": return "Consultor";
      case "client": return "Cliente";
      case "admin": return "Administrador";
      default: return role;
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "completed":
        return {
          label: "Concluída",
          icon: <CheckCircle2 className="h-5 w-5" />,
          color: "bg-emerald-500 text-white",
        };
      case "in_progress":
        return {
          label: "Em Andamento",
          icon: <Clock className="h-5 w-5" />,
          color: "bg-amber-500 text-white",
        };
      default:
        return {
          label: "Pendente",
          icon: <Circle className="h-5 w-5" />,
          color: "bg-muted text-muted-foreground",
        };
    }
  };

  const statusInfo = getStatusInfo(task.status);
  const responsibleName = getResponsibleName(task);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusInfo.color}`}>
              {statusInfo.icon}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{task.title}</SheetTitle>
              <Badge
                className={`mt-1 ${
                  task.status === "completed"
                    ? "bg-emerald-500"
                    : task.status === "in_progress"
                      ? "bg-amber-500"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Descrição
              </h4>
              <p className="text-sm leading-relaxed">{task.description}</p>
            </div>
          )}

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            {task.due_date && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Previsão
                </h4>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {format(new Date(task.due_date), "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
              </div>
            )}

            {task.completed_at && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Concluída em
                </h4>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">
                    {format(new Date(task.completed_at), "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Responsible */}
          {responsibleName && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável
              </h4>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(responsibleName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {task.assignee?.role === "client" ? "Você" : responsibleName}
                  </p>
                  {task.assignee?.role && (
                    <p className="text-xs text-muted-foreground">
                      {getRoleLabel(task.assignee.role)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Observations / Result */}
          {task.observations && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Resultado / Observações
                </h4>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
                  <p className="text-sm leading-relaxed">{task.observations}</p>
                </div>
              </div>
            </>
          )}

          {/* Status explanation */}
          <div className="p-4 bg-muted/30 rounded-xl">
            <p className="text-xs text-muted-foreground text-center">
              {task.status === "completed"
                ? "Esta etapa foi concluída com sucesso!"
                : task.status === "in_progress"
                  ? "Nossa equipe está trabalhando nesta etapa."
                  : "Esta etapa será iniciada em breve."}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
