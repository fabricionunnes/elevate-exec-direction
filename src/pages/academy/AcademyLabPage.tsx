import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlaskConical, Copy, Check, ExternalLink, Search, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { iaDb, LAB_CATEGORY_LABEL, CRESCER_PHASE_LABEL, type IaLabItem } from "@/lib/academy/iaAcademy";
import { supabase } from "@/integrations/supabase/client";

// Laboratório de Agentes: prompts, agentes, fluxos N8N e templates prontos
// pra copiar. Cada item aponta pra trilha/aula onde é usado.

export const AcademyLabPage = () => {
  const [items, setItems] = useState<IaLabItem[]>([]);
  const [tracks, setTracks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [open, setOpen] = useState<IaLabItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: lab }, { data: tr }] = await Promise.all([
          iaDb.from("ia_academy_lab_items").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
          supabase.from("academy_tracks").select("id, name"),
        ]);
        setItems((lab as IaLabItem[]) || []);
        const map: Record<string, string> = {};
        (tr || []).forEach((t) => { map[t.id] = t.name; });
        setTracks(map);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q) ||
        (i.tools || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, search, category]);

  const copy = async (item: IaLabItem) => {
    if (!item.prompt_text) return;
    await navigator.clipboard.writeText(item.prompt_text);
    setCopiedId(item.id);
    toast.success("Copiado. Cola no seu projeto de IA ou no nó do N8N.");
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const categories = ["all", ...Object.keys(LAB_CATEGORY_LABEL)];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FlaskConical className="h-7 w-7 text-primary" /> Laboratório de Agentes
        </h1>
        <p className="text-muted-foreground mt-1">
          Prompts, agentes e fluxos prontos. Copie, troque o que está entre colchetes e rode na sua empresa.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar por nome, descrição ou ferramenta..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>
              {c === "all" ? "Todos" : LAB_CATEGORY_LABEL[c as IaLabItem["category"]]}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nada encontrado com esse filtro.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} className="flex flex-col hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="outline">{LAB_CATEGORY_LABEL[item.category]}</Badge>
                  {item.crescer_phase && <Badge variant="secondary">{CRESCER_PHASE_LABEL[item.crescer_phase] || item.crescer_phase}</Badge>}
                </div>
                <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-3">
                {item.description && <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>}
                {item.tools?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tools.map((t) => <span key={t} className="text-[10px] uppercase tracking-wider rounded bg-muted px-1.5 py-0.5">{t}</span>)}
                  </div>
                )}
                {item.track_id && tracks[item.track_id] && (
                  <Link to={`/academy/track/${item.track_id}`} className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <BookOpen className="h-3 w-3" /> {tracks[item.track_id]}
                  </Link>
                )}
                <div className="mt-auto flex gap-2 pt-1">
                  {item.prompt_text && (
                    <>
                      <Button size="sm" className="flex-1" onClick={() => copy(item)}>
                        {copiedId === item.id ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copiedId === item.id ? "Copiado" : "Copiar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setOpen(item)}>Ver</Button>
                    </>
                  )}
                  {item.external_url && (
                    <Button size="sm" variant={item.prompt_text ? "ghost" : "default"} asChild className={item.prompt_text ? "" : "flex-1"}>
                      <a href={item.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Abrir</a>
                    </Button>
                  )}
                  {!item.prompt_text && !item.external_url && (
                    <span className="text-xs text-muted-foreground">Arquivo em breve</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
          {open?.description && <p className="text-sm text-muted-foreground">{open.description}</p>}
          <pre className="whitespace-pre-wrap text-sm rounded-lg border bg-muted/50 p-4 max-h-[60vh] overflow-auto font-mono">{open?.prompt_text}</pre>
          {open && (
            <Button onClick={() => copy(open)}>
              <Copy className="h-4 w-4 mr-2" /> Copiar prompt
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyLabPage;
