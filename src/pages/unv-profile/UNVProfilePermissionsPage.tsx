import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield } from "lucide-react";
import { PROFILE_ROLES } from "./types";

const ROLE_DESC: Record<string, { color: string; perms: string[] }> = {
  admin_master_unv: { color: "bg-rose-500", perms: ["Acesso global a todas empresas", "Configurações do sistema", "Auditoria"] },
  admin_company: { color: "bg-violet-500", perms: ["Acesso total da empresa", "Gestão de RH", "Aprovações"] },
  rh: { color: "bg-blue-500", perms: ["Vagas, candidatos, onboarding", "PDI, avaliações, clima", "Relatórios"] },
  manager: { color: "bg-emerald-500", perms: ["Equipe direta", "Feedback, 1:1, avaliações", "Aprovação de PDI"] },
  employee: { color: "bg-amber-500", perms: ["Minha área", "PDI, treinamentos próprios", "Responder pesquisas"] },
  recruiter: { color: "bg-cyan-500", perms: ["Vagas e candidatos", "Pipeline e banco de talentos", "Avaliações de candidato"] },
  candidate: { color: "bg-slate-500", perms: ["Página pública de vaga", "Acompanhar candidatura"] },
};

export default function UNVProfilePermissionsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6 text-primary" /> Permissões</h1>
        <p className="text-sm text-muted-foreground">Controle granular por perfil</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROFILE_ROLES.map(r => {
          const meta = ROLE_DESC[r.key];
          return (
            <Card key={r.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${meta.color} flex items-center justify-center`}>
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <CardTitle className="text-base">{r.label}</CardTitle>
                  </div>
                  <Badge variant="outline">{r.key}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {meta.perms.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>{p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
