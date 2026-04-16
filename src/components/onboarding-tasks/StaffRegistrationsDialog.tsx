import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye, Trash2, RefreshCw, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Registration {
  id: string;
  token: string;
  status: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  cep: string | null;
  street: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  pix_key: string | null;
  cnpj: string | null;
  company_name: string | null;
  trade_name: string | null;
  municipal_registration: string | null;
  created_at: string;
  submitted_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "cs", label: "Customer Success" },
  { value: "consultant", label: "Consultor" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
  { value: "rh", label: "RH" },
  { value: "marketing", label: "Marketing" },
  { value: "financeiro", label: "Financeiro" },
];

function generateTempPassword() {
  return (
    Math.random().toString(36).slice(-8) +
    Math.random().toString(36).slice(-4).toUpperCase() +
    "!9"
  );
}

export function StaffRegistrationsDialog({ open, onOpenChange, onApproved }: Props) {
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selected, setSelected] = useState<Registration | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"submitted" | "pending" | "approved" | "all">("submitted");
  const [search, setSearch] = useState("");

  const [approveRole, setApproveRole] = useState<string>("");
  const [approving, setApproving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff_registrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRegistrations((data || []) as Registration[]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar cadastros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    setApproveRole("");
  }, [selected?.id]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cadastro? Essa ação não pode ser desfeita.")) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from("staff_registrations").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cadastro excluído");
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setDeleting(null);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (!selected.email || !selected.full_name) {
      toast.error("Cadastro sem nome ou e-mail. Não é possível aprovar.");
      return;
    }
    if (!approveRole) {
      toast.error("Selecione o cargo do colaborador");
      return;
    }
    setApproving(true);
    try {
      // 1) Cria login + onboarding_staff (com senha temporária)
      const tempPassword = generateTempPassword();
      const { data: result, error: fnError } = await supabase.functions.invoke("create-staff-user", {
        body: {
          email: selected.email,
          password: tempPassword,
          name: selected.full_name,
          role: approveRole,
          phone: selected.phone || null,
        },
      });
      if (fnError) throw fnError;
      if ((result as any)?.error) throw new Error((result as any).error);
      const newStaffId = (result as any)?.staff_id as string | undefined;

      // 2) Copia todos os dados do cadastro recebido para onboarding_staff
      if (newStaffId) {
        const fullPayload: any = {
          cpf: selected.cpf,
          rg: selected.rg,
          birth_date: selected.birth_date,
          cep: selected.cep,
          street: selected.street,
          address_number: selected.address_number,
          complement: selected.complement,
          neighborhood: selected.neighborhood,
          city: selected.city,
          state: selected.state,
          bank_name: selected.bank_name,
          bank_agency: selected.bank_agency,
          bank_account: selected.bank_account,
          bank_account_type: selected.bank_account_type,
          pix_key: selected.pix_key,
          cnpj: selected.cnpj,
          company_name: selected.company_name,
          trade_name: selected.trade_name,
          municipal_registration: selected.municipal_registration,
        };
        await supabase.from("onboarding_staff").update(fullPayload).eq("id", newStaffId);
      }

      // 3) Marca cadastro como aprovado
      const updatePayload: any = { status: "approved" };
      if (newStaffId) updatePayload.staff_id = newStaffId;
      await supabase.from("staff_registrations").update(updatePayload).eq("id", selected.id);

      // 3) Envia e-mail para o colaborador definir a senha
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(selected.email, {
        redirectTo: redirectUrl,
      });
      if (resetError) {
        console.warn("Falha ao enviar e-mail de redefinição:", resetError);
        toast.warning("Colaborador criado, mas não foi possível enviar o e-mail de senha automaticamente.");
      } else {
        toast.success("Colaborador aprovado! E-mail enviado para criação da senha.");
      }

      setSelected(null);
      await load();
      onApproved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao aprovar cadastro");
    } finally {
      setApproving(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "submitted") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge>;
    if (status === "pending") return <Badge variant="outline">Pendente</Badge>;
    if (status === "approved") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Aprovado</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastros Recebidos</DialogTitle>
          <DialogDescription>
            Todos os cadastros enviados via link público de cadastro de colaboradores.
          </DialogDescription>
        </DialogHeader>

        {(() => {
          const filtered = registrations.filter((r) => {
            if (statusFilter !== "all" && r.status !== statusFilter) return false;
            if (search) {
              const q = search.toLowerCase();
              return (
                (r.full_name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q) ||
                (r.cpf || "").toLowerCase().includes(q)
              );
            }
            return true;
          });
          const totals = {
            submitted: registrations.filter((r) => r.status === "submitted").length,
            pending: registrations.filter((r) => r.status === "pending").length,
            approved: registrations.filter((r) => r.status === "approved").length,
            all: registrations.length,
          };
          return (
            <>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Enviados ({totals.submitted})</SelectItem>
                    <SelectItem value="approved">Aprovados ({totals.approved})</SelectItem>
                    <SelectItem value="pending">Pendentes ({totals.pending})</SelectItem>
                    <SelectItem value="all">Todos ({totals.all})</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Buscar por nome, email ou CPF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
              <div className="text-sm text-muted-foreground mb-2">
                {filtered.length} cadastro{filtered.length === 1 ? "" : "s"} exibido{filtered.length === 1 ? "" : "s"}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum cadastro encontrado com esses filtros.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recebido em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                        <TableCell>{r.email || "—"}</TableCell>
                        <TableCell>{r.cpf || "—"}</TableCell>
                        <TableCell>{r.phone || "—"}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell>
                          {r.submitted_at
                            ? format(new Date(r.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setSelected(r)} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(r.id)}
                              disabled={deleting === r.id}
                              title="Excluir"
                            >
                              {deleting === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          );
        })()}

        {/* Detalhes */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selected?.full_name || "Cadastro"}</DialogTitle>
              <DialogDescription>Dados completos enviados pelo colaborador</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-6">
                <Section title="Dados Pessoais">
                  <Field label="Nome Completo" value={selected.full_name} />
                  <Field label="Email" value={selected.email} />
                  <Field label="Telefone" value={selected.phone} />
                  <Field label="CPF" value={selected.cpf} />
                  <Field label="RG" value={selected.rg} />
                  <Field
                    label="Data de Nascimento"
                    value={
                      selected.birth_date
                        ? format(new Date(selected.birth_date), "dd/MM/yyyy", { locale: ptBR })
                        : null
                    }
                  />
                </Section>

                <Section title="Endereço">
                  <Field label="CEP" value={selected.cep} />
                  <Field label="Rua" value={selected.street} />
                  <Field label="Número" value={selected.address_number} />
                  <Field label="Complemento" value={selected.complement} />
                  <Field label="Bairro" value={selected.neighborhood} />
                  <Field label="Cidade" value={selected.city} />
                  <Field label="Estado" value={selected.state} />
                </Section>

                <Section title="Dados Bancários">
                  <Field label="Banco" value={selected.bank_name} />
                  <Field label="Agência" value={selected.bank_agency} />
                  <Field label="Conta" value={selected.bank_account} />
                  <Field label="Tipo de Conta" value={selected.bank_account_type} />
                  <Field label="Chave PIX" value={selected.pix_key} />
                </Section>

                <Section title="Dados PJ">
                  <Field label="CNPJ" value={selected.cnpj} />
                  <Field label="Razão Social" value={selected.company_name} />
                  <Field label="Nome Fantasia" value={selected.trade_name} />
                  <Field label="Inscrição Municipal" value={selected.municipal_registration} />
                </Section>

                <Section title="Status">
                  <Field label="Status" value={selected.status} />
                  <Field
                    label="Recebido em"
                    value={
                      selected.submitted_at
                        ? format(new Date(selected.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "Ainda não enviado"
                    }
                  />
                </Section>

                {selected.status !== "approved" && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Aprovar e criar como funcionário
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Ao aprovar, criamos o login do colaborador e enviamos um e-mail para que ele
                      defina a própria senha de acesso ao sistema.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div>
                        <Label className="text-xs">Cargo *</Label>
                        <Select value={approveRole} onValueChange={setApproveRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cargo" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleApprove} disabled={approving || !approveRole}>
                        {approving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4 mr-2" />
                        )}
                        Aprovar e criar funcionário
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3 pb-2 border-b">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground break-words">{value || "—"}</div>
    </div>
  );
}
