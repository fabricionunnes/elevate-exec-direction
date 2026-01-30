import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  ChevronLeft,
  Search,
  CalendarClock,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ScheduledMessage {
  id: string;
  phone_number: string;
  message: string;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
}

interface ScheduledMessagesSectionProps {
  onBack: () => void;
}

export const ScheduledMessagesSection = ({ onBack }: ScheduledMessagesSectionProps) => {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("crm_scheduled_messages")
        .select("*")
        .order("scheduled_at", { ascending: false });
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (message: ScheduledMessage) => {
    if (!confirm("Cancelar esta mensagem agendada?")) return;

    try {
      const { error } = await supabase
        .from("crm_scheduled_messages")
        .update({ status: "cancelled" })
        .eq("id", message.id);
      if (error) throw error;
      toast.success("Mensagem cancelada");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "sent":
        return <Badge className="bg-green-500">Enviada</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filtered = messages.filter(
    (m) =>
      m.phone_number.includes(searchTerm) ||
      m.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={onBack} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Configurações
        </button>
        <span>/</span>
        <span className="text-foreground">Mensagens agendadas</span>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Mensagens agendadas</h2>
        <p className="text-sm text-muted-foreground">
          Agende mensagens ou veja quais estão programadas
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Agendar mensagem
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>TELEFONE</TableHead>
            <TableHead>MENSAGEM</TableHead>
            <TableHead>AGENDADA PARA</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((msg) => (
            <TableRow key={msg.id}>
              <TableCell className="font-medium">{msg.phone_number}</TableCell>
              <TableCell className="max-w-xs truncate">{msg.message}</TableCell>
              <TableCell>
                {format(new Date(msg.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell>{getStatusBadge(msg.status)}</TableCell>
              <TableCell>
                {msg.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCancel(msg)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhuma mensagem agendada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
