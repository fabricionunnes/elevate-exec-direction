import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, BookOpen, Edit, Upload, FileText, Loader2, X } from "lucide-react";

interface Book {
  id: string;
  title: string;
  author: string | null;
  summary: string | null;
  themes: string[] | null;
  cover_url: string | null;
  is_active: boolean;
}

export default function PDILibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [tracks, setTracks] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookTracks, setBookTracks] = useState<string[]>([]);

  const [form, setForm] = useState({
    title: "", author: "", summary: "", themes: "", cover_url: "",
  });

  const fetchData = useCallback(async () => {
    const [booksRes, tracksRes] = await Promise.all([
      supabase.from("pdi_books").select("*").order("title"),
      supabase.from("pdi_tracks").select("id, name").eq("is_active", true).order("name"),
    ]);
    setBooks((booksRes.data as any[]) || []);
    setTracks((tracksRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ title: "", author: "", summary: "", themes: "", cover_url: "" });
    setEditingBook(null);
    setBookTracks([]);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    const themesArr = form.themes ? form.themes.split(",").map((t) => t.trim()).filter(Boolean) : null;
    const payload = {
      title: form.title, author: form.author || null,
      summary: form.summary || null, themes: themesArr, cover_url: form.cover_url || null,
    };

    let bookId: string;
    if (editingBook) {
      await supabase.from("pdi_books").update(payload).eq("id", editingBook.id);
      bookId = editingBook.id;
      toast.success("Livro atualizado!");
    } else {
      const { data } = await supabase.from("pdi_books").insert(payload).select("id").single();
      bookId = (data as any)?.id;
      toast.success("Livro adicionado!");
    }

    // Update book-track links
    if (bookId) {
      await supabase.from("pdi_book_tracks").delete().eq("book_id", bookId);
      if (bookTracks.length > 0) {
        await supabase.from("pdi_book_tracks").insert(
          bookTracks.map((trackId) => ({ book_id: bookId, track_id: trackId }))
        );
      }
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleEdit = async (book: Book) => {
    setEditingBook(book);
    setForm({
      title: book.title, author: book.author || "",
      summary: book.summary || "", themes: (book.themes || []).join(", "),
      cover_url: book.cover_url || "",
    });
    const { data } = await supabase.from("pdi_book_tracks").select("track_id").eq("book_id", book.id);
    setBookTracks(((data as any[]) || []).map((d) => d.track_id));
    setDialogOpen(true);
  };

  const filtered = books.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.author || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Biblioteca de Livros</h1>
          <p className="text-sm text-muted-foreground">Gerencie livros e materiais de leitura</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo Livro
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar livro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhum livro encontrado.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((book) => (
            <Card key={book.id} className={`hover:border-primary/30 transition-colors ${!book.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-9 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground">{book.title}</h3>
                    {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
                  </div>
                </div>
                {book.summary && <p className="text-xs text-muted-foreground line-clamp-3">{book.summary}</p>}
                {book.themes && book.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {book.themes.map((t) => (<Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>))}
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleEdit(book)}>
                  <Edit className="h-3 w-3 mr-1" />Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBook ? "Editar Livro" : "Novo Livro"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Autor</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
            <div><Label>Resumo</Label><Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
            <div><Label>Temas (separados por vírgula)</Label><Input value={form.themes} onChange={(e) => setForm({ ...form, themes: e.target.value })} placeholder="Liderança, Gestão, Vendas" /></div>
            <div><Label>URL da Capa</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
            <div>
              <Label>Associar às Trilhas</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {tracks.map((t) => (
                  <Badge
                    key={t.id}
                    variant={bookTracks.includes(t.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setBookTracks((prev) =>
                      prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                    )}
                  >
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingBook ? "Salvar Alterações" : "Adicionar Livro"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
