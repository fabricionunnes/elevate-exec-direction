import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  employee_type: string;
  contract_type: string | null;
  hire_date: string | null;
  position_id: string | null;
  profile_positions?: { id: string; title: string } | null;
}

interface Position {
  id: string;
  title: string;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "onboarding", label: "Em onboarding" },
  { value: "terminated", label: "Desligados" },
  { value: "all", label: "Todos" },
];

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  onboarding: "Onboarding",
  terminated: "Desligado",
};

export default function UNVProfileEmployeesPage() {
  const [list, setList] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [positionId, setPositionId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: emps }, { data: pos }] = await Promise.all([
        supabase
          .from("profile_employees")
          .select(
            "id,full_name,email,phone,avatar_url,status,employee_type,contract_type,hire_date,position_id,profile_positions(id,title)",
          )
          .order("full_name"),
        supabase.from("profile_positions").select("id,title").order("title"),
      ]);
      setList((emps || []) as any);
      setPositions((pos || []) as any);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (positionId !== "all") {
        if (positionId === "none" ? !!e.position_id : e.position_id !== positionId) return false;
      }
      if (!term) return true;
      return (
        e.full_name?.toLowerCase().includes(term) ||
        e.email?.toLowerCase().includes(term) ||
        e.profile_positions?.title?.toLowerCase().includes(term)
      );
    });
  }, [list, q, status, positionId]);

  const hasFilters = q || status !== "active" || positionId !== "all";

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" /> Colaboradores
          </h1>
          <p className="text-sm text-muted-foreground">
            Sincronizado automaticamente com o Staff do UNV Nexus
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline">{filtered.length} exibidos</Badge>
          <Badge variant="outline">{list.length} no total</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, email ou cargo..."
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={positionId} onValueChange={setPositionId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cargos</SelectItem>
            <SelectItem value="none">Sem cargo definido</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setStatus("active");
              setPositionId("all");
            }}
            className="gap-1"
          >
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <Card key={emp.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={emp.avatar_url || undefined} />
                  <AvatarFallback>{emp.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{emp.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                  {emp.profile_positions?.title && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {emp.profile_positions.title}
                    </p>
                  )}
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge
                      variant={emp.status === "active" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {STATUS_LABELS[emp.status] || emp.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {emp.employee_type === "internal" ? "Interno UNV" : "Cliente"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-12">
              Nenhum colaborador encontrado com os filtros atuais.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
