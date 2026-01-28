import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { COMPANY_SEGMENTS } from "@/data/companySegments";

interface Staff {
  id: string;
  name: string;
  role: string;
}

const OnboardingNewCompanyPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [csId, setCsId] = useState("");
  const [consultantId, setConsultantId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    checkPermissions();
    fetchStaff();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        navigate("/onboarding-tasks/login");
        return;
      }

      const { data: staffMember } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .single();

      // Only master, admin and CS can create companies (not consultant)
      if (staffMember && (staffMember.role === "master" || staffMember.role === "admin" || staffMember.role === "cs")) {
        setCanCreate(true);
      } else {
        toast.error("Você não tem permissão para criar empresas");
        navigate("/onboarding-tasks/companies");
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
      navigate("/onboarding-tasks/companies");
    } finally {
      setCheckingPermission(false);
    }
  };

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name, role")
      .eq("is_active", true)
      .order("name");

    if (data) {
      setStaffList(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .insert({
          name: name.trim(),
          segment: segment || null,
          website: website || null,
          phone: phone || null,
          email: email || null,
          cs_id: csId || null,
          consultant_id: consultantId || null,
          notes: notes || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast.success("Empresa criada com sucesso!");
      navigate(`/onboarding-tasks/companies/${data.id}`);
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error("Erro ao criar empresa");
    } finally {
      setLoading(false);
    }
  };

  if (checkingPermission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canCreate) {
    return null;
  }

  const csList = staffList.filter((s) => s.role === "cs" || s.role === "admin" || s.role === "master");
  const consultantList = staffList.filter((s) => s.role === "consultant" || s.role === "admin" || s.role === "cs" || s.role === "master");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks/companies")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Nova Empresa</h1>
            <p className="text-muted-foreground">Cadastre uma nova empresa para onboarding</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Empresa ABC Ltda"
                  required
                />
              </div>

              {/* Segmento */}
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SEGMENTS.map((seg) => (
                      <SelectItem key={seg} value={seg}>
                        {seg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grid 2 colunas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@empresa.com"
                  />
                </div>
              </div>

              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.empresa.com.br"
                />
              </div>

              {/* CS e Consultor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CS Responsável</Label>
                  <Select value={csId} onValueChange={setCsId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o CS" />
                    </SelectTrigger>
                    <SelectContent>
                      {csList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Consultor</Label>
                  <Select value={consultantId} onValueChange={setConsultantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o Consultor" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultantList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre a empresa..."
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/onboarding-tasks/companies")}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Empresa
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingNewCompanyPage;
