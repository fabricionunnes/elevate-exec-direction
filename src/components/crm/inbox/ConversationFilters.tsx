import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  MessageSquare,
  Briefcase,
  Users,
  Smartphone,
  ChevronDown,
  HelpCircle,
  CalendarIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ConversationFiltersData {
  // Conversas
  assignedToMe: boolean;
  unassigned: boolean;
  noAttendantResponse: boolean;
  waitingContactResponse: boolean;
  inTransfer: boolean;
  read: boolean;
  unread: boolean;
  insideWindow: boolean;
  outsideWindow: boolean;
  suspended: boolean;
  createdAt: Date | undefined;
  status: string;
  assignedTo: string;
  sectorId: string;
  // Negócios
  dealCreatedAt: Date | undefined;
  hasDeal: string; // "all" | "with" | "without"
  dealStatus: string;
  dealOwner: string;
  dealGroup: string;
  dealOrigin: string;
  dealStage: string;
  // Contatos
  tags: string[];
  // Canais
  instanceId: string;
}

interface ConversationFiltersProps {
  open: boolean;
  onClose: () => void;
  filters: ConversationFiltersData;
  onFiltersChange: (filters: ConversationFiltersData) => void;
  currentStaffId: string;
}

interface StaffMember {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
}

interface OriginGroup {
  id: string;
  name: string;
}

interface Origin {
  id: string;
  name: string;
  group_id: string | null;
}

interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
}

interface Instance {
  id: string;
  instance_name: string;
  type: "evolution" | "official";
}

