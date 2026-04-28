import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, User, FileText, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { roleLabels } from "@/data/employeeContractTemplate";
import { CurrencyInput } from "@/components/ui/currency-input";

export interface EmployeeContractFormData {
  staffId: string;
  staffName: string;
  staffRole: string;
  staffEmail: string;
  staffPhone: string;
  staffCpf: string;
  staffCnpj: string;
  staffAddress: string;
  contractValue: number;
  paymentMethod: string;
  startDate: Date | undefined;
  durationMonths: number;
}

interface StaffOption {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  street: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  cep: string | null;
  city: string | null;
  state: string | null;
}

interface EmployeeContractFormProps {
  formData: EmployeeContractFormData;
  onChange: (data: EmployeeContractFormData) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export const defaultEmployeeFormData: EmployeeContractFormData = {
  staffId: "",
  staffName: "",
  staffRole: "",
  staffEmail: "",
  staffPhone: "",
  staffCpf: "",
  staffCnpj: "",
  staffAddress: "",
  contractValue: 0,
  paymentMethod: "boleto",
  startDate: new Date(),
  durationMonths: 3,
};

export default function EmployeeContractForm({
  formData,
  onChange,
  onGenerate,
  isGenerating,
}: EmployeeContractFormProps) {
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffSearchOpen, setStaffSearchOpen] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      let { data, error } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, email, phone, cpf, cnpj, street, address_number, complement, neighborhood, cep, city, state")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.warn("Full staff select failed, retrying with basic columns:", error);
        const fallback = await supabase
          .from("onboarding_staff")
          .select("id, name, role, email, phone")
          .eq("is_active", true)
          .order("name");
        if (fallback.error) throw fallback.error;
        data = fallback.data as any;
      }
      setStaffList(((data as any[]) || []).map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        email: s.email,
        phone: s.phone ?? null,
        cpf: s.cpf ?? null,
        cnpj: s.cnpj ?? null,
        street: s.street ?? null,
        address_number: s.address_number ?? null,
        complement: s.complement ?? null,
        neighborhood: s.neighborhood ?? null,
        cep: s.cep ?? null,
        city: s.city ?? null,
        state: s.state ?? null,
      })));
    } catch (err) {
      console.error("Error loading staff:", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const buildAddress = (s: StaffOption): string => {
    const parts: string[] = [];
    if (s.street) parts.push(s.address_number ? `${s.street}, ${s.address_number}` : s.street);
    if (s.complement) parts.push(s.complement);
    if (s.neighborhood) parts.push(s.neighborhood);
    if (s.cep) parts.push(`CEP ${s.cep}`);
    const cityState = [s.city, s.state].filter(Boolean).join("-");
    if (cityState) parts.push(cityState);
    return parts.join(", ");
  };

  const handleStaffSelect = (staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (staff) {
      onChange({
        ...formData,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        staffEmail: staff.email,
        staffPhone: staff.phone || "",
        staffCpf: staff.cpf || "",
        staffCnpj: staff.cnpj || "",
        staffAddress: buildAddress(staff),
      });
      setStaffSearchOpen(false);
    }
  };

  const selectedStaff = staffList.find((s) => s.id === formData.staffId);

  const update = (field: keyof EmployeeContractFormData, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  const isSdrTerceirizado = formData.staffRole === "sdr_terceirizado";

  const isValid =
    formData.staffName &&
    formData.staffRole &&
    formData.staffCpf &&
    (isSdrTerceirizado || formData.contractValue > 0) &&
    formData.startDate;

  return (
    <div className="space-y-4">
      {/* Colaborador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Colaborador (Contratada)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Selecionar Colaborador</Label>
            <Popover open={staffSearchOpen} onOpenChange={setStaffSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={staffSearchOpen}
                  className="w-full justify-between font-normal"
                >
                  {loadingStaff
                    ? "Carregando..."
                    : selectedStaff
                      ? `${selectedStaff.name} — ${roleLabels[selectedStaff.role] || selectedStaff.role}`
                      : "Pesquisar colaborador..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command className="rounded-lg border shadow-md">
                  <CommandInput placeholder="Pesquisar por nome..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {staffList.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`${s.name} ${roleLabels[s.role] || s.role}`}
                          onSelect={() => handleStaffSelect(s.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.staffId === s.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {s.name} — {roleLabels[s.role] || s.role}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome Completo</Label>
              <Input
                value={formData.staffName}
                onChange={(e) => update("staffName", e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>Cargo / Função</Label>
              <Select value={formData.staffRole} onValueChange={(v) => update("staffRole", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>CPF</Label>
              <Input
                value={formData.staffCpf}
                onChange={(e) => update("staffCpf", e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label>CNPJ (PJ)</Label>
              <Input
                value={formData.staffCnpj}
                onChange={(e) => update("staffCnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>E-mail</Label>
              <Input
                value={formData.staffEmail}
                onChange={(e) => update("staffEmail", e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.staffPhone}
                onChange={(e) => update("staffPhone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div>
            <Label>Endereço Completo</Label>
            <Input
              value={formData.staffAddress}
              onChange={(e) => update("staffAddress", e.target.value)}
              placeholder="Rua, nº, Bairro, CEP, Cidade-UF"
            />
          </div>
        </CardContent>
      </Card>

      {/* Condições */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Condições do Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>
                {isSdrTerceirizado
                  ? "Valor Mensal Estimado (R$) — opcional, remuneração é variável por cliente ativo"
                  : "Valor Mensal (R$)"}
              </Label>
              <CurrencyInput
                value={formData.contractValue}
                onChange={(v) => update("contractValue", v)}
              />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={formData.paymentMethod} onValueChange={(v) => update("paymentMethod", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !formData.startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? format(formData.startDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.startDate}
                    onSelect={(d) => update("startDate", d)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Duração (meses)</Label>
              <Select value={String(formData.durationMonths)} onValueChange={(v) => update("durationMonths", Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onGenerate} disabled={!isValid || isGenerating} className="w-full" size="lg">
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Gerando Contrato...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Gerar Contrato de Colaborador
          </>
        )}
      </Button>
    </div>
  );
}
