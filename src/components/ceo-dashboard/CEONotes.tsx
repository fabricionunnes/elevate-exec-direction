import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, StickyNote, Search, Lightbulb, AlertTriangle, TrendingUp, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  content: string;
  tags: string[];
  related_decision_id: string | null;
  related_company_id: string | null;
  related_area: string | null;
  created_at: string;
  decision?: { title: string } | null;
  company?: { name: string } | null;
}

const TAG_OPTIONS = [
  { value: "ideia", label: "Ideia", icon: Lightbulb, color: "bg-yellow-500" },
  { value: "insight", label: "Insight", icon: TrendingUp, color: "bg-blue-500" },
  { value: "risco", label: "Risco", icon: AlertTriangle, color: "bg-red-500" },
  { value: "oportunidade", label: "Oportunidade", icon: TrendingUp, color: "bg-green-500" },
];

const AREAS = [
  "Vendas", "Financeiro", "Produto", "Pessoas", "Marketing", "Operações", "Estratégia"
];

export function CEONotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [decisions, setDecisions] = useState<{ id: string; title: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    content: "",
    tags: [] as string[],
    related_decision_id: "",
    related_company_id: "",
    related_area: "",
  });

  const fetchData = async () => {
    try {
      // Fetch notes
      const { data: notesData, error: notesError } = await supabase
        .from("ceo_notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;
      setNotes((notesData || []).map(n => ({ ...n, decision: null, company: null })));

      // Fetch decisions for dropdown
      const { data: decisionsData } = await supabase
        .from("ceo_decisions")
        .select("id, title")
        .order("decision_date", { ascending: false });

      setDecisions(decisionsData || []);

      // Fetch companies for dropdown
      const { data: companiesData } = await (supabase as any)
        .from("onboarding_companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setCompanies(companiesData || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.content) {
      toast.error("Digite o conteúdo da anotação");
      return;
    }

    try {
      const { error } = await supabase.from("ceo_notes").insert({
        content: formData.content,
        tags: formData.tags,
        related_decision_id: formData.related_decision_id || null,
        related_company_id: formData.related_company_id || null,
        related_area: formData.related_area || null,
      });

      if (error) throw error;

      toast.success("Anotação salva com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        content: "",
        tags: [],
        related_decision_id: "",
        related_company_id: "",
        related_area: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Erro ao salvar anotação");
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const getTagConfig = (tag: string) => TAG_OPTIONS.find(t => t.value === tag);

  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchQuery === "" || 
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === null || note.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-yellow-500" />
          Anotações do CEO
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Anotação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Anotação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Conteúdo *</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Escreva sua anotação..."
                  className="min-h-[150px]"
                />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TAG_OPTIONS.map((tag) => {
                    const Icon = tag.icon;
                    const isSelected = formData.tags.includes(tag.value);
                    return (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleTag(tag.value)}
                        className={cn(
                          "flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors",
                          isSelected ? `${tag.color} text-white` : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Relacionar a Decisão</Label>
                <Select
                  value={formData.related_decision_id}
                  onValueChange={(v) => setFormData({ ...formData, related_decision_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {decisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Relacionar a Cliente</Label>
                <Select
                  value={formData.related_company_id}
                  onValueChange={(v) => setFormData({ ...formData, related_company_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Área</Label>
                <Select
                  value={formData.related_area}
                  onValueChange={(v) => setFormData({ ...formData, related_area: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Salvar Anotação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Search and Filter */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar anotações..."
              className="pl-10"
            />
          </div>
          <Select
            value={selectedTag || "all"}
            onValueChange={(v) => setSelectedTag(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-40">
              <Tag className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {TAG_OPTIONS.map((tag) => (
                <SelectItem key={tag.value} value={tag.value}>
                  {tag.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes List */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {filteredNotes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma anotação encontrada
            </p>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {note.tags.map((tag) => {
                        const tagConfig = getTagConfig(tag);
                        if (!tagConfig) return null;
                        const Icon = tagConfig.icon;
                        return (
                          <Badge
                            key={tag}
                            className={cn("text-white", tagConfig.color)}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {tagConfig.label}
                          </Badge>
                        );
                      })}
                      {note.related_area && (
                        <Badge variant="outline">{note.related_area}</Badge>
                      )}
                      {note.decision && (
                        <Badge variant="secondary">
                          📋 {note.decision.title}
                        </Badge>
                      )}
                      {note.company && (
                        <Badge variant="secondary">
                          🏢 {note.company.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
