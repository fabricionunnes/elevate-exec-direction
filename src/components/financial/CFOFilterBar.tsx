import { SearchableSelect } from "@/components/ui/searchable-select";
import { CalendarIcon, Filter } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const consultants = staff.filter(s => ["consultant", "cs", "admin", "master"].includes(s.role));

  const selectedDate = filters.month !== "all"
    ? parse(filters.month, "yyyy-MM", new Date())
    : undefined;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...filters, month: format(date, "yyyy-MM") });
    }
  };

  const monthLabel = selectedDate
    ? format(selectedDate, "MMMM yyyy", { locale: ptBR }).replace(/^./, c => c.toUpperCase())
    : "Todos os meses";

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 p-3 rounded-lg border bg-card">
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-[200px] h-9 justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {monthLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={ptBR}
              captionLayout="dropdown-buttons"
              fromYear={2020}
              toYear={2030}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {filters.month !== "all" && (
          <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => onChange({ ...filters, month: "all" })}>
            Limpar
          </Button>
        )}
      </div>

      <Select value={filters.consultantId} onValueChange={(v) => onChange({ ...filters, consultantId: v })}>
        <SelectTrigger className="w-full sm:w-[180px] h-9">
          <SelectValue placeholder="Consultor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os consultores</SelectItem>
          {consultants.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.companyId} onValueChange={(v) => onChange({ ...filters, companyId: v })}>
        <SelectTrigger className="w-full sm:w-[180px] h-9">
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
