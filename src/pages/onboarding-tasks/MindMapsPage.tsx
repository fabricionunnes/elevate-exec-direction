// Lista de mapas mentais. Quem vê o quê é decidido no banco (RLS):
// cada um vê os seus; admin vê de todos menos do master; master vê tudo.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Loader2, Network, Search, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface MapRow {
  id: string; title: string; updated_at: string; owner_staff_id: string;
  owner?: { name: string } | null;
  company?: { name: string } | null;
}

export default function MindMapsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [search, setSearch] = useState("");
  const [me, setMe] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staff } = await (supabase as any).from("onboarding_staff").select("id").eq("user_id", user?.id).maybeSingle();
    setMe(staff?.id || null);
    const { data } = await (supabase as any).from("mindmaps")
      .select("id, title, updated_at, owner_staff_id, owner:onboarding_staff!mindmaps_owner_staff_id_fkey(name), company:onboarding_companies(name)")
      .order("updated_at", { ascending: false });
    setMaps((data as MapRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createNew = async () => {
    if (!me) { toast.error("Usuário sem cadastro de staff"); return; }
    const { data, error } = await (supabase as any).from("mindmaps")
      .insert({ title: "Novo mapa", owner_staff_id: me }).select("id").single();
    if (error) { toast.error(error.message); return; }
    navigate(`/onboarding-tasks/mapas/${data.id}`);
  };

  const remove = async (m: MapRow) => {
    if (!confirm(`Apagar o mapa "${m.title}"?`)) return;
    const { error } = await (supabase as any).from("mindmaps").delete().eq("id", m.id);
    if (error) { toast.error("Só o dono pode apagar"); return; }
    load();
  };

  const filtered = maps.filter((m) =>
    !search.trim() || m.title.toLowerCase().includes(search.toLowerCase())
    || (m.owner?.name || "").toLowerCase().includes(search.toLowerCase()));

  const mine = filtered.filter((m) => m.owner_staff_id === me);
  const others = filtered.filter((m) => m.owner_staff_id !== me);

  const Item = ({ m }: { m: MapRow }) => (
    <Card className="cursor-pointer hover:border-primary/40 transition" onClick={() => navigate(`/onboarding-tasks/mapas/${m.id}`)}>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Network className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{m.title}</p>
          <p className="text-xs text-muted-foreground">
            {m.owner_staff_id !== me && m.owner?.name ? `${m.owner.name} · ` : ""}
            {m.company?.name ? `${m.company.name} · ` : ""}
            editado {formatDistanceToNow(new Date(m.updated_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        {m.owner_staff_id === me && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); remove(m); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="h-6 w-6 text-primary" /> Mapas mentais</h1>
            <p className="text-sm text-muted-foreground">Tab cria filho, Enter cria irmão — pensa digitando.</p>
          </div>
        </div>
        <Button onClick={createNew} className="gap-2"><Plus className="h-4 w-4" /> Novo mapa</Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por título ou dono..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : maps.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-muted-foreground">
          <Network className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum mapa ainda. Cria o primeiro.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meus mapas <Badge variant="outline" className="ml-1">{mine.length}</Badge></p>
            {mine.length === 0 ? <p className="text-sm text-muted-foreground">Você ainda não criou nenhum.</p> : mine.map((m) => <Item key={m.id} m={m} />)}
          </div>
          {others.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Da equipe <Badge variant="outline" className="ml-1">{others.length}</Badge></p>
              {others.map((m) => <Item key={m.id} m={m} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
