import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Star, 
  StarOff, 
  Trash2, 
  ExternalLink, 
  Loader2,
  Instagram,
  Youtube,
  Globe,
  TrendingUp,
  Lightbulb,
  Users
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

interface ResearchItem {
  id: string;
  title: string;
  type: string;
  source_url: string | null;
  source_platform: string | null;
  thumbnail_url: string | null;
  notes: string | null;
  tags: string[] | null;
  what_works: string | null;
  what_to_adapt: string | null;
  is_favorite: boolean;
  created_at: string;
}

const typeLabels: Record<string, { label: string; icon: any; color: string }> = {
  reference: { label: "Referência", icon: Star, color: "bg-blue-500" },
  competitor: { label: "Concorrente", icon: Users, color: "bg-red-500" },
  trend: { label: "Tendência", icon: TrendingUp, color: "bg-green-500" },
  inspiration: { label: "Inspiração", icon: Lightbulb, color: "bg-yellow-500" },
};

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Globe,
  other: Globe,
};

export const SocialResearchTab = ({ projectId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    type: "reference",
    source_url: "",
    source_platform: "instagram",
    notes: "",
    tags: "",
    what_works: "",
    what_to_adapt: "",
  });

  useEffect(() => {
    loadItems();
  }, [projectId]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("social_research_inspirations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading research:", error);
      toast.error("Erro ao carregar pesquisas");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("social_research_inspirations")
        .insert({
          project_id: projectId,
          title: formData.title.trim(),
          type: formData.type,
          source_url: formData.source_url || null,
          source_platform: formData.source_platform,
          notes: formData.notes || null,
          tags: formData.tags ? formData.tags.split(",").map(t => t.trim()) : null,
          what_works: formData.what_works || null,
          what_to_adapt: formData.what_to_adapt || null,
        });

      if (error) throw error;

      toast.success("Pesquisa adicionada!");
      setDialogOpen(false);
      setFormData({
        title: "",
        type: "reference",
        source_url: "",
        source_platform: "instagram",
        notes: "",
        tags: "",
        what_works: "",
        what_to_adapt: "",
      });
      loadItems();
    } catch (error) {
      console.error("Error saving research:", error);
      toast.error("Erro ao salvar pesquisa");
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = async (item: ResearchItem) => {
    try {
      const { error } = await supabase
        .from("social_research_inspirations")
        .update({ is_favorite: !item.is_favorite })
        .eq("id", item.id);

      if (error) throw error;

      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, is_favorite: !i.is_favorite } : i
      ));
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from("social_research_inspirations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== id));
      toast.success("Item removido");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao remover");
    }
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === "all" || item.type === filter;
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pesquisas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="reference">Referências</SelectItem>
              <SelectItem value="competitor">Concorrentes</SelectItem>
              <SelectItem value="trend">Tendências</SelectItem>
              <SelectItem value="inspiration">Inspirações</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Pesquisa / Inspiração</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  placeholder="Ex: Post carrossel da @marca"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reference">Referência</SelectItem>
                      <SelectItem value="competitor">Concorrente</SelectItem>
                      <SelectItem value="trend">Tendência</SelectItem>
                      <SelectItem value="inspiration">Inspiração</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select 
                    value={formData.source_platform} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, source_platform: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>URL da Fonte</Label>
                <Input
                  placeholder="https://..."
                  value={formData.source_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Notas / Observações</Label>
                <Textarea
                  placeholder="O que chamou atenção nesse conteúdo..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>O que funciona bem</Label>
                <Textarea
                  placeholder="Pontos fortes do conteúdo..."
                  value={formData.what_works}
                  onChange={(e) => setFormData(prev => ({ ...prev, what_works: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>O que adaptar</Label>
                <Textarea
                  placeholder="Como adaptar para o cliente..."
                  value={formData.what_to_adapt}
                  onChange={(e) => setFormData(prev => ({ ...prev, what_to_adapt: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  placeholder="carrossel, educativo, autoridade"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma pesquisa encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Adicione referências, análises de concorrentes e inspirações aqui.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar primeira pesquisa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const typeInfo = typeLabels[item.type] || typeLabels.reference;
            const PlatformIcon = platformIcons[item.source_platform || "other"] || Globe;

            return (
              <Card key={item.id} className="group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg ${typeInfo.color} flex items-center justify-center`}>
                        <typeInfo.icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base line-clamp-1">{item.title}</CardTitle>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <PlatformIcon className="h-3 w-3" />
                          {typeInfo.label}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleFavorite(item)}
                      >
                        {item.is_favorite ? (
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        ) : (
                          <StarOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.notes}</p>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {item.source_url && (
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                        Ver fonte
                      </a>
                    </Button>
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
