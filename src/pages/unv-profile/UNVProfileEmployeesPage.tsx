import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users } from "lucide-react";

export default function UNVProfileEmployeesPage() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profile_employees")
        .select("id,full_name,email,phone,avatar_url,status,employee_type,contract_type,hire_date")
        .order("full_name");
      setList(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = list.filter(e =>
    !q || e.full_name?.toLowerCase().includes(q.toLowerCase()) || e.email?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Sincronizado automaticamente com o Staff do UNV Nexus</p>
        </div>
        <Badge variant="outline">{list.length} no total</Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou email..." className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <Card key={emp.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={emp.avatar_url || undefined} />
                  <AvatarFallback>{emp.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{emp.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant={emp.status === "active" ? "default" : "secondary"} className="text-[10px]">
                      {emp.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {emp.employee_type === "internal" ? "Interno UNV" : "Cliente"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-12">Nenhum colaborador encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
