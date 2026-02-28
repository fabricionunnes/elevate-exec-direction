import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Filter } from "lucide-react";
import { format, subMonths } from "date-fns";

export interface CFOFilters {
  month: string;       // "all" | "YYYY-MM"
  consultantId: string; // "all" | staff id
  companyId: string;    // "all" | company id
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface Company {
  id: string;
  name: string;
}

interface Props {
  filters: CFOFilters;
  onChange: (filters: CFOFilters) => void;
  staff: Staff[];
  companies: Company[];
}

export function CFOFilterBar({ filters, onChange, staff, companies }: Props) {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  // Generate months: 24 past + current + 12 future
  for (let i = -12; i <= 24; i++) {
    const d = subMonths(now, i);
    const val = format(d, "yyyy-MM");
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    months.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  const consultants = staff.filter(s => ["consultant", "cs", "admin", "master"].includes(s.role));

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card">
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={filters.month} onValueChange={(v) => onChange({ ...filters, month: v })}>
        <SelectTrigger className="w-[180px] h-9">
          <CalendarIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.consultantId} onValueChange={(v) => onChange({ ...filters, consultantId: v })}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Consultor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os consultores</SelectItem>
          {consultants.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.companyId} onValueChange={(v) => onChange({ ...filters, companyId: v })}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Empresa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as empresas</SelectItem>
          {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