export function ConversationFilters({
  open,
  onClose,
  filters,
  onFiltersChange,
  currentStaffId,
}: ConversationFiltersProps) {
  const [conversasOpen, setConversasOpen] = useState(true);
  const [negociosOpen, setNegociosOpen] = useState(false);
  const [contatosOpen, setContatosOpen] = useState(false);
  const [canaisOpen, setCanaisOpen] = useState(false);

  // Data for selects
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [originGroups, setOriginGroups] = useState<OriginGroup[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);

  useEffect(() => {
    fetchFilterData();
  }, []);

  const fetchFilterData = async () => {
    // Fetch staff members
    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true);
    
    if (staffData) {
      setStaff(staffData as StaffMember[]);
    }

    // Fetch sectors
    const { data: sectorsData } = await supabase
      .from("company_sectors")
      .select("id, name")
      .eq("is_active", true);
    
    if (sectorsData) {
      setSectors(sectorsData as Sector[]);
    }

    // Fetch origin groups
    const { data: groupsData } = await supabase
      .from("crm_origin_groups")
      .select("id, name")
      .eq("is_active", true);
    
    if (groupsData) {
      setOriginGroups(groupsData as OriginGroup[]);
    }

    // Fetch origins (pipelines)
    const { data: originsData } = await supabase
      .from("crm_origins")
      .select("id, name, group_id")
      .eq("is_active", true);
    
    if (originsData) {
      setOrigins(originsData as Origin[]);
    }

    // Fetch stages from crm_pipelines (which actually stores stages)
    const { data: stagesData } = await supabase
      .from("crm_pipelines")
      .select("id, name")
      .eq("is_active", true);
    
    if (stagesData) {
      setStages(stagesData.map((s: any) => ({ id: s.id, name: s.name, pipeline_id: "" })));
    }

    // Fetch WhatsApp instances (Evolution API)
    const { data: evolutionData } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name");
    
    // Fetch Official API instances
    const { data: officialData } = await supabase
      .from("whatsapp_official_instances")
      .select("id, display_name, phone_number");
    
    const allInstances: Instance[] = [];
    
    if (evolutionData) {
      evolutionData.forEach((i: any) => {
        allInstances.push({ id: i.id, instance_name: i.instance_name, type: "evolution" });
      });
    }
    
    if (officialData) {
      officialData.forEach((i: any) => {
        const name = i.display_name || i.phone_number || "API Oficial";
        allInstances.push({ id: `official:${i.id}`, instance_name: `📱 ${name}`, type: "official" });
      });
    }
    
    setInstances(allInstances);
  };

  const updateFilter = <K extends keyof ConversationFiltersData>(
    key: K,
    value: ConversationFiltersData[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      assignedToMe: false,
      unassigned: false,
      noAttendantResponse: false,
      waitingContactResponse: false,
      inTransfer: false,
      read: false,
      unread: false,
      insideWindow: false,
      outsideWindow: false,
      suspended: false,
      createdAt: undefined,
      status: "",
      assignedTo: "",
      sectorId: "",
      dealCreatedAt: undefined,
      hasDeal: "",
      dealStatus: "",
      dealOwner: "",
      dealGroup: "",
      dealOrigin: "",
      dealStage: "",
      tags: [],
      instanceId: "",
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value !== "";
    if (Array.isArray(value)) return value.length > 0;
    if (value instanceof Date) return true;
    return false;
  }).length;

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[340px] bg-background border-l border-border shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-lg">Filtros</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Filters Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Conversas Section */}
          <Collapsible open={conversasOpen} onOpenChange={setConversasOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-lg">
              <span className="flex items-center gap-2 font-medium">
                <MessageSquare className="h-4 w-4" />
                Conversas
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                conversasOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-2 space-y-3">
              {/* Toggle filters */}
              <FilterSwitch
                label="Atribuídas a mim"
                checked={filters.assignedToMe}
                onCheckedChange={(v) => updateFilter("assignedToMe", v)}
                hasHelp
              />
              <FilterSwitch
                label="Não atribuídas"
                checked={filters.unassigned}
                onCheckedChange={(v) => updateFilter("unassigned", v)}
                hasHelp
              />
              <FilterSwitch
                label="Sem resposta do atendente"
                checked={filters.noAttendantResponse}
                onCheckedChange={(v) => updateFilter("noAttendantResponse", v)}
                hasHelp
              />
              <FilterSwitch
                label="Aguardando resposta do contato"
                checked={filters.waitingContactResponse}
                onCheckedChange={(v) => updateFilter("waitingContactResponse", v)}
                hasHelp
              />
              <FilterSwitch
                label="Em transferência"
                checked={filters.inTransfer}
                onCheckedChange={(v) => updateFilter("inTransfer", v)}
              />
              <FilterSwitch
                label="Lidas"
                checked={filters.read}
                onCheckedChange={(v) => updateFilter("read", v)}
              />
              <FilterSwitch
                label="Não lidas"
                checked={filters.unread}
                onCheckedChange={(v) => updateFilter("unread", v)}
              />
              <FilterSwitch
                label="Dentro da janela de conversa"
                checked={filters.insideWindow}
                onCheckedChange={(v) => updateFilter("insideWindow", v)}
                hasHelp
              />
              <FilterSwitch
                label="Fora da janela de conversa"
                checked={filters.outsideWindow}
                onCheckedChange={(v) => updateFilter("outsideWindow", v)}
                hasHelp
              />
              <FilterSwitch
                label="Suspensas"
                checked={filters.suspended}
                onCheckedChange={(v) => updateFilter("suspended", v)}
                hasHelp
              />

              {/* Date filter */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Data de criação do atendimento</Label>
                <DatePickerFilter
                  value={filters.createdAt}
                  onChange={(v) => updateFilter("createdAt", v)}
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Status da conversa</Label>
                <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Atendentes */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Atendentes</Label>
                <Select value={filters.assignedTo} onValueChange={(v) => updateFilter("assignedTo", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Setores */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Setores</Label>
                <Select value={filters.sectorId} onValueChange={(v) => updateFilter("sectorId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Negócios Section */}
          <Collapsible open={negociosOpen} onOpenChange={setNegociosOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-lg">
              <span className="flex items-center gap-2 font-medium">
                <Briefcase className="h-4 w-4" />
                Negócios
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                negociosOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-2 space-y-3">
              {/* Data */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Data</Label>
                <DatePickerFilter
                  value={filters.dealCreatedAt}
                  onChange={(v) => updateFilter("dealCreatedAt", v)}
                />
              </div>

              {/* Com/sem negócio */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Com/sem negócio</Label>
                <Select value={filters.hasDeal} onValueChange={(v) => updateFilter("hasDeal", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="with">Com negócio</SelectItem>
                    <SelectItem value="without">Sem negócio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Negócio com status */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Negócio com status</Label>
                <Select value={filters.dealStatus} onValueChange={(v) => updateFilter("dealStatus", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="won">Ganho</SelectItem>
                    <SelectItem value="lost">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dono do negócio */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Dono do negócio</Label>
                <Select value={filters.dealOwner} onValueChange={(v) => updateFilter("dealOwner", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Negócio nos grupos */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Negócio nos grupos</Label>
                <Select value={filters.dealGroup} onValueChange={(v) => updateFilter("dealGroup", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {originGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Negócio nas origens */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Negócio nas origens</Label>
                <Select value={filters.dealOrigin} onValueChange={(v) => updateFilter("dealOrigin", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {origins.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Negócio nas etapas */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Negócio nas etapas</Label>
                <Select value={filters.dealStage} onValueChange={(v) => updateFilter("dealStage", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Contatos Section */}
          <Collapsible open={contatosOpen} onOpenChange={setContatosOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-lg">
              <span className="flex items-center gap-2 font-medium">
                <Users className="h-4 w-4" />
                Contatos
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                contatosOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-2 space-y-3">
              {/* Tags */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Tags</Label>
                <Select value={filters.tags[0] || ""} onValueChange={(v) => updateFilter("tags", v ? [v] : [])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Canais Section */}
          <Collapsible open={canaisOpen} onOpenChange={setCanaisOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-lg">
              <span className="flex items-center gap-2 font-medium">
                <Smartphone className="h-4 w-4" />
                Canais
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                canaisOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-2 space-y-3">
              {/* Canais e Dispositivos */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Canais e Dispositivos</Label>
                <Select value={filters.instanceId} onValueChange={(v) => updateFilter("instanceId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Footer */}
      {activeFiltersCount > 0 && (
        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={clearFilters}>
            Limpar filtros ({activeFiltersCount})
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper components
interface FilterSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hasHelp?: boolean;
}

function FilterSwitch({ label, checked, onCheckedChange, hasHelp }: FilterSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <Label className="flex items-center gap-1 text-sm cursor-pointer">
        {label}
        {hasHelp && <HelpCircle className="h-3 w-3 text-muted-foreground" />}
      </Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface DatePickerFilterProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
}

function DatePickerFilter({ value, onChange }: DatePickerFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(undefined)}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Default filters state
export const defaultFilters: ConversationFiltersData = {
  assignedToMe: false,
  unassigned: false,
  noAttendantResponse: false,
  waitingContactResponse: false,
  inTransfer: false,
  read: false,
  unread: false,
  insideWindow: false,
  outsideWindow: false,
  suspended: false,
  createdAt: undefined,
  status: "",
  assignedTo: "",
  sectorId: "",
  dealCreatedAt: undefined,
  hasDeal: "",
  dealStatus: "",
  dealOwner: "",
  dealGroup: "",
  dealOrigin: "",
  dealStage: "",
  tags: [],
  instanceId: "",
};
