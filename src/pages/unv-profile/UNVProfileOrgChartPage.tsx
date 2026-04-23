import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Network } from "lucide-react";

interface Node { id: string; full_name: string; avatar_url?: string | null; manager_id?: string | null; position?: string }

function Tree({ nodes, parentId = null }: { nodes: Node[]; parentId?: string | null }) {
  const children = nodes.filter(n => n.manager_id === parentId);
  if (children.length === 0) return null;
  return (
    <div className="flex gap-4 justify-center flex-wrap">
      {children.map(c => (
        <div key={c.id} className="flex flex-col items-center">
          <Card className="w-44 mb-3">
            <CardContent className="p-3 flex flex-col items-center text-center">
              <Avatar className="h-12 w-12 mb-2">
                <AvatarImage src={c.avatar_url || undefined} />
                <AvatarFallback>{c.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <p className="text-xs font-semibold truncate w-full">{c.full_name}</p>
              {c.position && <p className="text-[10px] text-muted-foreground truncate w-full">{c.position}</p>}
            </CardContent>
          </Card>
          <Tree nodes={nodes} parentId={c.id} />
        </div>
      ))}
    </div>
  );
}

export default function UNVProfileOrgChartPage() {
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profile_employees")
        .select("id, full_name, avatar_url, manager_id, profile_positions(title)")
        .eq("status", "active");
      setNodes((data || []).map((d: any) => ({
        id: d.id, full_name: d.full_name, avatar_url: d.avatar_url, manager_id: d.manager_id,
        position: d.profile_positions?.title,
      })));
    })();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="w-6 h-6 text-primary" /> Organograma</h1>
        <p className="text-sm text-muted-foreground">Estrutura hierárquica visual ({nodes.length} colaboradores)</p>
      </div>
      <div className="overflow-auto pb-6">
        <Tree nodes={nodes} parentId={null} />
        {nodes.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Sem colaboradores ativos.</p>}
      </div>
    </div>
  );
}
