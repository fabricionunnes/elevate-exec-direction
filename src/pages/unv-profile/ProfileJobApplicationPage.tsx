import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Briefcase, MapPin, DollarSign, FileText, Upload, CheckCircle2,
  Building2, GraduationCap, FileCheck, Loader2, Phone, Mail, User, Linkedin,
} from "lucide-react";
import confetti from "canvas-confetti";

interface ProfileJob {
  id: string;
  tenant_id: string | null;
  title: string;
  area: string | null;
  seniority: string | null;
  contract_model: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  requirements: string | null;
  city: string | null;
  state: string | null;
  is_remote: boolean;
}

const SENIORITY_LABELS: Record<string, string> = {
  estagio: "Estágio", junior: "Júnior", pleno: "Pleno", senior: "Sênior",
  especialista: "Especialista", lideranca: "Liderança",
};

const fmtMoney = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function ProfileJobApplicationPage() {
  const { token } = useParams<{ token: string }>();

  const [job, setJob] = useState<ProfileJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  useEffect(() => {
    if (token) fetchJob();
    else setLoading(false);
  }, [token]);

  const fetchJob = async () => {
    const { data, error } = await supabase
      .from("profile_jobs")
      .select("id,tenant_id,title,area,seniority,contract_model,salary_min,salary_max,description,requirements,city,state,is_remote")
      .eq("public_token", token)
      .eq("status", "open")
      .maybeSingle();

    if (error || !data) {
      console.error("Error fetching job:", error);
      setJob(null);
    } else {
      setJob(data as ProfileJob);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = [
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png", "image/jpg",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato inválido. Envie PDF, Word ou imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }
    setResumeFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !fullName.trim() || !email.trim() || !phone.trim() || !resumeFile) {
      toast.error("Preencha nome, e-mail, telefone e currículo");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("E-mail inválido");
      return;
    }

    setSubmitting(true);
    try {
      // Upload do currículo (bucket público "resumes")
      const fileExt = resumeFile.name.split(".").pop();
      const fileName = `profile/${job.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("resumes").upload(fileName, resumeFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("profile_candidates").insert({
        tenant_id: job.tenant_id,
        job_id: job.id,
        full_name: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        cpf: cpf.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        linkedin_url: linkedin.trim() || null,
        cover_letter: coverLetter.trim() || null,
        resume_url: urlData.publicUrl,
        source: "public",
      });
      if (insertError) throw insertError;

      setSubmitted(true);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success("Candidatura enviada com sucesso!");
    } catch (err: any) {
      console.error("Error submitting application:", err);
      toast.error("Erro ao enviar candidatura. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Carregando vaga...</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vaga não encontrada</h2>
            <p className="text-muted-foreground">Esta vaga não está mais disponível ou o link está incorreto.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Candidatura Enviada!</h2>
            <p className="text-muted-foreground mb-4">
              Sua candidatura para a vaga de <strong>{job.title}</strong> foi enviada com sucesso.
            </p>
            <p className="text-sm text-muted-foreground">Entraremos em contato em breve pelo e-mail informado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const salary = job.salary_min || job.salary_max
    ? [job.salary_min ? fmtMoney(job.salary_min) : null, job.salary_max ? fmtMoney(job.salary_max) : null].filter(Boolean).join(" – ")
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{job.title}</CardTitle>
                <CardDescription className="mt-2 flex flex-wrap gap-2">
                  {job.area && <Badge variant="secondary">{job.area}</Badge>}
                  {job.seniority && <Badge variant="outline">{SENIORITY_LABELS[job.seniority] || job.seniority}</Badge>}
                </CardDescription>
              </div>
              <Briefcase className="h-10 w-10 text-primary flex-shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(job.is_remote || job.city) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{job.is_remote ? "Remoto" : `${job.city}${job.state ? "/" + job.state : ""}`}</span>
                </div>
              )}
              {job.contract_model && (
                <div className="flex items-center gap-2 text-sm">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                  <span>{job.contract_model}</span>
                </div>
              )}
              {job.seniority && (
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span>{SENIORITY_LABELS[job.seniority] || job.seniority}</span>
                </div>
              )}
              {salary && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{salary}</span>
                </div>
              )}
            </div>

            {job.description && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" />Descrição da Vaga</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
            {job.requirements && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2"><Building2 className="h-4 w-4" />Requisitos</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate-se</CardTitle>
            <CardDescription>Preencha seus dados e envie seu currículo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="flex items-center gap-2"><User className="h-4 w-4" />Nome Completo *</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2"><Mail className="h-4 w-4" />E-mail *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" />Telefone *</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2"><Linkedin className="h-4 w-4" />LinkedIn</Label>
                  <Input id="linkedin" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/voce" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="UF" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cover">Mensagem (opcional)</Label>
                <Textarea id="cover" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Conte por que você é a pessoa certa pra essa vaga" rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume" className="flex items-center gap-2"><Upload className="h-4 w-4" />Currículo * (PDF, Word ou Imagem)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input id="resume" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                  <label htmlFor="resume" className="cursor-pointer">
                    {resumeFile ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileCheck className="h-5 w-5" /><span>{resumeFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p>Clique para selecionar ou arraste seu arquivo</p>
                        <p className="text-xs mt-1">PDF, Word, JPG ou PNG (máx. 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting || !fullName || !email || !phone || !resumeFile}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Enviar Candidatura</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
