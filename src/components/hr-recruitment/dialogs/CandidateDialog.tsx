import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Upload, FileText, X } from "lucide-react";
interface JobOption {
  id: string;
  title: string;
}

interface CandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  jobs: JobOption[];
  isStaff: boolean;
  onSuccess: () => void;
}

export function CandidateDialog({
  open,
  onOpenChange,
  projectId,
  jobs,
  isStaff,
  onSuccess,
}: CandidateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    linkedin_url: "",
    job_opening_id: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        cpf: "",
        linkedin_url: "",
        job_opening_id: "",
        notes: "",
      });
      setResumeFile(null);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        toast.error("Formato inválido. Use PDF ou DOC/DOCX");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB");
        return;
      }
      setResumeFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.full_name.trim() || !formData.email.trim()) {
      toast.error("Preencha nome e email");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Usuário não autenticado");
        setLoading(false);
        return;
      }

      let staffId = null;
      let userId = null;

      // Try to get staff ID first (for staff users)
      if (isStaff) {
        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        
        if (!staffError && staff) {
          staffId = staff.id;
        }
      }
      
      // Get user ID for client users (onboarding_users does NOT have is_active column)
      if (!isStaff) {
        const { data: onbUser, error: userError } = await supabase
          .from("onboarding_users")
          .select("id")
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .maybeSingle();
        
        if (!userError && onbUser) {
          userId = onbUser.id;
        }
      }

      // Create candidate with the available IDs
      const candidatePayload = {
        project_id: projectId,
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || null,
        cpf: formData.cpf || null,
        linkedin_url: formData.linkedin_url || null,
        job_opening_id: formData.job_opening_id || null,
        notes: formData.notes || null,
        source: isStaff ? 'hr' : 'client',
        current_stage: 'received',
        status: 'active',
        created_by_staff_id: staffId,
        created_by_user_id: userId,
      };

      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert(candidatePayload)
        .select()
        .single();

      if (candidateError) {
        console.error("Error creating candidate:", candidateError);
        if (candidateError.code === '42501' || candidateError.message?.includes('row-level security')) {
          toast.error("Sem permissão para cadastrar candidato neste projeto");
        } else {
          toast.error(`Erro ao cadastrar: ${candidateError.message}`);
        }
        setLoading(false);
        return;
      }

      // Upload resume if provided
      if (resumeFile && candidate) {
        const fileExt = resumeFile.name.split('.').pop();
        const filePath = `${projectId}/${candidate.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, resumeFile);

        if (uploadError) {
          console.error("Error uploading resume:", uploadError);
          toast.error("Candidato criado, mas erro ao enviar currículo");
        } else {
          await supabase.from("candidate_resumes").insert({
            candidate_id: candidate.id,
            file_name: resumeFile.name,
            file_url: filePath,
            file_type: fileExt,
            file_size: resumeFile.size,
            is_primary: true,
            uploaded_by_staff_id: staffId,
            uploaded_by_user_id: userId,
          });
        }
      }

      // Add history entry (using try-catch to not fail the whole operation)
      try {
        await supabase.from("hiring_history").insert({
          candidate_id: candidate.id,
          action: 'created',
          new_value: 'received',
          description: `Candidato cadastrado via ${isStaff ? 'RH' : 'cliente'}`,
          performed_by_staff_id: staffId,
          performed_by_user_id: userId,
        });
      } catch (historyError) {
        console.error("Error adding history:", historyError);
        // Non-critical error, don't show to user
      }

      toast.success("Candidato cadastrado com sucesso!");
      onSuccess();
    } catch (error: any) {
      console.error("Error creating candidate:", error);
      toast.error(error.message || "Erro ao cadastrar candidato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isStaff ? "Novo Candidato" : "Enviar Currículo"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nome do candidato"
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>LinkedIn</Label>
            <Input
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          {jobs.length > 0 && (
            <div className="space-y-2">
              <Label>Vaga</Label>
              <Select
                value={formData.job_opening_id}
                onValueChange={(value) => setFormData({ ...formData, job_opening_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma vaga (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resume Upload */}
          <div className="space-y-2">
            <Label>Currículo</Label>
            {resumeFile ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
                <span className="flex-1 truncate text-sm">{resumeFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setResumeFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para enviar PDF ou DOC
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
