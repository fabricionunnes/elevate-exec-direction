import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, Plus, ExternalLink, Trash2, Star, StarOff, 
  Instagram, Video, Image as ImageIcon, Link as LinkIcon, Upload
} from "lucide-react";
import { toast } from "sonner";

interface SocialInspirationTabProps {
  projectId: string;
}

interface Inspiration {
  id: string;
  content_type: string;
  title: string | null;
  description: string | null;
  url: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  tags: string[] | null;
  is_favorite: boolean;
  created_at: string;
}

const CONTENT_TYPES = [
  { value: "instagram_profile", label: "Perfil Instagram", icon: Instagram },
  { value: "reel", label: "Reel", icon: Video },
  { value: "post", label: "Post", icon: ImageIcon },
  { value: "image", label: "Imagem", icon: ImageIcon },
  { value: "video", label: "Vídeo", icon: Video },
  { value: "link", label: "Link", icon: LinkIcon },
];

export const SocialInspirationTab = ({ projectId }: SocialInspirationTabProps) => {
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [contentType, setContentType] = useState("link");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Filter
  const [filterType, setFilterType] = useState<string>("all");
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    loadInspirations();
  }, [projectId]);

  const loadInspirations = async () => {
    try {
      const { data, error } = await supabase
        .from("social_inspiration_library")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInspirations(data || []);
    } catch (error) {
      console.error("Error loading inspirations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${projectId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("social-briefing")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("social-briefing")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!title.trim() && !url.trim() && !uploadedFile) {
      toast.error("Preencha pelo menos o título ou URL");
      return;
    }

    setSaving(true);
    try {
      let fileUrl = null;
      if (uploadedFile) {
        setUploading(true);
        fileUrl = await handleFileUpload(uploadedFile);
        setUploading(false);
      }

      const tagsArray = tags.split(",").map(t => t.trim()).filter(t => t.length > 0);

      const { error } = await supabase
        .from("social_inspiration_library")
        .insert({
          project_id: projectId,
          content_type: contentType,
          title: title.trim() || null,
          description: description.trim() || null,
          url: url.trim() || null,
          file_url: fileUrl,
          tags: tagsArray.length > 0 ? tagsArray : null,
        });

      if (error) throw error;

      toast.success("Inspiração adicionada!");
      resetForm();
      setDialogOpen(false);
      loadInspirations();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("social_inspiration_library")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Removido!");
      loadInspirations();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao remover");
    }
  };

  const handleToggleFavorite = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("social_inspiration_library")
        .update({ is_favorite: !currentValue })
        .eq("id", id);

      if (error) throw error;
      loadInspirations();
    } catch (error) {
      console.error("Error updating:", error);
    }
  };

  const resetForm = () => {
    setContentType("link");
    setTitle("");
    setDescription("");
    setUrl("");
    setTags("");
    setUploadedFile(null);
  };

  const filteredInspirations = inspirations.filter(i => {
    if (filterType !== "all" && i.content_type !== filterType) return false;
    if (showFavorites && !i.is_favorite) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    const found = CONTENT_TYPES.find(t => t.value === type);
    return found?.icon || LinkIcon;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Banco de Inspirações</h3>
          <p className="text-sm text-muted-foreground">
            Referências visuais e criativas para a produção de conteúdo
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Inspiração</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  placeholder="Nome ou descrição curta"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>URL (opcional)</Label>
                <Input
                  placeholder="https://instagram.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Upload de Arquivo (opcional)</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                />
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploadedFile ? uploadedFile.name : "Escolher arquivo"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  placeholder="Por que essa referência é interessante?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  placeholder="feed, carrossel, identidade visual"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleSave} 
                disabled={saving || uploading} 
                className="w-full gap-2"
              >
                {saving || uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {CONTENT_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showFavorites ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavorites(!showFavorites)}
          className="gap-2"
        >
          <Star className="h-4 w-4" />
          Favoritos
        </Button>
      </div>

      {/* Grid */}
      {filteredInspirations.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h4 className="font-medium mb-1">Nenhuma inspiração ainda</h4>
            <p className="text-sm text-muted-foreground">
              Adicione perfis, reels e imagens de referência
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredInspirations.map((item) => {
            const TypeIcon = getTypeIcon(item.content_type);
            return (
              <Card key={item.id} className="group relative overflow-hidden">
                {/* Preview */}
                <div className="aspect-square bg-muted relative">
                  {item.file_url ? (
                    item.content_type === "video" ? (
                      <video 
                        src={item.file_url} 
                        className="w-full h-full object-cover"
                        muted
                        onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
                      />
                    ) : (
                      <img 
                        src={item.file_url} 
                        alt={item.title || ""} 
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <TypeIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {item.url && (
                      <Button size="icon" variant="secondary" asChild>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button 
                      size="icon" 
                      variant="secondary"
                      onClick={() => handleToggleFavorite(item.id, item.is_favorite)}
                    >
                      {item.is_favorite ? (
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Favorite badge */}
                  {item.is_favorite && (
                    <div className="absolute top-2 right-2">
                      <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{item.title || "Sem título"}</p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {item.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
