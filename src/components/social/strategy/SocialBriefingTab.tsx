import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, Save, CheckCircle, Upload, FileText, Image as ImageIcon, 
  X, AlertCircle, Clock, Send, Link, Copy
} from "lucide-react";
import { toast } from "sonner";

interface SocialBriefingTabProps {
  projectId: string;
}

interface BriefingForm {
  id: string;
  access_token: string | null;
  company_since: string | null;
  mission_purpose: string | null;
  founding_story: string | null;
  products_services: string | null;
  flagship_products: string | null;
  unique_differentiator: string | null;
  exclusive_products: string | null;
  customer_experience: string | null;
  ideal_customer: string | null;
  customer_concerns: string | null;
  customer_goals: string | null;
  brand_perception: string | null;
  what_not_to_communicate: string | null;
  social_media_objectives: string | null;
  non_negotiables: string | null;
  profile_gaps: string | null;
  reference_profiles: string | null;
  direct_competitors: string | null;
  instagram_access: string | null;
  facebook_access: string | null;
  additional_info: string | null;
  status: string | null;
  submitted_at: string | null;
  approved_at: string | null;
}

interface BriefingUpload {
  id: string;
  file_type: string;
  file_name: string;
  file_url: string;
}

const QUESTIONS = [
  { key: "company_since", label: "Desde quando a empresa está em funcionamento?", required: true },
  { key: "mission_purpose", label: "Qual é a missão ou propósito por trás do negócio?", required: true, multiline: true },
  { key: "founding_story", label: "Existe alguma história interessante por trás da fundação da empresa?", required: true, multiline: true },
  { key: "products_services", label: "Quais são os serviços/produtos oferecidos?", required: true, multiline: true },
  { key: "flagship_products", label: "Existe um ou mais serviços/produtos carro-chefe ou que deseja destacar mais nas redes sociais?", required: true, multiline: true },
  { key: "unique_differentiator", label: "O que torna a sua empresa única em relação à concorrência?", required: true, multiline: true },
  { key: "exclusive_products", label: "A empresa trabalha com algum produto/serviço exclusivo ou tem algum diferencial que se destaca?", required: true, multiline: true },
  { key: "customer_experience", label: "Como é o atendimento e a experiência do cliente (do primeiro contato ao pós-venda)?", required: true, multiline: true },
  { key: "ideal_customer", label: "Quem é o cliente ideal da empresa? (idade, gênero, profissão, rotina, nível de renda)", required: true, multiline: true },
  { key: "customer_concerns", label: "O que mais preocupa essas pessoas em relação ao produto/serviço oferecido?", required: true, multiline: true },
  { key: "customer_goals", label: "Quais são os objetivos e necessidades mais comuns delas ao buscar o seu produto/serviço?", required: true, multiline: true },
  { key: "brand_perception", label: "A empresa quer ser percebida como… (ex: autoridade, acessível, premium, inovadora, próxima, técnica etc.)", required: true, multiline: true },
  { key: "what_not_to_communicate", label: "Há algo que a empresa NÃO quer comunicar?", required: true, multiline: true },
  { key: "social_media_objectives", label: "Qual é o principal objetivo nas redes sociais? (atrair novos clientes, fidelizar, educar, gerar autoridade, conversão etc.)", required: true, multiline: true },
  { key: "non_negotiables", label: "O que é inegociável para você quando se trata da criação de conteúdo?", required: true, multiline: true },
  { key: "profile_gaps", label: "O que você mais sente que está em falta no perfil da marca hoje?", required: true, multiline: true },
  { key: "reference_profiles", label: "Existem outros perfis que você admira ou que são referência?", required: true, multiline: true },
  { key: "direct_competitors", label: "Quem são seus concorrentes diretos? (inserir @ do Instagram)", required: true, multiline: true },
  { key: "instagram_access", label: "Acesso do Instagram (login/token ou instrução segura)", required: true, multiline: true },
  { key: "facebook_access", label: "Acesso do Facebook para uso do Meta Business Suite (se necessário)", required: false, multiline: true },
  { key: "additional_info", label: "Alguma outra informação importante que devemos saber para criar conteúdos alinhados?", required: true, multiline: true },
];

