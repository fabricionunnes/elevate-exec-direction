import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Image,
  File,
  Download,
  Trash2,
  Eye,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  description: string | null;
  created_at: string;
  uploaded_by?: { name: string };
}

interface DocumentsPanelProps {
  companyId: string;
  projectId?: string;
  taskId?: string;
  ticketId?: string;
}

const CATEGORIES = [
  { value: "contract", label: "Contrato" },
  { value: "briefing", label: "Briefing" },
  { value: "deliverable", label: "Entregável" },
  { value: "reference", label: "Referência" },
  { value: "general", label: "Geral" },
];

export const DocumentsPanel = ({
  companyId,
  projectId,
  taskId,
  ticketId,
}: DocumentsPanelProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, [companyId, projectId, taskId, ticketId]);

  const fetchDocuments = async () => {
    try {
      let query = supabase
        .from("onboarding_documents")
        .select(`*, uploaded_by:onboarding_users(name)`)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      if (taskId) {
        query = query.eq("task_id", taskId);
      }
      if (ticketId) {
        query = query.eq("ticket_id", ticketId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get onboarding user
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", user.id)
        .single();

      // Upload to storage
      const fileName = `${companyId}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("onboarding-documents")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: dbError } = await supabase
        .from("onboarding_documents")
        .insert({
          company_id: companyId,
          project_id: projectId || null,
          task_id: taskId || null,
          ticket_id: ticketId || null,
          uploaded_by: onboardingUser?.id || null,
          file_name: selectedFile.name,
          file_path: fileName,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          category,
          description: description || null,
        });

      if (dbError) throw dbError;

      toast.success("Arquivo enviado com sucesso");
      setShowUploadDialog(false);
      setSelectedFile(null);
      setDescription("");
      setCategory("general");
      fetchDocuments();
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast.error(error.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("onboarding-documents")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading document:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("onboarding-documents")
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: dbError } = await supabase
        .from("onboarding_documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      toast.success("Documento excluído");
      fetchDocuments();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error("Erro ao excluir documento");
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File className="h-8 w-8 text-muted-foreground" />;
    if (type.startsWith("image/")) return <Image className="h-8 w-8 text-blue-500" />;
    if (type.includes("pdf")) return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getCategoryBadge = (cat: string) => {
    const found = CATEGORIES.find((c) => c.value === cat);
    return (
      <Badge variant="outline" className="text-xs">
        {found?.label || cat}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Documentos</h3>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Enviar Arquivo
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum documento encontrado</p>
          <Button className="mt-4" onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Enviar Primeiro Arquivo
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4">
                  {getFileIcon(doc.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getCategoryBadge(doc.category)}
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                      {doc.uploaded_by?.name && (
                        <>
                          <span>•</span>
                          <span>{doc.uploaded_by.name}</span>
                        </>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo *</Label>
              <Input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional do documento"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                {uploading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
