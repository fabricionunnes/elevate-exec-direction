import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Pencil, Phone, Mail, Building, Upload } from "lucide-react";
import type { ClientContact, ClientPipeline, ClientStage } from "./hooks/useClientCRM";
import { ClientCRMImportDialog } from "./ClientCRMImportDialog";

interface Props {
  contacts: ClientContact[];
  projectId: string;
  pipelines: ClientPipeline[];
  stages: ClientStage[];
  activePipelineId: string | null;
  onCreateContact: (contact: Partial<ClientContact>) => Promise<void>;
  onUpdateContact: (id: string, updates: Partial<ClientContact>) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onRefresh: () => void;
}

const emptyContact = { name: "", email: "", phone: "", company: "", role: "", document: "", notes: "" };

export const ClientCRMContacts = ({ contacts, projectId, pipelines, stages, activePipelineId, onCreateContact, onUpdateContact, onDeleteContact, onRefresh }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClientContact | null>(null);
  const [form, setForm] = useState(emptyContact);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = contacts.filter((c) =>
    [c.name, c.email, c.phone, c.company].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const openEdit = (contact: ClientContact) => {
    setEditing(contact);
    setForm({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      role: contact.role || "",
      document: contact.document || "",
      notes: contact.notes || "",
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyContact);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await onUpdateContact(editing.id, form);
      } else {
        await onCreateContact(form);
      }
      setShowForm(false);
      setForm(emptyContact);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contatos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4" /> Importar
        </Button>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Contato" : "Novo Contato"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                <Input placeholder="Cargo" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <Input placeholder="CPF/CNPJ" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
              <Textarea placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full">
                {saving ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Contato"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>
                      {contact.company && (
                        <span className="flex items-center gap-1 text-sm">
                          <Building className="h-3 w-3" /> {contact.company}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone && (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.email && (
                        <span className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" /> {contact.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(contact)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteContact(contact.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClientCRMImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        type="contacts"
        projectId={projectId}
        pipelines={pipelines}
        stages={stages}
        activePipelineId={activePipelineId}
        onImportComplete={onRefresh}
      />
    </div>
  );
};
