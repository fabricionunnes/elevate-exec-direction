import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye, Trash2, RefreshCw } from "lucide-react";
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
}

export function StaffRegistrationsDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selected, setSelected] = useState<Registration | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const statusBadge = (status: string) => {
    if (status === "submitted") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge>;
    if (status === "pending") return <Badge variant="outline">Pendente</Badge>;
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

        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">
            {registrations.length} cadastro{registrations.length === 1 ? "" : "s"} no total
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum cadastro recebido ainda.
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
              {registrations.map((r) => (
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
              </div>
            )}
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
