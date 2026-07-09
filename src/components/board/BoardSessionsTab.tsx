import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Video,
  MoreHorizontal,
  CheckCircle2,
  UserX,
  XCircle,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BoardSession, BoardSessionStatus, fetchCompanyNameMap } from "./boardTypes";

interface MemberOption {
  id: string;
  company_id: string;
  company_name: string;
}

interface StaffOption {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Agendada", className: "border-blue-500 text-blue-600" },
  done: { label: "Realizada", className: "border-green-500 text-green-600" },
  no_show: { label: "Não compareceu", className: "border-orange-500 text-orange-600" },
  cancelled: { label: "Cancelada", className: "border-red-500 text-red-600" },
};

export function BoardSessionsTab() {
  const [sessions, setSessions] = useState<BoardSession[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    member_id: "",
    consultant_staff_id: "",
    scheduled_at: "",
    duration_min: "60",
    meeting_link: "",
    agenda: "",
  });

  const fetchAll = useCallback(async () => {
    try {
      const [sessionsRes, membersRes, staffRes] = await Promise.all([
        (supabase as any)
          .from("unv_board_sessions")
          .select("*")
          .order("scheduled_at", { ascending: false }),
        (supabase as any)
          .from("unv_board_members")
          .select("id, company_id, status")
          .eq("status", "active"),
        supabase
          .from("onboarding_staff")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;

      const memberRows = (membersRes.data || []) as { id: string; company_id: string }[];
      const nameMap = await fetchCompanyNameMap(
        supabase,
        memberRows.map((m) => m.company_id),
      );
      const memberOptions: MemberOption[] = memberRows
        .map((m) => ({
          id: m.id,
          company_id: m.company_id,
          company_name: nameMap[m.company_id] || "—",
        }))
        .sort((a, b) => a.company_name.localeCompare(b.company_name));
      setMembers(memberOptions);

      const staffRows = (staffRes.data || []) as StaffOption[];
      setStaff(staffRows);

      const memberMap: Record<string, string> = {};
      for (const m of memberOptions) memberMap[m.id] = m.company_name;
      const staffMap: Record<string, string> = {};
      for (const s of staffRows) staffMap[s.id] = s.name;

      const rows = ((sessionsRes.data || []) as BoardSession[]).map((s) => ({
        ...s,
        company_name: memberMap[s.member_id] || "—",
        consultant_name: s.consultant_staff_id ? staffMap[s.consultant_staff_id] || "—" : "—",
      }));
      setSessions(rows);
    } catch (err) {
      console.error("Erro ao carregar sessões:", err);
      toast.error("Erro ao carregar sessões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createSession = async () => {
    if (!form.member_id) {
      toast.error("Selecione o membro");
      return;
    }
    if (!form.scheduled_at) {
      toast.error("Informe a data e hora");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("unv_board_sessions").insert({
        member_id: form.member_id,
        consultant_staff_id: form.consultant_staff_id || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_min: parseInt(form.duration_min, 10) || 60,
        meeting_link: form.meeting_link || null,
        agenda: form.agenda || null,
        status: "scheduled",
      });
      if (error) throw error;
      toast.success("Sessão agendada");
      setCreateOpen(false);
      setForm({
        member_id: "",
        consultant_staff_id: "",
        scheduled_at: "",
        duration_min: "60",
        meeting_link: "",
        agenda: "",
      });
      setLoading(true);
      fetchAll();
    } catch (err: any) {
      console.error("Erro ao agendar sessão:", err);
      toast.error(err?.message || "Erro ao agendar sessão");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (session: BoardSession, status: BoardSessionStatus) => {
    try {
      const { error } = await (supabase as any)
        .from("unv_board_sessions")
        .update({ status })
        .eq("id", session.id);
      if (error) throw error;
      toast.success("Sessão atualizada");
      fetchAll();
    } catch (err) {
      console.error("Erro ao atualizar sessão:", err);
      toast.error("Erro ao atualizar sessão");
    }
  };

  const now = new Date();
  const upcoming = sessions
    .filter((s) => s.status === "scheduled" && new Date(s.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = sessions.filter(
    (s) => s.status !== "scheduled" || new Date(s.scheduled_at) < now,
  );

  // Contagem de sessões por membro no mês corrente (meta: 2/mês)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthCounts: Record<string, number> = {};
  for (const s of sessions) {
    const d = new Date(s.scheduled_at);
    if (d >= monthStart && d <= monthEnd && s.status !== "cancelled") {
      monthCounts[s.member_id] = (monthCounts[s.member_id] || 0) + 1;
    }
  }
  const membersBelowTarget = members.filter((m) => (monthCounts[m.id] || 0) < 2);

  const renderTable = (rows: BoardSession[], emptyMsg: string) =>
    rows.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground text-sm">{emptyMsg}</div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Data e hora</TableHead>
            <TableHead>Consultor</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const badge = STATUS_BADGE[s.status] || { label: s.status, className: "" };
            return (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.company_name}</TableCell>
                <TableCell>
                  {format(new Date(s.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.consultant_name}
                </TableCell>
                <TableCell className="text-sm">{s.duration_min} min</TableCell>
                <TableCell>
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {s.meeting_link && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Abrir link da reunião"
                        onClick={() => window.open(s.meeting_link!, "_blank")}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    )}
                    {s.status === "scheduled" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setStatus(s, "done")}>
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                            Marcar como realizada
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus(s, "no_show")}>
                            <UserX className="h-4 w-4 mr-2 text-orange-600" />
                            Não compareceu
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus(s, "cancelled")}>
                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                            Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {upcoming.length} sessão(ões) próximas · {past.length} passadas
        </span>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Agendar sessão
        </Button>
      </div>

      {membersBelowTarget.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                  Membros com menos de 2 sessões neste mês
                </p>
                <p className="text-muted-foreground">
                  {membersBelowTarget
                    .map((m) => `${m.company_name} (${monthCounts[m.id] || 0})`)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#0D2B5E] dark:text-blue-300" />
            Próximas sessões
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">{renderTable(upcoming, "Nenhuma sessão agendada")}</CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">{renderTable(past, "Nenhuma sessão passada")}</CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar sessão individual</DialogTitle>
            <DialogDescription>Sessão 1:1 do membro com o consultor UNV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Membro</Label>
              <Select
                value={form.member_id}
                onValueChange={(v) => setForm((f) => ({ ...f, member_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o membro" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Consultor</Label>
              <Select
                value={form.consultant_staff_id}
                onValueChange={(v) => setForm((f) => ({ ...f, consultant_staff_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o consultor" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={form.duration_min}
                  onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link da reunião (Meet)</Label>
              <Input
                value={form.meeting_link}
                placeholder="https://meet.google.com/..."
                onChange={(e) => setForm((f) => ({ ...f, meeting_link: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Pauta (opcional)</Label>
              <Textarea
                rows={2}
                value={form.agenda}
                placeholder="O que será tratado na sessão"
                onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={createSession} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
