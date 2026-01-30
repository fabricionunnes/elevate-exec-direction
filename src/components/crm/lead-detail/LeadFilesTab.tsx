import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Trash2,
  Download,
  CloudUpload,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface LeadFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { name: string } | null;
}

interface LeadFilesTabProps {
  leadId: string;
}

export const LeadFilesTab = ({ leadId }: LeadFilesTabProps) => {
  const [files, setFiles] = useState<LeadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadFiles();
  }, [leadId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_lead_files")
        .select(`
          *,
          uploader:onboarding_staff(name)
        `)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${leadId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("crm-files")
        .upload(fileName, file);

      if (uploadError) {
        // If bucket doesn't exist, show a friendly error
        if (uploadError.message.includes("Bucket not found")) {
          toast.error("Storage não configurado. Entre em contato com o administrador.");
          return;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("crm-files")
        .getPublicUrl(fileName);

      // Save file record
      const { error: insertError } = await supabase
        .from("crm_lead_files")
        .insert({
          lead_id: leadId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: staff?.id,
        });

      if (insertError) throw insertError;

      toast.success("Arquivo enviado com sucesso");
      loadFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from("crm_lead_files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;
      toast.success("Arquivo excluído");
      loadFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Erro ao excluir arquivo");
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-5 w-5" />;
    if (fileType.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
    if (fileType.includes("spreadsheet") || fileType.includes("excel")) 
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (fileType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = files.filter(file => {
    if (searchTerm && !file.file_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== "all") {
      if (filterType === "image" && !file.file_type?.startsWith("image/")) return false;
      if (filterType === "document" && !file.file_type?.includes("pdf") && !file.file_type?.includes("document")) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar arquivos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo de arquivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="image">Imagens</SelectItem>
              <SelectItem value="document">Documentos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button asChild disabled={uploading}>
            <label htmlFor="file-upload" className="cursor-pointer">
              <CloudUpload className="h-4 w-4 mr-2" />
              {uploading ? "Enviando..." : "Novo arquivo"}
            </label>
          </Button>
        </div>
      </div>

      {/* Files Table */}
      {files.length > 0 ? (
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ARQUIVO</TableHead>
                <TableHead>DATA DE UPLOAD</TableHead>
                <TableHead>USUÁRIO</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map(file => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.file_type)}
                      <div>
                        <p className="font-medium text-sm">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.file_size)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(file.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {file.uploader?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(file.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <div className="w-32 h-32 mb-4 bg-muted rounded-full flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-orange-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">Nenhum arquivo encontrado</h3>
          <Button variant="link" asChild className="text-primary">
            <label htmlFor="file-upload" className="cursor-pointer">
              <CloudUpload className="h-4 w-4 mr-2" />
              Novo arquivo
            </label>
          </Button>
        </div>
      )}
    </div>
  );
};