const FILE_UPLOADS = [
  { type: "logo", label: "Logomarca da empresa", required: true },
  { type: "brand_manual", label: "Manual da marca", required: false },
  { type: "product_catalog", label: "Catálogo de produtos", required: false },
];

export const SocialBriefingTab = ({ projectId }: SocialBriefingTabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [briefing, setBriefing] = useState<BriefingForm | null>(null);
  const [uploads, setUploads] = useState<BriefingUpload[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      // Load briefing form
      const { data: briefingData, error: briefingError } = await supabase
        .from("social_briefing_forms")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (briefingError && briefingError.code !== "PGRST116") throw briefingError;

      if (briefingData) {
        setBriefing(briefingData as BriefingForm);
        const initialData: Record<string, string> = {};
        QUESTIONS.forEach(q => {
          initialData[q.key] = (briefingData as any)[q.key] || "";
        });
        setFormData(initialData);

        // Load uploads
        const { data: uploadsData } = await supabase
          .from("social_briefing_uploads")
          .select("*")
          .eq("briefing_id", briefingData.id);

        setUploads(uploadsData || []);
      } else {
        // Create new briefing
        const { data: newBriefing, error: createError } = await supabase
          .from("social_briefing_forms")
          .insert({ project_id: projectId })
          .select()
          .single();

        if (createError) throw createError;
        setBriefing(newBriefing as BriefingForm);
      }
    } catch (error) {
      console.error("Error loading briefing:", error);
      toast.error("Erro ao carregar briefing");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!briefing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("social_briefing_forms")
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", briefing.id);

      if (error) throw error;
      toast.success("Progresso salvo!");

      // Log audit
      await supabase.from("social_audit_logs").insert({
        project_id: projectId,
        entity_type: "briefing",
        entity_id: briefing.id,
        action: "update",
        changes: formData,
      });
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    if (!briefing) return;
    setUploadingType(type);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${briefing.id}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("social-briefing")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("social-briefing")
        .getPublicUrl(fileName);

      // Remove existing file of same type
      const existingFile = uploads.find(u => u.file_type === type);
      if (existingFile) {
        await supabase.from("social_briefing_uploads").delete().eq("id", existingFile.id);
      }

      // Save upload record
      const { error: insertError } = await supabase
        .from("social_briefing_uploads")
        .insert({
          briefing_id: briefing.id,
          file_type: type,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
        });

      if (insertError) throw insertError;

      toast.success("Arquivo enviado!");
      loadData();
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploadingType(null);
    }
  };

  const handleRemoveUpload = async (uploadId: string) => {
    try {
      const { error } = await supabase
        .from("social_briefing_uploads")
        .delete()
        .eq("id", uploadId);

      if (error) throw error;
      toast.success("Arquivo removido");
      loadData();
    } catch (error) {
      console.error("Error removing:", error);
      toast.error("Erro ao remover arquivo");
    }
  };

  const handleSubmit = async () => {
    if (!briefing) return;

    // Validate required fields
    const missingFields = QUESTIONS.filter(q => q.required && !formData[q.key]?.trim());
    const missingUploads = FILE_UPLOADS.filter(f => f.required && !uploads.find(u => u.file_type === f.type));

    if (missingFields.length > 0 || missingUploads.length > 0) {
      toast.error(`Preencha todos os campos obrigatórios (${missingFields.length + missingUploads.length} faltando)`);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("social_briefing_forms")
        .update({
          ...formData,
          status: "pending_review",
          submitted_at: new Date().toISOString(),
          is_complete: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", briefing.id);

      if (error) throw error;

      toast.success("Briefing enviado para revisão!");
      loadData();

      // Log audit
      await supabase.from("social_audit_logs").insert({
        project_id: projectId,
        entity_type: "briefing",
        entity_id: briefing.id,
        action: "submit",
      });
    } catch (error) {
      console.error("Error submitting:", error);
      toast.error("Erro ao enviar briefing");
    } finally {
      setSubmitting(false);
    }
  };

  const calculateProgress = () => {
    const totalRequired = QUESTIONS.filter(q => q.required).length + FILE_UPLOADS.filter(f => f.required).length;
    const filledFields = QUESTIONS.filter(q => q.required && formData[q.key]?.trim()).length;
    const filledUploads = FILE_UPLOADS.filter(f => f.required && uploads.find(u => u.file_type === f.type)).length;
    return Math.round(((filledFields + filledUploads) / totalRequired) * 100);
  };

  const getPublicLink = () => {
    if (!briefing?.access_token) return null;
    const baseUrl = window.location.origin;
    return `${baseUrl}?public=social-briefing&token=${briefing.access_token}`;
  };

  const handleCopyLink = () => {
    const link = getPublicLink();
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência!");
    }
  };

  const isLocked = briefing?.status === "approved" || briefing?.status === "locked";

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Briefing | Social Media</h2>
              <p className="text-muted-foreground mt-1 max-w-xl">
                Seja bem-vindo(a)! Vamos começar a transformar sua presença digital.
                Preencha com atenção: esse briefing nos ajuda a entender seu negócio, suas dores e seus objetivos.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {briefing?.access_token && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="gap-2"
                >
                  <Link className="h-4 w-4" />
                  Copiar Link do Cliente
                </Button>
              )}
              {briefing?.status && (
                <Badge 
                  variant={briefing.status === "approved" ? "default" : briefing.status === "pending_review" ? "secondary" : "outline"}
                  className="capitalize"
                >
                  {briefing.status === "draft" && <Clock className="h-3 w-3 mr-1" />}
                  {briefing.status === "pending_review" && <AlertCircle className="h-3 w-3 mr-1" />}
                  {briefing.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                  {briefing.status === "draft" ? "Rascunho" : 
                   briefing.status === "pending_review" ? "Em Revisão" : 
                   briefing.status === "approved" ? "Aprovado" : briefing.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do preenchimento</span>
              <span className="font-medium">{calculateProgress()}%</span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
          </div>
        </div>
      </div>

      {/* Form */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto space-y-8">
          {/* Questions */}
          {QUESTIONS.map((question, index) => (
            <div key={question.key} className="space-y-2">
              <Label className="text-base flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary rounded-full h-6 w-6 flex items-center justify-center font-medium">
                  {index + 1}
                </span>
                {question.label}
                {question.required && <span className="text-destructive">*</span>}
              </Label>
              {question.multiline ? (
                <Textarea
                  value={formData[question.key] || ""}
                  onChange={(e) => handleFieldChange(question.key, e.target.value)}
                  placeholder="Digite sua resposta..."
                  rows={3}
                  disabled={isLocked}
                  className="resize-none"
                />
              ) : (
                <Input
                  value={formData[question.key] || ""}
                  onChange={(e) => handleFieldChange(question.key, e.target.value)}
                  placeholder="Digite sua resposta..."
                  disabled={isLocked}
                />
              )}
            </div>
          ))}

          <Separator className="my-8" />

          {/* File Uploads */}
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Arquivos</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {FILE_UPLOADS.map((fileType) => {
                const upload = uploads.find(u => u.file_type === fileType.type);
                return (
                  <Card key={fileType.type} className={upload ? "border-primary/30 bg-primary/5" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {upload ? (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {fileType.label}
                            {fileType.required && <span className="text-destructive ml-1">*</span>}
                          </p>
                          {!fileType.required && (
                            <p className="text-xs text-muted-foreground">Opcional</p>
                          )}
                        </div>
                      </div>

                      {upload ? (
                        <div className="flex items-center gap-2">
                          <a 
                            href={upload.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline truncate flex-1"
                          >
                            {upload.file_name}
                          </a>
                          {!isLocked && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => handleRemoveUpload(upload.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            ref={(el) => { fileInputRefs.current[fileType.type] = el; }}
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(fileType.type, file);
                            }}
                            disabled={isLocked}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => fileInputRefs.current[fileType.type]?.click()}
                            disabled={uploadingType === fileType.type || isLocked}
                          >
                            {uploadingType === fileType.type ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            Enviar
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Separator className="my-8" />

          {/* Actions */}
          {!isLocked && (
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Progresso
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={submitting || calculateProgress() < 100}
                className="gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar para Revisão
              </Button>
            </div>
          )}

          {isLocked && (
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="font-medium">Briefing aprovado!</p>
                <p className="text-sm text-muted-foreground">
                  Este briefing está sendo usado como base para toda a criação de conteúdo.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
