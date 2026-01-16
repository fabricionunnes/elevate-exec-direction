import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  DollarSign, 
  FileText,
  Upload,
  CheckCircle2,
  Building2,
  GraduationCap,
  FileCheck,
  Loader2,
  Phone,
  Mail,
  User
} from "lucide-react";
import confetti from "canvas-confetti";

interface JobOpening {
  id: string;
  title: string;
  area: string;
  job_type: string;
  description: string | null;
  requirements: string | null;
  differentials: string | null;
  seniority: string | null;
  contract_model: string | null;
  salary_range: string | null;
  location: string | null;
  is_remote: boolean;
  project_id: string;
}

const PublicJobApplicationPage = () => {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job");
  
  const [job, setJob] = useState<JobOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  useEffect(() => {
    if (jobId) {
      fetchJob();
    } else {
      setLoading(false);
    }
  }, [jobId]);

  const fetchJob = async () => {
    const { data, error } = await supabase
      .from("job_openings")
      .select("*")
      .eq("id", jobId)
      .eq("status", "open")
      .single();

    if (error || !data) {
      console.error("Error fetching job:", error);
      setJob(null);
    } else {
      setJob(data);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/jpg'
      ];
      
      if (!validTypes.includes(file.type)) {
        toast.error("Formato inválido. Envie PDF, Word ou imagem.");
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      
      setResumeFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!job || !fullName.trim() || !email.trim() || !phone.trim() || !resumeFile) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("E-mail inválido");
      return;
    }

    setSubmitting(true);

    try {
      // Check for duplicate application
      const { data: existingCandidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .eq("job_opening_id", job.id)
        .maybeSingle();

      if (existingCandidate) {
        toast.error("Você já se candidatou para esta vaga.");
        setSubmitting(false);
        return;
      }

      // Create candidate record
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          project_id: job.project_id,
          job_opening_id: job.id,
          full_name: fullName.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          source: "website",
          current_stage: "received",
          status: "active"
        })
        .select()
        .single();

      if (candidateError) throw candidateError;

      // Upload resume
      const fileExt = resumeFile.name.split('.').pop();
      const fileName = `${candidate.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(fileName, resumeFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("resumes")
        .getPublicUrl(fileName);

      // Create resume record
      const { error: resumeError } = await supabase
        .from("candidate_resumes")
        .insert({
          candidate_id: candidate.id,
          file_name: resumeFile.name,
          file_url: urlData.publicUrl,
          file_type: resumeFile.type,
          file_size: resumeFile.size,
          is_primary: true
        });

      if (resumeError) throw resumeError;

      // Success!
      setSubmitted(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success("Candidatura enviada com sucesso!");

    } catch (error) {
      console.error("Error submitting application:", error);
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

  if (!jobId || !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vaga não encontrada</h2>
            <p className="text-muted-foreground">
              Esta vaga não está mais disponível ou o link está incorreto.
            </p>
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
            <p className="text-sm text-muted-foreground">
              Entraremos em contato em breve através do e-mail informado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Job Details */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{job.title}</CardTitle>
                <CardDescription className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{job.area}</Badge>
                  <Badge variant="outline">{job.job_type}</Badge>
                  {job.seniority && <Badge variant="outline">{job.seniority}</Badge>}
                </CardDescription>
              </div>
              <Briefcase className="h-10 w-10 text-primary flex-shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quick Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {job.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{job.is_remote ? "Remoto" : job.location}</span>
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
                  <span>{job.seniority}</span>
                </div>
              )}
              {job.salary_range && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{job.salary_range}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {job.description && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Descrição da Vaga
                </h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </div>
            )}

            {/* Requirements */}
            {job.requirements && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Requisitos
                </h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
              </div>
            )}

            {/* Differentials */}
            {job.differentials && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Diferenciais
                </h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.differentials}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card>
          <CardHeader>
            <CardTitle>Candidate-se</CardTitle>
            <CardDescription>
              Preencha seus dados e envie seu currículo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nome Completo *
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone *
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Currículo * (PDF, Word ou Imagem)
                </Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                  <label htmlFor="resume" className="cursor-pointer">
                    {resumeFile ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileCheck className="h-5 w-5" />
                        <span>{resumeFile.name}</span>
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

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={submitting || !fullName || !email || !phone || !resumeFile}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Enviar Candidatura
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicJobApplicationPage;
