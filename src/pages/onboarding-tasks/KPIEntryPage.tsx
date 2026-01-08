import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Calendar, User, DollarSign, Percent, Hash, AlertCircle, Building2 } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  periodicity: string;
  target_value: number;
  is_required: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  access_code: string;
  company_id: string;
  unit_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

export default function KPIEntryPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [step, setStep] = useState<"auth" | "entry" | "success">("auth");
  const [accessCode, setAccessCode] = useState(codeFromUrl || "");
  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [values, setValues] = useState<Record<string, number>>({});
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingEntries, setExistingEntries] = useState<Record<string, number>>({});

  useEffect(() => {
    if (codeFromUrl) {
      handleAuthenticate();
    }
  }, [codeFromUrl]);

  const handleAuthenticate = async () => {
    if (!accessCode.trim()) {
      toast.error("Digite seu código de acesso");
      return;
    }

    setLoading(true);
    try {
      // Find salesperson by access code
      const { data: salespersonData, error: spError } = await supabase
        .from("company_salespeople")
        .select("*")
        .eq("access_code", accessCode.trim())
        .eq("company_id", companyId)
        .eq("is_active", true)
        .single();

      if (spError || !salespersonData) {
        toast.error("Código de acesso inválido");
        return;
      }

      setSalesperson(salespersonData);

      // Fetch company
      const { data: companyData } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("id", companyId)
        .single();

      setCompany(companyData);

      // Fetch units
      const { data: unitsData } = await supabase
        .from("company_units")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      setUnits(unitsData || []);
      
      // Set default unit if salesperson has one
      if (salespersonData.unit_id) {
        setSelectedUnit(salespersonData.unit_id);
      } else if (unitsData && unitsData.length > 0) {
        setSelectedUnit(unitsData[0].id);
      }
      // Fetch active KPIs
      const { data: kpisData, error: kpisError } = await supabase
        .from("company_kpis")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("sort_order");

      if (kpisError) throw kpisError;
      setKpis((kpisData || []) as KPI[]);

      // Initialize values
      const initialValues: Record<string, number> = {};
      kpisData?.forEach(kpi => {
        initialValues[kpi.id] = 0;
      });
      setValues(initialValues);

      // Check for existing entries today
      await fetchExistingEntries(salespersonData.id, entryDate);

      setStep("entry");
    } catch (error) {
      console.error("Error authenticating:", error);
      toast.error("Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingEntries = async (salespersonId: string, date: string) => {
    const { data } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("salesperson_id", salespersonId)
      .eq("entry_date", date);

    if (data && data.length > 0) {
      const entriesMap: Record<string, number> = {};
      data.forEach(entry => {
        entriesMap[entry.kpi_id] = entry.value;
      });
      setExistingEntries(entriesMap);
      setValues(prev => ({ ...prev, ...entriesMap }));
    } else {
      setExistingEntries({});
    }
  };

  const handleDateChange = async (newDate: string) => {
    setEntryDate(newDate);
    if (salesperson) {
      await fetchExistingEntries(salesperson.id, newDate);
    }
  };

  const handleSubmit = async () => {
    if (!salesperson) return;

    // Validate required fields - allow 0 as a valid value
    const requiredKpis = kpis.filter(k => k.is_required);
    for (const kpi of requiredKpis) {
      if (values[kpi.id] === undefined || values[kpi.id] === null || isNaN(values[kpi.id])) {
        toast.error(`O campo "${kpi.name}" é obrigatório`);
        return;
      }
    }

    setLoading(true);
    try {
      // Delete existing entries for this date/salesperson (upsert approach)
      await supabase
        .from("kpi_entries")
        .delete()
        .eq("salesperson_id", salesperson.id)
        .eq("entry_date", entryDate);

      // Insert new entries
      const entries = kpis.map(kpi => ({
        company_id: companyId,
        salesperson_id: salesperson.id,
        kpi_id: kpi.id,
        entry_date: entryDate,
        value: values[kpi.id] || 0,
        observations: observations,
        unit_id: selectedUnit || null,
      }));

      const { error } = await supabase.from("kpi_entries").insert(entries);

      if (error) throw error;

      setStep("success");
      toast.success("Lançamento realizado com sucesso!");
    } catch (error) {
      console.error("Error submitting entries:", error);
      toast.error("Erro ao salvar lançamento");
    } finally {
      setLoading(false);
    }
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-4 w-4 text-green-600" />;
      case "percentage": return <Percent className="h-4 w-4 text-blue-600" />;
      default: return <Hash className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatPlaceholder = (type: string) => {
    switch (type) {
      case "monetary": return "0,00";
      case "percentage": return "0";
      default: return "0";
    }
  };

  if (step === "auth") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Lançamento de Vendas</CardTitle>
            <CardDescription>Digite seu código de acesso para continuar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Código de Acesso</Label>
              <Input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Digite seu código"
                className="text-center text-lg tracking-widest"
                onKeyDown={(e) => e.key === "Enter" && handleAuthenticate()}
              />
            </div>
            <Button onClick={handleAuthenticate} className="w-full" disabled={loading}>
              {loading ? "Verificando..." : "Acessar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Lançamento Realizado!</h2>
            <p className="text-muted-foreground mb-6">
              Seus dados foram salvos com sucesso.
            </p>
            <div className="space-y-2">
              <Button onClick={() => {
                setValues({});
                setObservations("");
                setEntryDate(format(new Date(), "yyyy-MM-dd"));
                setStep("entry");
              }} className="w-full">
                Fazer Novo Lançamento
              </Button>
              <Button variant="outline" onClick={() => window.close()} className="w-full">
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lançamento de Vendas</CardTitle>
                <CardDescription>{company?.name}</CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1">
                <User className="h-3 w-3" />
                {salesperson?.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Selection */}
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data do Lançamento
              </Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
              {Object.keys(existingEntries).length > 0 && (
                <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  Já existe lançamento para esta data. Os valores serão atualizados.
                </p>
              )}
            </div>

            {/* Unit Selection */}
            {units.length > 0 && (
              <div>
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Unidade / Filial
                </Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* KPI Fields */}
            <div className="space-y-4">
              <Label>Indicadores</Label>
              {kpis.map(kpi => (
                <div key={kpi.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getKpiIcon(kpi.kpi_type)}
                    <Label className="font-medium">
                      {kpi.name}
                      {kpi.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {kpi.kpi_type === "monetary" && (
                      <span className="text-muted-foreground">R$</span>
                    )}
                    <Input
                      type="number"
                      step={kpi.kpi_type === "monetary" ? "0.01" : "1"}
                      min="0"
                      value={values[kpi.id] || ""}
                      onChange={(e) => setValues({ ...values, [kpi.id]: parseFloat(e.target.value) || 0 })}
                      placeholder={formatPlaceholder(kpi.kpi_type)}
                      className="flex-1"
                    />
                    {kpi.kpi_type === "percentage" && (
                      <span className="text-muted-foreground">%</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Meta: {kpi.kpi_type === "monetary" 
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(kpi.target_value)
                      : kpi.kpi_type === "percentage"
                      ? `${kpi.target_value}%`
                      : kpi.target_value.toLocaleString("pt-BR")
                    } ({kpi.periodicity === "daily" ? "diária" : kpi.periodicity === "weekly" ? "semanal" : "mensal"})
                  </p>
                </div>
              ))}
            </div>

            {/* Observations */}
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Adicione comentários sobre o dia..."
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
