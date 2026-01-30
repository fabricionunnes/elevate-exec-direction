import { useState } from "react";
import {
  Smartphone,
  Grid3X3,
  MessageSquare,
  Users,
  CalendarClock,
  Bell,
  X,
  ChevronRight,
  Instagram,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ServiceConfigMenuItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const menuItems: ServiceConfigMenuItem[] = [
  {
    id: "devices",
    icon: <Smartphone className="h-5 w-5" />,
    title: "Dispositivo",
    description: "Configure seus dispositivos, atendentes, canais e mais.",
  },
  {
    id: "sectors",
    icon: <Grid3X3 className="h-5 w-5" />,
    title: "Setores",
    description: "Gerencie os setores de atendimentos do seu time.",
  },
  {
    id: "quick-responses",
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Respostas rápidas",
    description: "Ajuste as respostas mais usadas pelo seu time.",
  },
  {
    id: "permissions",
    icon: <Users className="h-5 w-5" />,
    title: "Usuários e Permissões",
    description: "Habilite permissões que cada usuário pode fazer no módulo de atendimento.",
  },
  {
    id: "scheduled",
    icon: <CalendarClock className="h-5 w-5" />,
    title: "Mensagens agendadas",
    description: "Agende uma nova mensagem ou veja quais estão programadas para envio.",
  },
  {
    id: "notifications",
    icon: <Bell className="h-5 w-5" />,
    title: "Notificações",
    description: "Fique por dentro de todas as notificações de atendimento que você tem acesso.",
  },
  {
    id: "instagram",
    icon: <Instagram className="h-5 w-5 text-pink-500" />,
    title: "Instagram",
    description: "Conecte suas contas Instagram para gerenciar DMs, comentários e seguidores.",
  },
];

interface ServiceConfigMenuProps {
  onSelectSection: (sectionId: string) => void;
  onClose: () => void;
}

export const ServiceConfigMenu = ({ onSelectSection, onClose }: ServiceConfigMenuProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Configuração de atendimento</h2>
          <p className="text-sm text-muted-foreground">
            Configure seus atendentes, canais, setores e tudo que precisa no seu atendimento.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectSection(item.id)}
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg border border-border bg-card",
              "hover:bg-accent/50 hover:border-primary/30 transition-all text-left",
              "group"
            )}
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
