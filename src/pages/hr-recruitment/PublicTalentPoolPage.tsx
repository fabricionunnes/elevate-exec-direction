import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Upload,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
  User,
  FileCheck,
  Linkedin,
  Users,
  DollarSign,
  Calendar,
  Star,
  Sparkles
} from "lucide-react";
import confetti from "canvas-confetti";
import { JOB_AREAS } from "@/components/hr-recruitment/types";

const MASTER_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const PublicTalentPoolPage = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [discLink, setDiscLink] = useState<string | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [areaOfInterest, setAreaOfInterest] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file extension instead of MIME type for better compatibility
      const validExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
      const fileName = file.name.toLowerCase();
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!hasValidExtension) {
        toast.error("Formato inválido. Envie PDF, Word ou imagem.");
        return;
      }
      
      // 10MB limit
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        toast.error(`Arquivo muito grande (${fileSizeMB}MB). Máximo 10MB.`);
        return;
      }
      
      setResumeFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("E-mail inválido");
      return;
    }

    setSubmitting(true);

    try {
      // Check for duplicate
      const { data: existingCandidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .eq("current_stage", "talent_pool")
        .is("job_opening_id", null)
        .maybeSingle();

      if (existingCandidate) {
        toast.error("Você já está cadastrado no banco de talentos.");
        setSubmitting(false);
        return;
      }

      // Create candidate record
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          project_id: MASTER_PROJECT_ID,
          job_opening_id: null,
          full_name: fullName.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          cpf: cpf.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          expected_salary_range: expectedSalary.trim() || null,
          availability_date: availabilityDate || null,
          talent_pool_notes: `Área de interesse: ${areaOfInterest || "Não especificada"}\n${notes}`.trim() || null,
          source: "public_link",
          current_stage: "talent_pool",
          status: "active",
          talent_pool_added_at: new Date().toISOString()
        })
        .select()
        .single();

      if (candidateError) throw candidateError;

      // Upload resume if provided
      if (resumeFile) {
        const fileExt = resumeFile.name.split('.').pop();
        const fileName = `${MASTER_PROJECT_ID}/${candidate.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(fileName, resumeFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
        } else {
          await supabase
            .from("candidate_resumes")
            .insert({
              candidate_id: candidate.id,
              file_name: resumeFile.name,
              file_url: fileName,
              file_type: resumeFile.type,
              file_size: resumeFile.size,
              is_primary: true
            });
        }
      }

      // Create DISC test automatically
      const { data: discResult, error: discError } = await supabase
        .from("candidate_disc_results")
        .insert({
          candidate_id: candidate.id,
          status: "pending"
        })
        .select("access_token")
        .single();

      if (!discError && discResult) {
        const baseUrl = window.location.origin;
        setDiscLink(`${baseUrl}/#/hr-disc/${discResult.access_token}`);
      }

      // Success!
      setSubmitted(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success("Cadastro realizado com sucesso!");

    } catch (error) {
      console.error("Error submitting:", error);
      toast.error("Erro ao enviar cadastro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center border-primary/20">
          <CardContent className="p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Cadastro Realizado!</h2>
            <p className="text-muted-foreground mb-6">
              Você foi adicionado ao nosso banco de talentos. Entraremos em contato quando surgir uma oportunidade compatível com seu perfil.
            </p>
            
            {discLink && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-primary">Próximo Passo</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Complete seu perfil comportamental com o teste DISC. Isso nos ajuda a encontrar a oportunidade ideal para você!
                </p>
                <Button 
                  onClick={() => window.open(discLink, "_blank")}
                  className="w-full"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Fazer Teste DISC
                </Button>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Você pode fechar esta página ou fazer o teste DISC agora.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-primary/20 overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-8 w-8" />
              <CardTitle className="text-2xl">Banco de Talentos</CardTitle>
            </div>
            <CardDescription className="text-primary-foreground/80">
              Cadastre-se para fazer parte do nosso banco de talentos e receba oportunidades exclusivas
            </CardDescription>
          </div>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seus Dados</CardTitle>
            <CardDescription>
              Preencha suas informações para fazer parte do nosso banco de talentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
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

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone/WhatsApp *
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf" className="flex items-center gap-2">
                    CPF
                  </Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin" className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/seu-perfil"
                />
              </div>

              {/* Professional Info */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">Informações Profissionais</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area" className="flex items-center gap-2">
                      Área de Interesse
                    </Label>
                    <Select value={areaOfInterest} onValueChange={setAreaOfInterest}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma área" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_AREAS.map((area) => (
                          <SelectItem key={area} value={area}>{area}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salary" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Pretensão Salarial
                    </Label>
                    <Input
                      id="salary"
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      placeholder="Ex: R$ 5.000 - R$ 7.000"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="availability" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Disponibilidade para Início
                  </Label>
                  <Input
                    id="availability"
                    type="date"
                    value={availabilityDate}
                    onChange={(e) => setAvailabilityDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Resume Upload */}
              <div className="space-y-2">
                <Label htmlFor="resume" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Currículo (PDF, Word ou Imagem)
                </Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
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

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Observações ou Mensagem
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Conte-nos um pouco sobre você, suas experiências ou expectativas..."
                  rows={3}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={submitting || !fullName || !email || !phone}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Cadastrar no Banco de Talentos
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

export default PublicTalentPoolPage;
