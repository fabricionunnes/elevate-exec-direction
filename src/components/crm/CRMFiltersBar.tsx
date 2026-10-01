import { useState, type ReactNode } from "react";
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
  Banknote,
  ChevronDown,
  X,
  Filter,
  Download,
  Settings2,
  RotateCcw,
  Phone,
  Megaphone,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/crm/traffic/MultiSearchableSelect";
import { rangeFromJson, rangeToJson } from "@/components/crm/views/viewUtils";

export interface CRMFilters {
  search: string;
  dateRange: DateRange | undefined;
  fields: string[];
  tags: string[];
  // tags que TIRAM o lead da lista (ex.: todos menos "Template enviado")
  tagsExclude?: string[];
  owners: string[];
  status: string[];
  stages: string[];
  origins: string[];
  valueMin: number | null;
  valueMax: number | null;
  /** faturamento que o lead informou na qualificação (texto livre, lido por aproximação) */
  revenueMin?: number | null;
  revenueMax?: number | null;
  phoneFilter: "all" | "with_phone" | "without_phone";
  // filtros por nome do anúncio (Meta) — opcionais pra não quebrar quem não usa
  campaigns?: string[];
  adsets?: string[];
  ads?: string[];
  /** produto do lead (crm_leads.product_id) */
  products?: string[];
  /** última mudança de etapa (crm_leads.stage_entered_at) */
  movedRange?: DateRange;
  /** data de ganho (closed_at, só em etapa de ganho) */
  wonRange?: DateRange;
  lossReasons?: string[];
  /** condições em campos do lead: coluna ou campo adicional, "contém / igual / vazio / preenchido" */
  fieldConditions?: FieldCondition[];
  /** sem atividade há N dias (ou nunca teve) */
  inactiveDays?: number | null;
  noOwner?: boolean;
  /** listas de leads (crm_lead_lists): mostra quem está em qualquer uma das marcadas */
  lists?: string[];
}

export type FieldConditionOp = "contains" | "equals" | "empty" | "not_empty";
export interface FieldCondition {
  fieldId: string;
  op: FieldConditionOp;
  value: string;
}

/** campo de crm_custom_fields (sistema = coluna do lead; senão = crm_custom_field_values) */
export interface LeadFieldOption {
  id: string;
  name: string;
  is_system: boolean;
  field_name: string;
  field_type: string;
  context: string;
}

/** Filtros do funil em formato JSON (datas viram texto), pra guardar numa visão salva. */
export const crmFiltersToJson = (f: CRMFilters): Record<string, any> => ({
  ...f,
  dateRange: rangeToJson(f.dateRange),
  movedRange: rangeToJson(f.movedRange),
  wonRange: rangeToJson(f.wonRange),
});

/** Volta do JSON da visão pro estado da tela; o que a visão não tem fica no padrão. */
export const crmFiltersFromJson = (j: Record<string, any> | null | undefined, base: CRMFilters): CRMFilters => {
  const v = j || {};
  const arr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((i) => typeof i === "string") : []);
  const num = (x: unknown): number | null => (typeof x === "number" && isFinite(x) ? x : null);
  return {
    ...base,
    search: typeof v.search === "string" ? v.search : "",
    dateRange: rangeFromJson(v.dateRange),
    fields: arr(v.fields),
    tags: arr(v.tags),
    tagsExclude: arr(v.tagsExclude),
    owners: arr(v.owners),
    status: arr(v.status),
    stages: arr(v.stages),
    origins: arr(v.origins),
    valueMin: num(v.valueMin),
    valueMax: num(v.valueMax),
    revenueMin: num(v.revenueMin),
    revenueMax: num(v.revenueMax),
    phoneFilter: v.phoneFilter === "with_phone" || v.phoneFilter === "without_phone" ? v.phoneFilter : "all",
    campaigns: arr(v.campaigns),
    adsets: arr(v.adsets),
    ads: arr(v.ads),
    products: arr(v.products),
    movedRange: rangeFromJson(v.movedRange),
    wonRange: rangeFromJson(v.wonRange),
    lossReasons: arr(v.lossReasons),
    fieldConditions: Array.isArray(v.fieldConditions)
      ? v.fieldConditions.filter((c: any) => c && typeof c.fieldId === "string" && typeof c.op === "string")
          .map((c: any) => ({ fieldId: c.fieldId, op: c.op as FieldConditionOp, value: String(c.value ?? "") }))
      : [],
    inactiveDays: num(v.inactiveDays),
    noOwner: !!v.noOwner,
    lists: arr(v.lists),
  };
};

