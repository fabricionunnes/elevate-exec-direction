import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Sparkles,
  ClipboardList,
  ExternalLink,
  FolderOpen,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import {
  BoardMember,
  BoardRoom,
  fetchCompanyNameMap,
  formatTimeSlot,
  WEEKDAY_LABELS,
} from "./boardTypes";
import { BoardPlanReviewDialog } from "./BoardPlanReviewDialog";

interface CompanyOption {
  id: string;
  name: string;
}

interface BoardMembersTabProps {
  onOpenDeliverables: (companyId: string) => void;
}

const PLAN_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Plano pendente", className: "border-yellow-500 text-yellow-600" },
  generating: { label: "Gerando plano", className: "border-blue-500 text-blue-600" },
  review: { label: "Em revisão", className: "border-orange-500 text-orange-600" },
  published: { label: "Publicado", className: "border-green-500 text-green-600" },
};

const MEMBER_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "border-green-500 text-green-600" },
  paused: { label: "Pausado", className: "border-yellow-500 text-yellow-600" },
  churned: { label: "Churn", className: "border-red-500 text-red-600" },
  completed: { label: "Concluído", className: "border-blue-500 text-blue-600" },
};

export function BoardMembersTab({ onOpenDeliverables }: BoardMembersTabProps) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [rooms, setRooms] = useState<BoardRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  // dialog de novo membro
  const [addOpen, setAddOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: "",
    entry_date: format(new Date(), "yyyy-MM-dd"),
    room_id: "",
    owner_name: "",
    owner_phone: "",
  });

  // dialog de revisão de plano
  const [reviewMember, setReviewMember] = useState<BoardMember | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      // Tenta o embed direto; se a FK não estiver exposta, cai no map manual
      let rows: any[] = [];
      const { data, error } = await (supabase as any)
        .from("unv_board_members")
        .select("*, onboarding_companies(name)")
        .order("entry_date", { ascending: false });
      if (error) {
        const { data: plain, error: plainErr } = await (supabase as any)
          .from("unv_board_members")
          .select("*")
          .order("entry_date", { ascending: false });
        if (plainErr) throw plainErr;
        rows = plain || [];
        const nameMap = await fetchCompanyNameMap(supabase, rows.map((m) => m.company_id));
        rows = rows.map((m) => ({ ...m, company_name: nameMap[m.company_id] || "—" }));
      } else {
        rows = (data || []).map((m: any) => ({
          ...m,
          company_name: m.onboarding_companies?.name || "—",
        }));
      }
      setMembers(rows as BoardMember[]);
    } catch (err) {
      console.error("Erro ao carregar membros do Board:", err);
      toast.error("Erro ao carregar membros");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("unv_board_rooms")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (!error) setRooms((data || []) as BoardRoom[]);
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchRooms();
  }, [fetchMembers, fetchRooms]);

  const openAddDialog = async () => {
    setAddOpen(true);
    if (companies.length === 0) {
      setCompaniesLoading(true);
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) {
        toast.error("Erro ao carregar empresas");
      } else {
        setCompanies((data || []) as CompanyOption[]);
      }
      setCompaniesLoading(false);
    }
  };

  const addMember = async () => {
    if (!form.company_id) {
      toast.error("Selecione a empresa");
      return;
    }
    if (!form.entry_date) {
      toast.error("Informe a data de entrada");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("unv_board_members").insert({
        company_id: form.company_id,
        entry_date: form.entry_date,
        room_id: form.room_id || null,
        owner_name: form.owner_name || null,
        owner_phone: form.owner_phone || null,
        status: "active",
        plan_status: "pending",
      });
      if (error) throw error;
      toast.success("Membro adicionado ao Board");
      setAddOpen(false);
      setForm({
        company_id: "",
        entry_date: format(new Date(), "yyyy-MM-dd"),
        room_id: "",
        owner_name: "",
        owner_phone: "",
      });
      setLoading(true);
      fetchMembers();
    } catch (err: any) {
      console.error("Erro ao adicionar membro:", err);
      toast.error(err?.message || "Erro ao adicionar membro");
    } finally {
      setSaving(false);
    }
  };

  const generatePlan = async (member: BoardMember) => {
    setGeneratingIds((prev) => new Set(prev).add(member.id));
    toast.info(`Gerando plano de ${member.company_name} — leva de 60 a 90 segundos`);
    try {
      const { data, error } = await supabase.functions.invoke("board-engine", {
        body: { action: "generate_plan", member_id: member.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Plano gerado: ${data?.actions_created || 0} ações. Revise antes de publicar.`);
      fetchMembers();
    } catch (err: any) {
      console.error("Erro ao gerar plano:", err);
      toast.error(err?.message || "Erro ao gerar o plano");
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    }
  };

  const roomLabel = (roomId: string | null) => {
    if (!roomId) return "—";
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return "—";
    return `${room.name} (${WEEKDAY_LABELS[room.weekday]?.slice(0, 3) || "?"} ${formatTimeSlot(room.time_slot)} · ${room.week_parity})`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {members.length} membro(s) no Board
        </span>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar membro
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum membro no Board ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const plan = PLAN_STATUS_BADGE[member.plan_status] || {
                    label: member.plan_status,
                    className: "",
                  };
                  const st = MEMBER_STATUS_BADGE[member.status] || {
                    label: member.status,
                    className: "",
                  };
                  const isGenerating =
                    generatingIds.has(member.id) || member.plan_status === "generating";
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.company_name}</TableCell>
                      <TableCell>
                        {member.entry_date
                          ? format(new Date(`${member.entry_date}T12:00:00`), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {roomLabel(member.room_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={plan.className}>
                          {isGenerating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {isGenerating ? "Gerando plano" : plan.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={st.className}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {member.plan_status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isGenerating}
                              onClick={() => generatePlan(member)}
                            >
                              {isGenerating ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 mr-1" />
                              )}
                              Gerar plano com IA
                            </Button>
                          )}
                          {member.plan_status === "review" && (
                            <Button size="sm" onClick={() => setReviewMember(member)}>
                              <ClipboardList className="h-4 w-4 mr-1" />
                              Revisar plano
                            </Button>
                          )}
                          {member.plan_status === "published" && (
                            <>
                              {member.project_id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/onboarding-tasks/${member.project_id}`)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Ver projeto
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onOpenDeliverables(member.company_id)}
                              >
                                <FolderOpen className="h-4 w-4 mr-1" />
                                Entregáveis
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: adicionar membro */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar membro ao Board</DialogTitle>
            <DialogDescription>
              A empresa precisa estar cadastrada e ativa no Nexus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <SearchableSelect
                value={form.company_id}
                onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                placeholder={companiesLoading ? "Carregando..." : "Digite pra buscar a empresa"}
                emptyMessage="Nenhuma empresa encontrada."
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de entrada</Label>
              <Input
                type="date"
                value={form.entry_date}
                onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sala</Label>
              <Select
                value={form.room_id}
                onValueChange={(v) => setForm((f) => ({ ...f, room_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a sala (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — {WEEKDAY_LABELS[r.weekday]} {formatTimeSlot(r.time_slot)} (Semana{" "}
                      {r.week_parity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do dono</Label>
              <Input
                value={form.owner_name}
                placeholder="Quem participa das salas"
                onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp do dono</Label>
              <Input
                value={form.owner_phone}
                placeholder="Ex.: 5531999998888"
                onChange={(e) => setForm((f) => ({ ...f, owner_phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={addMember} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: revisão do plano */}
      {reviewMember && (
        <BoardPlanReviewDialog
          open={!!reviewMember}
          onOpenChange={(open) => !open && setReviewMember(null)}
          memberId={reviewMember.id}
          companyName={reviewMember.company_name || "Empresa"}
          onPublished={() => {
            setReviewMember(null);
            setLoading(true);
            fetchMembers();
          }}
        />
      )}
    </div>
  );
}
