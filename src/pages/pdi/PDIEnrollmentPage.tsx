import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Route, CheckCircle2 } from "lucide-react";

interface Cohort {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  is_enrollment_open: boolean;
}

export default function PDIEnrollmentPage() {
  const { token } = useParams<{ token: string }>();
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role_title: "",
    company: "",
    experience_years: "",
    professional_goal: "",
    current_challenges: "",
    motivation: "",
    leadership_level: "",
  });

  useEffect(() => {
    const fetchCohort = async () => {
      if (!token) return;
      const { data } = await supabase
        .from("pdi_cohorts")
        .select("id, name, description, objective, is_enrollment_open")
        .eq("enrollment_token", token)
        .maybeSingle();
      setCohort(data as Cohort | null);
      setLoading(false);
    };
    fetchCohort();
  }, [token]);

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    if (!cohort) return;

    setSaving(true);
    const { error } = await supabase.from("pdi_applications").insert({
      cohort_id: cohort.id,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      role_title: form.role_title || null,
      company: form.company || null,
      experience_years: form.experience_years ? parseInt(form.experience_years) : null,
      professional_goal: form.professional_goal || null,
      current_challenges: form.current_challenges || null,
      motivation: form.motivation || null,
      leadership_level: form.leadership_level || null,
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao enviar inscrição");
      return;
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Link de inscrição inválido ou expirado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cohort.is_enrollment_open) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Route className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-bold text-lg">{cohort.name}</h2>
            <p className="text-muted-foreground mt-2">As inscrições para esta turma estão encerradas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="font-bold text-xl text-foreground">Inscrição Enviada!</h2>
            <p className="text-muted-foreground mt-2">
              Sua inscrição para <strong>{cohort.name}</strong> foi recebida com sucesso. 
              Você será notificado sobre o resultado da avaliação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Route className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{cohort.name}</h1>
          {cohort.description && <p className="text-sm text-muted-foreground mt-1">{cohort.description}</p>}
          {cohort.objective && <p className="text-sm text-muted-foreground mt-1"><strong>Objetivo:</strong> {cohort.objective}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Formulário de Inscrição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Cargo Atual</Label>
                <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
              </div>
              <div>
                <Label>Empresa</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Tempo de Experiência (anos)</Label>
                <Input type="number" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} />
              </div>
              <div>
                <Label>Nível de Liderança</Label>
                <Select value={form.leadership_level} onValueChange={(v) => setForm({ ...form, leadership_level: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Iniciante</SelectItem>
                    <SelectItem value="intermediate">Intermediário</SelectItem>
                    <SelectItem value="advanced">Avançado</SelectItem>
                    <SelectItem value="expert">Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Objetivo Profissional</Label>
              <Textarea value={form.professional_goal} onChange={(e) => setForm({ ...form, professional_goal: e.target.value })} placeholder="Qual seu objetivo..." />
            </div>
            <div>
              <Label>Desafios Atuais</Label>
              <Textarea value={form.current_challenges} onChange={(e) => setForm({ ...form, current_challenges: e.target.value })} placeholder="Quais seus maiores desafios..." />
            </div>
            <div>
              <Label>Motivo para Participar do PDI</Label>
              <Textarea value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} placeholder="Por que deseja participar..." />
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
              {saving ? "Enviando..." : "Enviar Inscrição"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
