import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { InstagramCompetitor } from "../types";

interface InstagramCompetitorsProps {
  accountId: string;
  isStaff?: boolean;
}

export const InstagramCompetitors = ({ accountId, isStaff }: InstagramCompetitorsProps) => {
  const [competitors, setCompetitors] = useState<InstagramCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchCompetitors = async () => {
    const { data } = await supabase
      .from("instagram_competitors")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at");
    setCompetitors((data || []) as InstagramCompetitor[]);
    setLoading(false);
  };

  useEffect(() => { fetchCompetitors(); }, [accountId]);

  const handleAdd = async () => {
    if (!newUsername.trim()) return;
    setAdding(true);
    try {
      const username = newUsername.replace("@", "").trim();
      const { error } = await supabase.from("instagram_competitors").insert({
        account_id: accountId,
        competitor_username: username,
      });
      if (error) throw error;
      toast.success(`@${username} adicionado`);
      setNewUsername("");
      fetchCompetitors();
    } catch (err: any) {
      toast.error(err.message?.includes("unique") ? "Concorrente já existe" : "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    await supabase.from("instagram_competitors").delete().eq("id", id);
    toast.success("Concorrente removido");
    fetchCompetitors();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Allow all users to add competitors */}
      {true && (
        <div className="flex gap-2">
          <Input
            placeholder="@username do concorrente"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={adding} className="gap-2">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
      )}

      {competitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum concorrente adicionado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {competitors.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">@{c.competitor_username}</p>
                  {c.competitor_full_name && <p className="text-sm text-muted-foreground">{c.competitor_full_name}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{c.followers_count.toLocaleString("pt-BR")} seguidores</span>
                    <span>{Number(c.avg_engagement_rate).toFixed(2)}% eng.</span>
                    <span>{Number(c.posts_per_week).toFixed(1)} posts/sem</span>
                  </div>
                </div>
                {isStaff && (
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
