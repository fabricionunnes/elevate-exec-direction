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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Route, CheckCircle2, AlertCircle } from "lucide-react";

interface Cohort {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  is_enrollment_open: boolean;
}

const COMMITMENT_OPTIONS = [
  { value: "sim_totalmente", label: "Sim, me comprometo totalmente" },
  { value: "sim_vou_tentar", label: "Sim, vou me esforçar ao máximo" },
  { value: "parcialmente", label: "Parcialmente, tenho algumas limitações" },
  { value: "nao_tenho_certeza", label: "Não tenho certeza" },
];

const READINESS_OPTIONS = [
  { value: "muito_preparado", label: "Estou muito preparado(a) e motivado(a)" },
  { value: "preparado", label: "Estou preparado(a)" },
  { value: "tenho_duvidas", label: "Tenho dúvidas mas quero tentar" },
  { value: "nao_sei", label: "Não sei se é o momento certo" },
];

const TIME_OPTIONS = [
  { value: "mais_10h", label: "Mais de 10 horas por semana" },
  { value: "5_10h", label: "Entre 5 e 10 horas por semana" },
  { value: "2_5h", label: "Entre 2 e 5 horas por semana" },
  { value: "menos_2h", label: "Menos de 2 horas por semana" },
];

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  role_title: string;
  company: string;
  experience_years: string;
  professional_goal: string;
  current_challenges: string;
  motivation: string;
  leadership_level: string;
  commitment_meetings: string;
  commitment_books: string;
  commitment_tasks: string;
  commitment_camera: string;
  development_readiness: string;
  biggest_weakness: string;
  time_availability: string;
  previous_training: string;
  expectations: string;
}

const INITIAL_FORM: FormData = {
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
  commitment_meetings: "",
  commitment_books: "",
  commitment_tasks: "",
  commitment_camera: "",
  development_readiness: "",
  biggest_weakness: "",
  time_availability: "",
  previous_training: "",
  expectations: "",
};

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="flex items-center gap-1">
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

