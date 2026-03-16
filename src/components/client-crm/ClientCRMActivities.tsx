import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, Trash2, Phone, CalendarCheck, Mail, FileText, Clock } from "lucide-react";
import type { ClientActivity, ClientDeal, ClientContact } from "./hooks/useClientCRM";

interface Props {
  activities: ClientActivity[];
  deals: ClientDeal[];
  contacts: ClientContact[];
  onCreateActivity: (activity: Partial<ClientActivity>) => Promise<void>;
  onCompleteActivity: (id: string) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
}

const typeIcons: Record<string, any> = {
  task: CalendarCheck,
  call: Phone,
  meeting: CalendarCheck,
  email: Mail,
  note: FileText,
};

const typeLabels: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
  note: "Nota",
};

export const ClientCRMActivities = ({ activities, deals, contacts, onCreateActivity, onCompleteActivity, onDeleteActivity }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [form, setForm] = useState({ title: "", type: "task", description: "", deal_id: "", contact_id: "", scheduled_at: "" });
  const [saving, setSaving] = useState(false);

  const filtered = activities.filter((a) => {
    if (filter === "pending") return a.status === "pending";
    if (filter === "completed") return a.status === "completed";
    return true;
  });

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onCreateActivity({
        title: form.title,
        type: form.type,
        description: form.description || undefined,
        deal_id: form.deal_id || undefined,
        contact_id: form.contact_id || undefined,
        scheduled_at: form.scheduled_at || undefined,
      });
      setForm({ title: "", type: "task", description: "", deal_id: "", contact_id: "", scheduled_at: "" });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(["all", "pending", "completed"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : "Concluídas"}
            </Button>
          ))}
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 ml-auto">
              <Plus className="h-4 w-4" /> Nova Atividade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Atividade</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              <Select value={form.deal_id} onValueChange={(v) => setForm({ ...form, deal_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vincular negócio (opcional)" /></SelectTrigger>
                <SelectContent>
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vincular contato (opcional)" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Button onClick={handleCreate} disabled={saving || !form.title.trim()} className="w-full">
                {saving ? "Salvando..." : "Criar Atividade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma atividade encontrada
            </CardContent>
          </Card>
        ) : (
          filtered.map((activity) => {
            const Icon = typeIcons[activity.type] || CalendarCheck;
            const isCompleted = activity.status === "completed";
            return (
              <Card key={activity.id} className={isCompleted ? "opacity-60" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isCompleted ? "bg-green-100 text-green-600" : "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isCompleted ? "line-through" : ""}`}>{activity.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{typeLabels[activity.type] || activity.type}</Badge>
                      {activity.deal && <span className="text-xs text-muted-foreground">{activity.deal.title}</span>}
                      {activity.contact && <span className="text-xs text-muted-foreground">{activity.contact.name}</span>}
                      {activity.scheduled_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDate(activity.scheduled_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!isCompleted && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => onCompleteActivity(activity.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteActivity(activity.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
