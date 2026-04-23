import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Target, GraduationCap, FileText, Rocket } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function UNVProfileMePage() {
  const [me, setMe] = useState<any>(null);
  const [pdis, setPdis] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase
        .from("profile_employees").select("*").eq("user_id", user.id).maybeSingle();
      setMe(emp);
      if (emp?.id) {
        const { data: p } = await supabase.from("profile_pdi").select("*").eq("employee_id", emp.id);
        setPdis(p || []);
      }
    })();
  }, []);

  if (!me) return <div className="p-8 text-sm text-muted-foreground">Você ainda não está cadastrado como colaborador no UNV Profile.</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><User className="w-6 h-6 text-primary" /> Minha Área</h1>
        <p className="text-sm text-muted-foreground">Painel pessoal de desenvolvimento</p>
      </div>

      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={me.avatar_url || undefined} />
            <AvatarFallback>{me.full_name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{me.full_name}</p>
            <p className="text-sm text-muted-foreground">{me.email}</p>
            <Badge variant="outline" className="mt-1">{me.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" />Meus PDIs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pdis.length === 0 && <p className="text-xs text-muted-foreground">Nenhum PDI ativo.</p>}
            {pdis.map(p => (
              <div key={p.id} className="border rounded p-2">
                <p className="text-sm font-medium">{p.title}</p>
                <Badge variant="outline" className="text-[10px] mt-1">{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4" />Meus Treinamentos</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">Em breve.</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />Avaliações</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">Sem avaliações pendentes.</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Rocket className="w-4 h-4" />Onboarding</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{me.status === "onboarding" ? "Em andamento" : "Concluído"}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