const FIELD_OPS: { value: FieldConditionOp; label: string }[] = [
  { value: "contains", label: "contém" },
  { value: "equals", label: "é igual a" },
  { value: "empty", label: "está vazio" },
  { value: "not_empty", label: "está preenchido" },
];

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
  campaignOptions?: string[];
  adsetOptions?: string[];
  adOptions?: string[];
  /** Exportar leads — só master/admin (a base de leads é dado sensível) */
  canExport?: boolean;
  onExport?: () => void;
  productOptions?: FilterOption[];
  lossReasonOptions?: FilterOption[];
  fieldOptions?: LeadFieldOption[];
  /** listas de leads que a pessoa enxerga (filtro "Lista") */
  listOptions?: FilterOption[];
  /** Visões salvas (botão + atalhos), na linha logo acima da lista */
  viewsSlot?: ReactNode;
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
  campaignOptions = [],
  adsetOptions = [],
  adOptions = [],
  canExport = false,
  onExport,
  productOptions = [],
  lossReasonOptions = [],
  fieldOptions = [],
  listOptions = [],
  viewsSlot,
}: CRMFiltersBarProps) => {
  const [dateOpen, setDateOpen] = useState(false);
  const [movedOpen, setMovedOpen] = useState(false);
  const [wonOpen, setWonOpen] = useState(false);
  // condição nova do filtro "Campos"
  const [newCondField, setNewCondField] = useState("");
  const [newCondOp, setNewCondOp] = useState<FieldConditionOp>("contains");
  const [newCondValue, setNewCondValue] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [adSearch, setAdSearch] = useState("");

  const filteredTagOptions = tagSearch.trim()
    ? tagOptions.filter((t) =>
        t.name.toLowerCase().includes(tagSearch.trim().toLowerCase())
      )
    : tagOptions;

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

  const excluidas = filters.tagsExclude || [];
  const tagCount = filters.tags.length + excluidas.length;
  // marcar pra incluir tira da exclusão e vice-versa (uma tag nunca fica nos dois)
  const toggleIncluirTag = (id: string) => {
    const tags = filters.tags.includes(id) ? filters.tags.filter((t) => t !== id) : [...filters.tags, id];
    onFiltersChange({ ...filters, tags, tagsExclude: excluidas.filter((t) => t !== id) });
  };
  const toggleExcluirTag = (id: string) => {
    const tagsExclude = excluidas.includes(id) ? excluidas.filter((t) => t !== id) : [...excluidas, id];
    onFiltersChange({ ...filters, tagsExclude, tags: filters.tags.filter((t) => t !== id) });
  };

  // filtros por nome (campanha/conjunto/anúncio)
  const toggleNameFilter = (key: "campaigns" | "adsets" | "ads", val: string) => {
    const current = filters[key] || [];
    updateFilter(key, current.includes(val) ? current.filter((v) => v !== val) : [...current, val]);
  };

  const adFilterCount = (filters.campaigns?.length || 0) + (filters.adsets?.length || 0) + (filters.ads?.length || 0);
  const clearAdFilters = () =>
    onFiltersChange({ ...filters, campaigns: [], adsets: [], ads: [] });

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      dateRange: undefined,
      fields: [],
      tags: [],
      tagsExclude: [],
      owners: [],
      status: [],
      stages: [],
      origins: [],
      valueMin: null,
      valueMax: null,
      revenueMin: null,
      revenueMax: null,
      phoneFilter: "all",
      campaigns: [],
      adsets: [],
      ads: [],
      products: [],
      movedRange: undefined,
      wonRange: undefined,
      lossReasons: [],
      fieldConditions: [],
      inactiveDays: null,
      noOwner: false,
      lists: [],
    });
  };

  const conditions = filters.fieldConditions || [];
  const addCondition = () => {
    if (!newCondField) return;
    if ((newCondOp === "contains" || newCondOp === "equals") && !newCondValue.trim()) return;
    updateFilter("fieldConditions", [...conditions, { fieldId: newCondField, op: newCondOp, value: newCondValue.trim() }]);
    setNewCondField("");
    setNewCondOp("contains");
    setNewCondValue("");
  };
  const removeCondition = (idx: number) => updateFilter("fieldConditions", conditions.filter((_, i) => i !== idx));
  const fieldLabel = (id: string) => fieldOptions.find((f) => f.id === id)?.name || "campo";
  const opLabel = (op: FieldConditionOp) => FIELD_OPS.find((o) => o.value === op)?.label || op;

  const moreFilterCount =
    filters.stages.length +
    (filters.products?.length || 0) +
    (filters.lossReasons?.length || 0) +
    (filters.movedRange?.from ? 1 : 0) +
    (filters.wonRange?.from ? 1 : 0) +
    (filters.inactiveDays ? 1 : 0) +
    (filters.noOwner ? 1 : 0) +
    (filters.lists?.length || 0);
  const camposCount = filters.fields.length + conditions.length;

  const activeFilterCount = [
    filters.dateRange ? 1 : 0,
    filters.fields.length,
    filters.tags.length,
    excluidas.length,
    filters.owners.length,
    filters.status.length,
    filters.stages.length,
    filters.origins.length,
    filters.valueMin || filters.valueMax ? 1 : 0,
    filters.revenueMin || filters.revenueMax ? 1 : 0,
    filters.phoneFilter !== "all" ? 1 : 0,
    (filters.campaigns?.length || 0),
    (filters.adsets?.length || 0),
    (filters.ads?.length || 0),
    (filters.products?.length || 0),
    (filters.lossReasons?.length || 0),
    filters.movedRange?.from ? 1 : 0,
    filters.wonRange?.from ? 1 : 0,
    filters.inactiveDays ? 1 : 0,
    filters.noOwner ? 1 : 0,
    (filters.fieldConditions?.length || 0),
    (filters.lists?.length || 0),
  ].reduce((a, b) => a + b, 0);

  const statusOptions = [
    { id: "open", name: "Aberto" },
    { id: "won", name: "Ganho" },
    { id: "lost", name: "Perdido" },
  ];

  // escopo da busca livre (filters.fields): contato, negócio ou empresa
  const fieldScopeOptions = [
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

        {/* Campos: onde a busca procura + condições em campos do lead */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                camposCount > 0 && "bg-primary/10 text-foreground font-medium"
              )}
            >
              Campos
              {camposCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {camposCount}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Buscar em</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">
                  Limita onde o texto do "Buscar" procura. Nada marcado = nome, empresa, e-mail e telefone.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {fieldOptions.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">Sem campos cadastrados.</span>
                  )}
                  {fieldScopeOptions.map((field) => (
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
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase">Condições</Label>
                {conditions.length > 0 && (
                  <div className="space-y-1 mt-1.5">
                    {conditions.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded bg-muted/60 px-2 py-1 text-xs">
                        <span className="flex-1 min-w-0 truncate">
                          <strong>{fieldLabel(c.fieldId)}</strong> {opLabel(c.op)}
                          {(c.op === "contains" || c.op === "equals") && <> "{c.value}"</>}
                        </span>
                        <button type="button" onClick={() => removeCondition(idx)} className="text-muted-foreground hover:text-destructive" title="Remover condição">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2 mt-2">
                  <SearchableSelect
                    value={newCondField}
                    onValueChange={setNewCondField}
                    options={fieldOptions.map((f) => ({ value: f.id, label: f.name, hint: f.is_system ? undefined : "adicional" }))}
                    placeholder="Campo..."
                    emptyMessage="Nenhum campo com esse nome."
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2">
                    <div className="w-[130px] shrink-0">
                      <SearchableSelect
                        value={newCondOp}
                        onValueChange={(v) => setNewCondOp(v as FieldConditionOp)}
                        options={FIELD_OPS}
                        className="h-8 text-xs"
                      />
                    </div>
                    {(newCondOp === "contains" || newCondOp === "equals") && (
                      <Input
                        value={newCondValue}
                        onChange={(e) => setNewCondValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addCondition(); }}
                        placeholder="Valor"
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={addCondition}
                    disabled={!newCondField || ((newCondOp === "contains" || newCondOp === "equals") && !newCondValue.trim())}>
                    Adicionar condição
                  </Button>
                </div>
              </div>
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
                tagCount > 0 && "bg-primary/10 text-foreground font-medium"
              )}
            >
              Tags
              {tagCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {tagCount}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <p className="text-[11px] text-muted-foreground px-1 mb-1.5">
              Marque para mostrar só quem tem a tag. Clique em <Ban className="inline h-3 w-3 -mt-0.5" /> para esconder quem tem.
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar tag..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {tagOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma tag</p>
              ) : filteredTagOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma tag encontrada</p>
              ) : (
                filteredTagOptions.map((tag) => {
                  const excluida = excluidas.includes(tag.id);
                  return (
                    <div key={tag.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={filters.tags.includes(tag.id)}
                        onCheckedChange={() => toggleIncluirTag(tag.id)}
                      />
                      <Label
                        htmlFor={`tag-${tag.id}`}
                        className={cn(
                          "text-sm cursor-pointer flex items-center gap-2 flex-1 min-w-0",
                          excluida && "line-through text-destructive"
                        )}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || "#888" }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => toggleExcluirTag(tag.id)}
                        title={excluida ? "Voltar a mostrar quem tem esta tag" : "Esconder leads com esta tag"}
                        className={cn(
                          "h-6 w-6 shrink-0 rounded flex items-center justify-center transition-colors",
                          excluida ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        )}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
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

        {/* Anúncios (Meta): campanha / conjunto / anúncio */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                adFilterCount > 0 && "bg-primary/10 text-foreground font-medium"
              )}
            >
              <Megaphone className="h-3.5 w-3.5" />
              Anúncios
              {adFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {adFilterCount}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold flex-1">Filtrar por anúncio</p>
                {adFilterCount > 0 && (
                  <button onClick={clearAdFilters} className="text-[11px] text-muted-foreground hover:text-foreground">
                    Limpar
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar campanha, conjunto ou anúncio"
                  value={adSearch}
                  onChange={(e) => setAdSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-[340px] overflow-y-auto p-3 space-y-3">
              {campaignOptions.length === 0 && adsetOptions.length === 0 && adOptions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">
                  Nenhum lead deste funil tem campanha, conjunto ou anúncio registrado.
                </p>
              ) : (
                ([
                  { key: "campaigns" as const, label: "Campanha", opts: campaignOptions },
                  { key: "adsets" as const, label: "Conjunto de anúncios", opts: adsetOptions },
                  { key: "ads" as const, label: "Anúncio", opts: adOptions },
                ]).map(({ key, label, opts }) => {
                  const q = adSearch.trim().toLowerCase();
                  const shown = opts.filter((o) => !q || o.toLowerCase().includes(q));
                  if (shown.length === 0) return null;
                  return (
                    <div key={key}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        {label} <span className="font-normal normal-case">({shown.length})</span>
                      </p>
                      <div className="space-y-0.5">
                        {shown.slice(0, 60).map((name) => (
                          <div key={name} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/60">
                            <Checkbox
                              id={`adf-${key}-${name}`}
                              checked={(filters[key] || []).includes(name)}
                              onCheckedChange={() => toggleNameFilter(key, name)}
                            />
                            <Label htmlFor={`adf-${key}-${name}`} className="text-xs cursor-pointer truncate flex-1" title={name}>
                              {name}
                            </Label>
                          </div>
                        ))}
                        {shown.length > 60 && (
                          <p className="text-[10px] text-muted-foreground px-1 pt-1">
                            +{shown.length - 60} resultados — refine a busca
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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

        {/* Valor do negócio e faturamento do lead: fora do "Mais filtros" porque é
            consulta do dia a dia de quem prioriza carteira */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
                (filters.valueMin || filters.valueMax || filters.revenueMin || filters.revenueMax) && "bg-primary/10 text-foreground font-medium"
              )}
            >
              <Banknote className="h-3.5 w-3.5" />
              Valor
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Valor do negócio</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="number" placeholder="Min" className="h-8"
                    value={filters.valueMin || ""}
                    onChange={(e) => updateFilter("valueMin", e.target.value ? Number(e.target.value) : null)} />
                  <span className="text-muted-foreground">até</span>
                  <Input type="number" placeholder="Max" className="h-8"
                    value={filters.valueMax || ""}
                    onChange={(e) => updateFilter("valueMax", e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Faturamento do lead</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="number" placeholder="Min" className="h-8"
                    value={filters.revenueMin || ""}
                    onChange={(e) => updateFilter("revenueMin" as any, e.target.value ? Number(e.target.value) : null)} />
                  <span className="text-muted-foreground">até</span>
                  <Input type="number" placeholder="Max" className="h-8"
                    value={filters.revenueMax || ""}
                    onChange={(e) => updateFilter("revenueMax" as any, e.target.value ? Number(e.target.value) : null)} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  É o que o lead informou que fatura por mês. Quem não informou fica de fora quando esse filtro está ligado.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* More Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground">
              <Filter className="h-3.5 w-3.5" />
              Mais filtros
              {moreFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {moreFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto" align="start">
            <div className="space-y-4">
              {/* Lista de leads */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Lista</Label>
                <div className="mt-1.5">
                  <MultiSearchableSelect
                    values={filters.lists || []}
                    onChange={(vals) => updateFilter("lists", vals)}
                    options={listOptions.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Qualquer lista"
                    allLabel="Qualquer lista"
                    emptyText="Nenhuma lista."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Produto */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Produto</Label>
                <div className="mt-1.5">
                  <MultiSearchableSelect
                    values={filters.products || []}
                    onChange={(vals) => updateFilter("products", vals)}
                    options={productOptions.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Qualquer produto"
                    allLabel="Qualquer produto"
                    emptyText="Nenhum produto."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Motivo de perda */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Motivo de perda</Label>
                <div className="mt-1.5">
                  <MultiSearchableSelect
                    values={filters.lossReasons || []}
                    onChange={(vals) => updateFilter("lossReasons", vals)}
                    options={lossReasonOptions.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Qualquer motivo"
                    allLabel="Qualquer motivo"
                    emptyText="Nenhum motivo."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Datas: movimentação e ganho */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Movimentação</Label>
                  <Popover open={movedOpen} onOpenChange={setMovedOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-8 w-full justify-start text-xs font-normal mt-1.5", filters.movedRange?.from && "font-medium")}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        {filters.movedRange?.from
                          ? `${format(filters.movedRange.from, "dd/MM", { locale: ptBR })}${filters.movedRange.to ? ` - ${format(filters.movedRange.to, "dd/MM", { locale: ptBR })}` : ""}`
                          : "Qualquer data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="range" selected={filters.movedRange} onSelect={(r) => updateFilter("movedRange", r)} locale={ptBR} numberOfMonths={1} className="pointer-events-auto" />
                      {filters.movedRange?.from && (
                        <button type="button" className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5 border-t" onClick={() => updateFilter("movedRange", undefined)}>Limpar</button>
                      )}
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-muted-foreground mt-1">Última mudança de etapa.</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Ganho em</Label>
                  <Popover open={wonOpen} onOpenChange={setWonOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-8 w-full justify-start text-xs font-normal mt-1.5", filters.wonRange?.from && "font-medium")}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        {filters.wonRange?.from
                          ? `${format(filters.wonRange.from, "dd/MM", { locale: ptBR })}${filters.wonRange.to ? ` - ${format(filters.wonRange.to, "dd/MM", { locale: ptBR })}` : ""}`
                          : "Qualquer data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="range" selected={filters.wonRange} onSelect={(r) => updateFilter("wonRange", r)} locale={ptBR} numberOfMonths={1} className="pointer-events-auto" />
                      {filters.wonRange?.from && (
                        <button type="button" className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5 border-t" onClick={() => updateFilter("wonRange", undefined)}>Limpar</button>
                      )}
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-muted-foreground mt-1">Só leads na etapa de ganho.</p>
                </div>
              </div>

              {/* Sem atividade / sem responsável */}
              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Sem atividade há</Label>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Input type="number" min={1} placeholder="N" className="h-8 text-xs"
                      value={filters.inactiveDays ?? ""}
                      onChange={(e) => updateFilter("inactiveDays", e.target.value ? Math.max(1, Number(e.target.value)) : null)} />
                    <span className="text-xs text-muted-foreground">dias</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox id="no-owner" checked={!!filters.noOwner} onCheckedChange={(c) => updateFilter("noOwner", !!c)} />
                  <Label htmlFor="no-owner" className="text-sm cursor-pointer">Sem responsável</Label>
                </div>
              </div>

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
          {canExport && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onExport}
              title="Exportar leads filtrados (CSV)"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Visões salvas + contagem */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {viewsSlot}
        <span className={cn(viewsSlot && "ml-auto")}>
          {totalCount} oportunidades de <strong className="text-foreground font-semibold">{entityName}</strong>
        </span>
      </div>
    </div>
  );
};
