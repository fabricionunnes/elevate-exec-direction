import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, MessageSquare, Mail, Calendar, Video, FileSignature, BarChart, DollarSign, Workflow } from "lucide-react";

const INTEGRATIONS = [
  { icon: MessageSquare, name: "WhatsApp", desc: "Notificações para candidatos e colaboradores", status: "ready" },
  { icon: Mail, name: "E-mail", desc: "Convites e comunicação automatizada", status: "ready" },
  { icon: Calendar, name: "Google Calendar", desc: "Agendamento de entrevistas e 1:1", status: "ready" },
  { icon: Video, name: "Google Meet", desc: "Links automáticos para entrevistas", status: "ready" },
  { icon: FileSignature, name: "ClickSign", desc: "Assinatura digital de contratos e documentos", status: "soon" },
  { icon: BarChart, name: "CRM Comercial", desc: "Sincronização com vagas e candidatos", status: "ready" },
  { icon: DollarSign, name: "Financeiro", desc: "Folha, salários e benefícios", status: "ready" },
  { icon: Workflow, name: "N8N", desc: "Automação de fluxos personalizados", status: "soon" },
];

export default function UNVProfileIntegrationsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-primary" /> Integrações</h1>
        <p className="text-sm text-muted-foreground">Conecte o UNV Profile ao ecossistema UNV Nexus</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map((i, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <i.icon className="w-5 h-5 text-primary" />
                </div>
                <Badge variant={i.status === "ready" ? "default" : "outline"}>{i.status === "ready" ? "Disponível" : "Em breve"}</Badge>
              </div>
              <CardTitle className="text-base mt-2">{i.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{i.desc}</p>
              <Button size="sm" variant="outline" className="w-full" disabled={i.status !== "ready"}>
                {i.status === "ready" ? "Configurar" : "Em breve"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
