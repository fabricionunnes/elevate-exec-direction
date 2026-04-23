import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, Star, UserCheck, Sparkles, Filter } from "lucide-react";

export default function UNVProfileTalentPoolPage() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profile_candidates").select("*")
        .in("stage", ["talent_pool", "rejected"])
        .order("ai_score", { ascending: false, nullsFirst: false });
      setList(data || []);
    })();
  }, []);

  const filtered = list.filter(c =>
    (!q || c.full_name?.toLowerCase().includes(q.toLowerCase()) || c.email?.toLowerCase().includes(q.toLowerCase()) || (c.tags || []).some((t: string) => t.toLowerCase().includes(q.toLowerCase()))) &&
    (!onlyFav || c.is_favorite)
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="w-6 h-6 text-primary" /> Banco de Talentos</h1>
        <p className="text-sm text-muted-foreground">Curadoria e reaproveitamento de candidatos</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, email ou tag..." className="pl-9" />
        </div>
        <Button variant={onlyFav ? "default" : "outline"} onClick={() => setOnlyFav(!onlyFav)}>
          <Star className="w-4 h-4 mr-2" />Favoritos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Avatar><AvatarFallback>{c.full_name?.[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                </div>
                {c.is_favorite && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
              </div>
              {c.ai_score != null && (
                <div className="text-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="font-semibold">{c.ai_score}%</span> aderência IA
                </div>
              )}
              {c.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.tags.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Nenhum talento no banco.</p>}
      </div>
    </div>
  );
}
