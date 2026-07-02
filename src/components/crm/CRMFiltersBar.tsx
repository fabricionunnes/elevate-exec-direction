import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Search,
  Calendar as CalendarIcon,
  ChevronDown,
  X,
  Filter,
  Download,
  Settings2,
  RotateCcw,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export interface CRMFilters {
  search: string;
  dateRange: DateRange | undefined;
  fields: string[];
  tags: string[];
  owners: string[];
  status: string[];
  stages: string[];
  origins: string[];
  valueMin: number | null;
  valueMax: number | null;
  phoneFilter: "all" | "with_phone" | "without_phone";
}

interface FilterOption {
  id: string;
  name: string;
  color?: string;
}

interface CRMFiltersBarProps {
  filters: CRMFilters;
  onFiltersChange: (filters: CRMFilters) => void;
  tagOptions: FilterOption[];
  ownerOptions: FilterOption[];
  stageOptions: FilterOption[];
  originOptions: FilterOption[];
  totalCount: number;
  entityName?: string;
}

export const CRMFiltersBar = ({
  filters,
  onFiltersChange,
  tagOptions,
  ownerOptions,
  stageOptions,
  originOptions,
  totalCount,
  entityName = "negócios",
}: CRMFiltersBarProps) => {
  const [dateOpen, setDateOpen] = useState(false);

  const updateFilter = <K extends keyof CRMFilters>(key: K, value: CRMFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: "tags" | "owners" | "status" | "stages" | "origins" | "fields", id: string) => {
    const current = filters[key];
    const updated = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id];
    updateFilter(key, updated);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      dateRange: undefined,
      fields: [],
      tags: [],
      owners: [],
      status: [],
      stages: [],
      origins: [],
      valueMin: null,
      valueMax: null,
      phoneFilter: "all",
    });
  };

  const activeFilterCount = [
    filters.dateRange ? 1 : 0,
    filters.fields.length,
    filters.tags.length,
    filters.owners.length,
    filters.status.length,
    filters.stages.length,
    filters.origins.length,
    filters.valueMin || filters.valueMax ? 1 : 0,
    filters.phoneFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const statusOptions = [
    { id: "open", name: "Aberto" },
    { id: "won", name: "Ganho" },
    { id: "lost", name: "Perdido" },
  ];

  const fieldOptions = [
    { id: "contact", name: "Contato" },
    { id: "deal", name: "Negócio" },
    { id: "company", name: "Empresa" },
  ];

  return (
    <div className="flex flex-col gap-2 px-3 py-2 border-b border-border/60 bg-card">
      {/* Main Filter Row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-8 h-8 text-sm bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-input"
          />
        </div>

        {/* Date Filter */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                filters.dateRange && "bg-primary/10 text-foreground font-medium"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                    {format(filters.dateRange.to, "dd/MM", { locale: ptBR })}
                  </>
                ) : (
                  format(filters.dateRange.from, "dd/MM/yy", { locale: ptBR })
                )
              ) : (
                "Data"
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={filters.dateRange}
              onSelect={(range) => {
                updateFilter("dateRange", range);
              }}
              locale={ptBR}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Fields Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                filters.fields.length > 0 && "bg-primary/10 text-foreground font-medium"
              )}
            >
              Campos
              {filters.fields.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {filters.fields.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-1">
              <Input placeholder="Buscar por..." className="h-8 text-sm mb-2" />
              {fieldOptions.map((field) => (
                <div key={field.id} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={`field-${field.id}`}
                    checked={filters.fields.includes(field.id)}
                    onCheckedChange={() => toggleArrayFilter("fields", field.id)}
                  />
                  <Label htmlFor={`field-${field.id}`} className="text-sm cursor-pointer">
                    {field.name}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Tags Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                filters.tags.length > 0 && "bg-primary/10 text-foreground font-medium"
              )}
            >
              Tags
              {filters.tags.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {filters.tags.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {tagOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma tag</p>
              ) : (
                tagOptions.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={filters.tags.includes(tag.id)}
                      onCheckedChange={() => toggleArrayFilter("tags", tag.id)}
                    />
                    <Label
                      htmlFor={`tag-${tag.id}`}
                      className="text-sm cursor-pointer flex items-center gap-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tag.color || "#888" }}
                      />
                      {tag.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Owner Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                filters.owners.length > 0 && "bg-primary/10 text-foreground font-medium"
              )}
            >
              Dono do negócio
              {filters.owners.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {filters.owners.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {ownerOptions.map((owner) => (
                <div key={owner.id} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={`owner-${owner.id}`}
                    checked={filters.owners.includes(owner.id)}
                    onCheckedChange={() => toggleArrayFilter("owners", owner.id)}
                  />
                  <Label htmlFor={`owner-${owner.id}`} className="text-sm cursor-pointer">
                    {owner.name}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                filters.status.length > 0 && "bg-primary/10 text-foreground font-medium"
              )}
            >
              Status
              {filters.status.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {filters.status.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-1">
              {statusOptions.map((status) => (
                <div key={status.id} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={`status-${status.id}`}
                    checked={filters.status.includes(status.id)}
                    onCheckedChange={() => toggleArrayFilter("status", status.id)}
                  />
                  <Label htmlFor={`status-${status.id}`} className="text-sm cursor-pointer">
                    {status.name}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Phone Filter */}
        <Select
          value={filters.phoneFilter}
          onValueChange={(value) => updateFilter("phoneFilter", value as CRMFilters["phoneFilter"])}
        >
          <SelectTrigger
            className={cn(
              "h-8 w-auto min-w-[120px] gap-1.5 text-xs border-transparent bg-transparent text-muted-foreground hover:text-foreground shadow-none",
              filters.phoneFilter !== "all" && "bg-primary/10 text-foreground font-medium"
            )}
          >
            <Phone className="h-3.5 w-3.5" />
            <SelectValue placeholder="Telefone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="with_phone">Com telefone</SelectItem>
            <SelectItem value="without_phone">Sem telefone</SelectItem>
          </SelectContent>
        </Select>

        {/* More Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground">
              <Filter className="h-3.5 w-3.5" />
              Mais filtros
              {(filters.stages.length > 0 || filters.valueMin || filters.valueMax) && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  +
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              {/* Stage Filter */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Etapa</Label>
                <div className="space-y-1 mt-2 max-h-[150px] overflow-auto">
                  {stageOptions.map((stage) => (
                    <div key={stage.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={`stage-${stage.id}`}
                        checked={filters.stages.includes(stage.id)}
                        onCheckedChange={() => toggleArrayFilter("stages", stage.id)}
                      />
                      <Label
                        htmlFor={`stage-${stage.id}`}
                        className="text-sm cursor-pointer flex items-center gap-2"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color || "#888" }}
                        />
                        {stage.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Value Range */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Valor</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.valueMin || ""}
                    onChange={(e) =>
                      updateFilter("valueMin", e.target.value ? Number(e.target.value) : null)
                    }
                    className="h-8"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.valueMax || ""}
                    onChange={(e) =>
                      updateFilter("valueMax", e.target.value ? Number(e.target.value) : null)
                    }
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar filtros
          </Button>
        )}

        {/* Right Side Actions */}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {totalCount} oportunidades de <strong className="text-foreground font-semibold">{entityName}</strong>
        </span>
      </div>
    </div>
  );
};
