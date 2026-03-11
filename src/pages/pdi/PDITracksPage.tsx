import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Route, Edit, Trash2 } from "lucide-react";

interface Track {
  id: string;
  name: string;
  description: string | null;
  category: string;
  total_hours: number;
  is_active: boolean;
  sort_order: number;
}

const CATEGORIES = [
  { value: "leadership", label: "Liderança" },
  { value: "sales", label: "Vendas" },
  { value: "management", label: "Gestão" },
  { value: "performance", label: "Alta Performance" },
  { value: "mindset", label: "Mentalidade" },
  { value: "general", label: "Geral" },
];

export default function PDITracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "general",
    total_hours: "0",
  });

  const fetchTracks = useCallback(async () => {
    const { data } = await supabase
      .from("pdi_tracks")
      .select("*")
      .order("sort_order")
      .order("name");
    setTracks((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const resetForm = () => {
    setForm({ name: "", description: "", category: "general", total_hours: "0" });
    setEditingTrack(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome da trilha é obrigatório");
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      total_hours: parseInt(form.total_hours) || 0,
    };

    if (editingTrack) {
      await supabase.from("pdi_tracks").update(payload).eq("id", editingTrack.id);
      toast.success("Trilha atualizada!");
    } else {
      await supabase.from("pdi_tracks").insert(payload);
      toast.success("Trilha criada!");
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchTracks();
  };

  const handleEdit = (track: Track) => {
    setEditingTrack(track);
    setForm({
      name: track.name,
      description: track.description || "",
      category: track.category,
      total_hours: String(track.total_hours),
    });
    setDialogOpen(true);
  };

  const toggleActive = async (track: Track) => {
    await supabase.from("pdi_tracks").update({ is_active: !track.is_active }).eq("id", track.id);
    fetchTracks();
    toast.success(track.is_active ? "Trilha desativada" : "Trilha ativada");
  };

  const filtered = tracks.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryLabel = (val: string) =>
    CATEGORIES.find((c) => c.value === val)?.label || val;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trilhas de Desenvolvimento</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie trilhas de desenvolvimento</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Trilha
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar trilha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhuma trilha encontrada.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((track) => (
            <Card key={track.id} className={`hover:border-primary/30 transition-colors ${!track.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Route className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{track.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{getCategoryLabel(track.category)}</Badge>
                    </div>
                  </div>
                  {!track.is_active && <Badge variant="secondary">Inativa</Badge>}
                </div>
                {track.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{track.description}</p>
                )}
                {track.total_hours > 0 && (
                  <p className="text-xs text-muted-foreground">{track.total_hours}h de carga horária</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(track)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(track)}>
                    {track.is_active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTrack ? "Editar Trilha" : "Nova Trilha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Trilha de Liderança" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carga Horária (h)</Label>
                <Input type="number" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingTrack ? "Salvar Alterações" : "Criar Trilha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