function CommitmentRadio({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  return (
    <div className={`space-y-2 p-4 rounded-lg border ${error ? "border-destructive bg-destructive/5" : "border-border"}`}>
      <RequiredLabel>{label}</RequiredLabel>
      <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
        {COMMITMENT_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <RadioGroupItem value={opt.value} id={`${label}-${opt.value}`} />
            <Label htmlFor={`${label}-${opt.value}`} className="font-normal cursor-pointer">
              {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export default function PDIEnrollmentPage() {
  const { token } = useParams<{ token: string }>();
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, boolean>>>({});

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

  const validate = (): boolean => {
    const required: (keyof FormData)[] = [
      "full_name", "email", "phone", "role_title", "company",
      "experience_years", "professional_goal", "current_challenges",
      "motivation", "leadership_level",
      "commitment_meetings", "commitment_books", "commitment_tasks",
      "commitment_camera", "development_readiness",
      "biggest_weakness", "time_availability", "previous_training", "expectations",
    ];
    const newErrors: Partial<Record<keyof FormData, boolean>> = {};
    let valid = true;
    for (const key of required) {
      if (!form[key]?.trim()) {
        newErrors[key] = true;
        valid = false;
      }
    }
    setErrors(newErrors);
    if (!valid) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
    }
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate() || !cohort) return;

    setSaving(true);
    const { error } = await supabase.from("pdi_applications").insert({
      cohort_id: cohort.id,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role_title: form.role_title.trim(),
      company: form.company.trim(),
      experience_years: parseInt(form.experience_years) || 0,
      professional_goal: form.professional_goal.trim(),
      current_challenges: form.current_challenges.trim(),
      motivation: form.motivation.trim(),
      leadership_level: form.leadership_level,
      commitment_meetings: form.commitment_meetings,
      commitment_books: form.commitment_books,
      commitment_tasks: form.commitment_tasks,
      commitment_camera: form.commitment_camera,
      development_readiness: form.development_readiness,
      biggest_weakness: form.biggest_weakness.trim(),
      time_availability: form.time_availability,
      previous_training: form.previous_training.trim(),
      expectations: form.expectations.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao enviar inscrição");
      return;
    }
    setSubmitted(true);
  };

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: false }));
  };

  const inputClass = (key: keyof FormData) =>
    errors[key] ? "border-destructive" : "";

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
        {/* Header */}
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Route className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{cohort.name}</h1>
          {cohort.description && <p className="text-sm text-muted-foreground mt-1">{cohort.description}</p>}
          {cohort.objective && <p className="text-sm text-muted-foreground mt-1"><strong>Objetivo:</strong> {cohort.objective}</p>}
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Todos os campos são obrigatórios. Preencha com atenção.
        </div>

        {/* Dados Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel>Nome Completo</RequiredLabel>
              <Input className={inputClass("full_name")} value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <RequiredLabel>Email</RequiredLabel>
                <Input className={inputClass("email")} type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="seu@email.com" />
              </div>
              <div>
                <RequiredLabel>Telefone / WhatsApp</RequiredLabel>
                <Input className={inputClass("phone")} value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <RequiredLabel>Cargo Atual</RequiredLabel>
                <Input className={inputClass("role_title")} value={form.role_title} onChange={(e) => updateField("role_title", e.target.value)} placeholder="Ex: Gerente Comercial" />
              </div>
              <div>
                <RequiredLabel>Empresa</RequiredLabel>
                <Input className={inputClass("company")} value={form.company} onChange={(e) => updateField("company", e.target.value)} placeholder="Nome da empresa" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <RequiredLabel>Tempo de Experiência (anos)</RequiredLabel>
                <Input className={inputClass("experience_years")} type="number" min="0" value={form.experience_years} onChange={(e) => updateField("experience_years", e.target.value)} placeholder="Ex: 5" />
              </div>
              <div>
                <RequiredLabel>Nível de Liderança</RequiredLabel>
                <Select value={form.leadership_level} onValueChange={(v) => updateField("leadership_level", v)}>
                  <SelectTrigger className={inputClass("leadership_level")}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Iniciante</SelectItem>
                    <SelectItem value="intermediate">Intermediário</SelectItem>
                    <SelectItem value="advanced">Avançado</SelectItem>
                    <SelectItem value="expert">Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Perfil Profissional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Perfil Profissional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel>Qual seu principal objetivo profissional?</RequiredLabel>
              <Textarea className={inputClass("professional_goal")} value={form.professional_goal} onChange={(e) => updateField("professional_goal", e.target.value)} placeholder="Descreva onde quer chegar profissionalmente..." rows={3} />
            </div>
            <div>
              <RequiredLabel>Quais seus maiores desafios atuais?</RequiredLabel>
              <Textarea className={inputClass("current_challenges")} value={form.current_challenges} onChange={(e) => updateField("current_challenges", e.target.value)} placeholder="Quais obstáculos enfrenta no dia a dia..." rows={3} />
            </div>
            <div>
              <RequiredLabel>Qual seu maior ponto fraco como líder/profissional?</RequiredLabel>
              <Textarea className={inputClass("biggest_weakness")} value={form.biggest_weakness} onChange={(e) => updateField("biggest_weakness", e.target.value)} placeholder="Seja honesto(a), isso nos ajuda a direcionar seu desenvolvimento..." rows={3} />
            </div>
            <div>
              <RequiredLabel>Já participou de treinamentos/programas de desenvolvimento antes? Quais?</RequiredLabel>
              <Textarea className={inputClass("previous_training")} value={form.previous_training} onChange={(e) => updateField("previous_training", e.target.value)} placeholder="Descreva experiências anteriores ou escreva 'Nenhum'..." rows={3} />
            </div>
            <div>
              <RequiredLabel>Por que deseja participar deste programa de desenvolvimento?</RequiredLabel>
              <Textarea className={inputClass("motivation")} value={form.motivation} onChange={(e) => updateField("motivation", e.target.value)} placeholder="O que te motivou a se inscrever..." rows={3} />
            </div>
            <div>
              <RequiredLabel>O que você espera ao final do programa?</RequiredLabel>
              <Textarea className={inputClass("expectations")} value={form.expectations} onChange={(e) => updateField("expectations", e.target.value)} placeholder="Quais resultados concretos espera alcançar..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Comprometimento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compromisso e Disponibilidade</CardTitle>
            <p className="text-sm text-muted-foreground">
              O PDI exige dedicação real. Responda com honestidade para que possamos avaliar se este é o momento certo para você.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`space-y-2 p-4 rounded-lg border ${errors.development_readiness ? "border-destructive bg-destructive/5" : "border-border"}`}>
              <RequiredLabel>Você se considera preparado(a) para passar por um processo intenso de desenvolvimento pessoal e profissional?</RequiredLabel>
              <RadioGroup value={form.development_readiness} onValueChange={(v) => updateField("development_readiness", v)} className="space-y-2">
                {READINESS_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`readiness-${opt.value}`} />
                    <Label htmlFor={`readiness-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <CommitmentRadio
              label="Você se compromete a participar de TODAS as reuniões agendadas do programa?"
              value={form.commitment_meetings}
              onChange={(v) => updateField("commitment_meetings", v)}
              error={errors.commitment_meetings}
            />

            <CommitmentRadio
              label="Você se compromete a ler TODOS os livros e materiais solicitados?"
              value={form.commitment_books}
              onChange={(v) => updateField("commitment_books", v)}
              error={errors.commitment_books}
            />

            <CommitmentRadio
              label="Você se compromete a realizar TODAS as tarefas e exercícios propostos dentro dos prazos?"
              value={form.commitment_tasks}
              onChange={(v) => updateField("commitment_tasks", v)}
              error={errors.commitment_tasks}
            />

            <CommitmentRadio
              label="Você se compromete a entrar nas reuniões com a câmera aberta?"
              value={form.commitment_camera}
              onChange={(v) => updateField("commitment_camera", v)}
              error={errors.commitment_camera}
            />

            <div className={`space-y-2 p-4 rounded-lg border ${errors.time_availability ? "border-destructive bg-destructive/5" : "border-border"}`}>
              <RequiredLabel>Quantas horas por semana você pode dedicar ao programa (fora das reuniões)?</RequiredLabel>
              <RadioGroup value={form.time_availability} onValueChange={(v) => updateField("time_availability", v)} className="space-y-2">
                {TIME_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`time-${opt.value}`} />
                    <Label htmlFor={`time-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
          {saving ? "Enviando..." : "Enviar Inscrição"}
        </Button>
      </div>
    </div>
  );
}
