import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, Building2, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DistratoFormData {
  companyId: string;
  companyName: string;
  companyCnpj: string;
  companyAddress: string;
  legalRepName: string;
  projectId: string;
  projectName: string;
  contractDate: string;
  serviceDescription: string;
  distratoDate: Date;
  additionalNotes: string;
}

interface CompanyResult {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  address_city: string | null;
  address_state: string | null;
  address_neighborhood: string | null;
  address_number: string | null;
  address_zipcode: string | null;
}

interface ProjectResult {
  id: string;
  product_name: string;
  product_id: string;
  status: string;
  created_at: string;
}

interface DistratoFormProps {
  formData: DistratoFormData;
  onChange: (data: DistratoFormData) => void;
  preSelectedCompanyId?: string;
  preSelectedProjectId?: string;
}

export const defaultDistrato: DistratoFormData = {
  companyId: "",
  companyName: "",
  companyCnpj: "",
  companyAddress: "",
  legalRepName: "",
  projectId: "",
  projectName: "",
  contractDate: "",
  serviceDescription: "",
  distratoDate: new Date(),
  additionalNotes: "",
};

function formatCompanyAddress(c: CompanyResult): string {
  const parts = [c.address, c.address_number, c.address_neighborhood, c.address_city, c.address_state].filter(Boolean);
  if (c.address_zipcode) parts.push(`CEP ${c.address_zipcode}`);
  return parts.join(", ") || "";
}

export default function DistratoForm({ formData, onChange, preSelectedCompanyId, preSelectedProjectId }: DistratoFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [stakeholders, setStakeholders] = useState<any[]>([]);

  const searchCompanies = useCallback(async (query: string) => {
    if (query.length < 2) { setCompanies([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select("id, name, cnpj, address, address_city, address_state, address_neighborhood, address_number, address_zipcode")
        .ilike("name", `%${query}%`)
        .limit(10);
      if (error) throw error;
      setCompanies(data || []);
      setShowResults(true);
    } catch {
      toast.error("Erro ao buscar empresas");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery) searchCompanies(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCompanies]);

  // Auto-load if pre-selected
  useEffect(() => {
    if (preSelectedCompanyId && !formData.companyId) {
      loadCompanyById(preSelectedCompanyId);
    }
  }, [preSelectedCompanyId]);

  useEffect(() => {
    if (preSelectedProjectId && formData.companyId && projects.length > 0) {
      const proj = projects.find(p => p.id === preSelectedProjectId);
      if (proj) selectProject(proj);
    }
  }, [preSelectedProjectId, projects]);

  const loadCompanyById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select("id, name, cnpj, address, address_city, address_state, address_neighborhood, address_number, address_zipcode, stakeholders, contract_start_date")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (data) selectCompany(data);
    } catch {
      toast.error("Erro ao carregar empresa");
    }
  };

  const selectCompany = async (company: CompanyResult & { stakeholders?: any; contract_start_date?: string }) => {
    const address = formatCompanyAddress(company);
    
    // Get stakeholders for legal rep
    let repName = "";
    if (company.stakeholders) {
      try {
        const sArr = typeof company.stakeholders === "string" ? JSON.parse(company.stakeholders) : company.stakeholders;
        setStakeholders(Array.isArray(sArr) ? sArr : []);
        if (Array.isArray(sArr) && sArr.length > 0) {
          repName = sArr[0].name || sArr[0].nome || "";
        }
      } catch { /* ignore */ }
    }

    onChange({
      ...formData,
      companyId: company.id,
      companyName: company.name,
      companyCnpj: company.cnpj || "",
      companyAddress: address,
      legalRepName: repName,
      contractDate: (company as any).contract_start_date || "",
    });

    setShowResults(false);
    setSearchQuery(company.name);

    // Fetch projects for this company
    const { data: projs } = await supabase
      .from("onboarding_projects")
      .select("id, product_name, product_id, status, created_at")
      .eq("onboarding_company_id", company.id)
      .order("created_at", { ascending: false });
    setProjects(projs || []);
  };

  const selectProject = (proj: ProjectResult) => {
    onChange({
      ...formData,
      projectId: proj.id,
      projectName: proj.product_name,
      serviceDescription: proj.product_name,
    });
  };

  const update = (field: keyof DistratoFormData, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Company Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Empresa (Contratante)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Label>Buscar Empresa</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome da empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
            </div>
            {showResults && companies.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-2 hover:bg-muted text-sm"
                    onClick={() => selectCompany(c)}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.cnpj && <span className="text-muted-foreground ml-2">({c.cnpj})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {formData.companyId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Razão Social / Nome</Label>
                <Input value={formData.companyName} onChange={(e) => update("companyName", e.target.value)} />
              </div>
              <div>
                <Label>CNPJ / CPF</Label>
                <Input value={formData.companyCnpj} onChange={(e) => update("companyCnpj", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço</Label>
                <Input value={formData.companyAddress} onChange={(e) => update("companyAddress", e.target.value)} />
              </div>
              <div>
                <Label>Representante Legal</Label>
                <Input value={formData.legalRepName} onChange={(e) => update("legalRepName", e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Selection */}
      {formData.companyId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Projeto / Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Projeto a ser encerrado</Label>
              <Select value={formData.projectId} onValueChange={(val) => {
                const proj = projects.find(p => p.id === val);
                if (proj) selectProject(proj);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto..." />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name} ({p.status === "active" ? "Ativo" : p.status === "closed" ? "Encerrado" : p.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data do Contrato Original</Label>
                <Input
                  placeholder="dd/mm/aaaa"
                  value={formData.contractDate}
                  maxLength={10}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                    if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
                    if (v.length > 10) v = v.slice(0, 10);
                    update("contractDate", v);
                  }}
                />
              </div>
              <div>
                <Label>Descrição do Serviço</Label>
                <Input
                  value={formData.serviceDescription}
                  onChange={(e) => update("serviceDescription", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Data do Distrato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.distratoDate, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background">
                  <Calendar
                    mode="single"
                    selected={formData.distratoDate}
                    onSelect={(d) => d && update("distratoDate", d)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
