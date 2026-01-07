import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cs" | "consultant" | "client";
}

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  task_id: string | null;
  creator?: { name: string; role: string };
  assignee?: { name: string; role: string };
  replies?: TicketReply[];
}

interface TicketReply {
  id: string;
  message: string;
  created_at: string;
  user?: { name: string; role: string };
}

interface TicketsPanelProps {
  projectId: string;
  users: OnboardingUser[];
}

export const TicketsPanel = ({ projectId, users }: TicketsPanelProps) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newTicket, setNewTicket] = useState({ subject: "", message: "", assigned_to: "" });
  const [replyMessage, setReplyMessage] = useState("");

  useEffect(() => {
    fetchTickets();
    
    // Subscribe to real-time ticket changes
    const ticketsChannel = supabase
      .channel(`tickets-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_tickets',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    // Subscribe to real-time ticket replies
    const repliesChannel = supabase
      .channel(`ticket-replies-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'onboarding_ticket_replies'
        },
        (payload) => {
          // Refresh if we have a selected ticket and the reply is for it
          if (selectedTicket && payload.new && (payload.new as any).ticket_id === selectedTicket.id) {
            handleSelectTicket(selectedTicket);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(repliesChannel);
    };
  }, [projectId, selectedTicket]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_tickets")
        .select(`
          *,
          creator:onboarding_users!onboarding_tickets_created_by_fkey(name, role),
          assignee:onboarding_users!onboarding_tickets_assigned_to_fkey(name, role)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketReplies = async (ticketId: string) => {
    const { data } = await supabase
      .from("onboarding_ticket_replies")
      .select(`*, user:onboarding_users(name, role)`)
      .eq("ticket_id", ticketId)
      .order("created_at");

    return data || [];
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error("Preencha assunto e mensagem");
      return;
    }

    try {
      // Get current user's auth id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // First try to find user in onboarding_users for this project
      let creatorId: string | null = null;
      
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (onboardingUser) {
        creatorId = onboardingUser.id;
      } else {
        // Check if user is staff admin - if so, create a temporary entry in onboarding_users
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, name, email, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staffMember) {
          // Check if staff already has an entry in onboarding_users for this project
          const { data: existingStaffUser } = await supabase
            .from("onboarding_users")
            .select("id")
            .eq("project_id", projectId)
            .eq("email", staffMember.email)
            .maybeSingle();

          if (existingStaffUser) {
            creatorId = existingStaffUser.id;
          } else {
            // Create entry for staff in onboarding_users
            const { data: newStaffUser, error: insertError } = await supabase
              .from("onboarding_users")
              .insert({
                project_id: projectId,
                user_id: user.id,
                name: staffMember.name,
                email: staffMember.email,
                role: staffMember.role === 'admin' ? 'admin' : staffMember.role as 'cs' | 'consultant',
                password_changed: true,
              })
              .select("id")
              .single();

            if (insertError) throw insertError;
            creatorId = newStaffUser.id;
          }
        }
      }

      if (!creatorId) throw new Error("Usuário não encontrado no projeto");

      const { error } = await supabase.from("onboarding_tickets").insert({
        project_id: projectId,
        subject: newTicket.subject.trim(),
        message: newTicket.message.trim(),
        created_by: creatorId,
        assigned_to: newTicket.assigned_to || null,
      });

      if (error) throw error;

      toast.success("Chamado criado!");
      setShowCreateDialog(false);
      setNewTicket({ subject: "", message: "", assigned_to: "" });
      fetchTickets();
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast.error("Erro ao criar chamado");
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    const replies = await fetchTicketReplies(ticket.id);
    setSelectedTicket({ ...ticket, replies });
  };

  const handleAddReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // First try to find user in onboarding_users for this project
      let userId: string | null = null;
      
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (onboardingUser) {
        userId = onboardingUser.id;
      } else {
        // Check if user is staff - if so, create a temporary entry in onboarding_users
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, name, email, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staffMember) {
          // Check if staff already has an entry in onboarding_users for this project
          const { data: existingStaffUser } = await supabase
            .from("onboarding_users")
            .select("id")
            .eq("project_id", projectId)
            .eq("email", staffMember.email)
            .maybeSingle();

          if (existingStaffUser) {
            userId = existingStaffUser.id;
          } else {
            // Create entry for staff in onboarding_users
            const { data: newStaffUser, error: insertError } = await supabase
              .from("onboarding_users")
              .insert({
                project_id: projectId,
                user_id: user.id,
                name: staffMember.name,
                email: staffMember.email,
                role: staffMember.role === 'admin' ? 'admin' : staffMember.role as 'cs' | 'consultant',
                password_changed: true,
              })
              .select("id")
              .single();

            if (insertError) throw insertError;
            userId = newStaffUser.id;
          }
        }
      }

      if (!userId) throw new Error("Usuário não encontrado no projeto");

      const { error } = await supabase.from("onboarding_ticket_replies").insert({
        ticket_id: selectedTicket.id,
        user_id: userId,
        message: replyMessage.trim(),
      });

      if (error) throw error;

      setReplyMessage("");
      handleSelectTicket(selectedTicket);
      toast.success("Resposta enviada");
    } catch (error: any) {
      console.error("Error adding reply:", error);
      toast.error("Erro ao enviar resposta");
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: "open" | "in_progress" | "resolved" | "closed") => {
    try {
      const { error } = await supabase
        .from("onboarding_tickets")
        .update({ status })
        .eq("id", ticketId);

      if (error) throw error;
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: status as any });
      }
    } catch (error: any) {
      console.error("Error updating status:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Aberto</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-500">Em andamento</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Resolvido</Badge>;
      case "closed":
        return <Badge variant="secondary">Fechado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const staffUsers = users.filter((u) => u.role === "cs" || u.role === "consultant" || u.role === "admin");

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando chamados...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Chamados</h3>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum chamado ainda</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleSelectTicket(ticket)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{ticket.subject}</h4>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{ticket.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Por: {ticket.creator?.name}</span>
                      {ticket.assignee && <span>Para: {ticket.assignee.name}</span>}
                      <span>{format(new Date(ticket.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create ticket dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assunto</label>
              <Input
                placeholder="Assunto do chamado"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea
                placeholder="Descreva sua dúvida ou solicitação..."
                value={newTicket.message}
                onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Direcionar para</label>
              <Select
                value={newTicket.assigned_to}
                onValueChange={(value) => setNewTicket({ ...newTicket, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {staffUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role === "cs" ? "CS" : user.role === "consultant" ? "Consultor" : "Admin"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTicket}>Criar Chamado</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket details dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicket?.subject}
              {selectedTicket && getStatusBadge(selectedTicket.status)}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">{selectedTicket.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedTicket.creator?.name} •{" "}
                  {format(new Date(selectedTicket.created_at), "dd/MM/yyyy HH:mm")}
                </p>
              </div>

              {/* Replies */}
              {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedTicket.replies.map((reply) => (
                    <div key={reply.id} className="p-3 border rounded-lg">
                      <p className="text-sm">{reply.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {reply.user?.name} •{" "}
                        {format(new Date(reply.created_at), "dd/MM HH:mm")}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Escreva uma resposta..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={2}
                />
                <div className="flex justify-between">
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(value: "open" | "in_progress" | "resolved" | "closed") => handleUpdateStatus(selectedTicket.id, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="in_progress">Em andamento</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddReply} disabled={!replyMessage.trim()}>
                    Responder
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
