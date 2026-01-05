import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  User,
  Phone,
  Mail,
  Building2,
  FileText,
  Download,
  Upload,
  Loader2,
  UserCircle,
  Users,
  Briefcase,
  Edit2,
  Save,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhone } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  role: string;
  type: "partner" | "sales";
  phone: string;
  email: string;
  notes?: string;
}

interface Contract {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader_name?: string;
}

interface ContactsContractsPanelProps {
  companyId: string;
  isAdmin: boolean;
}

export const ContactsContractsPanel = ({ companyId, isAdmin }: ContactsContractsPanelProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    type: "partner",
    name: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
  });
  

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch company to get stakeholders
      const { data: company, error: companyError } = await supabase
        .from("onboarding_companies")
        .select("stakeholders")
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;

      // Parse stakeholders as contacts
      const stakeholders = (company?.stakeholders as unknown as Contact[]) || [];
      setContacts(stakeholders);

      // Fetch contracts (documents with category 'contract')
      const { data: docs, error: docsError } = await supabase
        .from("onboarding_documents")
        .select(`
          id, file_name, file_path, file_size, file_type, created_at, uploaded_by,
          uploader:onboarding_users(name)
        `)
        .eq("company_id", companyId)
        .eq("category", "contract")
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;

      setContracts(
        (docs || []).map((doc: any) => ({
          ...doc,
          uploader_name: doc.uploader?.name || "Desconhecido",
        }))
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const saveContacts = async (updatedContacts: Contact[]) => {
    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ stakeholders: JSON.parse(JSON.stringify(updatedContacts)) })
        .eq("id", companyId);

      if (error) throw error;
      setContacts(updatedContacts);
      toast.success("Contatos salvos");
    } catch (error) {
      console.error("Error saving contacts:", error);
      toast.error("Erro ao salvar contatos");
    }
  };

  const handleAddContact = () => {
    if (!newContact.name || !newContact.type) {
      toast.error("Nome e tipo são obrigatórios");
      return;
    }

    const contact: Contact = {
      id: crypto.randomUUID(),
      name: newContact.name || "",
      role: newContact.role || "",
      type: newContact.type as "partner" | "sales",
      phone: newContact.phone || "",
      email: newContact.email || "",
      notes: newContact.notes,
    };

    const updatedContacts = [...contacts, contact];
    saveContacts(updatedContacts);
    setShowAddContact(false);
    setNewContact({ type: "partner", name: "", role: "", phone: "", email: "", notes: "" });
  };

  const handleUpdateContact = () => {
    if (!editingContact) return;

    const updatedContacts = contacts.map((c) =>
      c.id === editingContact.id ? editingContact : c
    );
    saveContacts(updatedContacts);
    setEditingContact(null);
  };

  const handleDeleteContact = (contactId: string) => {
    const updatedContacts = contacts.filter((c) => c.id !== contactId);
    saveContacts(updatedContacts);
  };

  const triggerContractUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("Arquivo muito grande. Máximo 10MB.");
        document.body.removeChild(input);
        return;
      }

      setUploading(true);
      try {
        const timestamp = Date.now();
        const filePath = `${companyId}/contracts/${timestamp}_${file.name}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("onboarding-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        let uploaderId = null;

        if (user) {
          // Try onboarding_users first
          const { data: onboardingUser } = await supabase
            .from("onboarding_users")
            .select("id")
            .eq("user_id", user.id)
            .single();
          uploaderId = onboardingUser?.id || null;
        }

        // Save document record
        const { error: docError } = await supabase
          .from("onboarding_documents")
          .insert({
            company_id: companyId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            category: "contract",
            uploaded_by: uploaderId,
          });

        if (docError) throw docError;

        toast.success("Contrato anexado com sucesso");
        fetchData();
      } catch (error: any) {
        console.error("Error uploading contract:", error);
        toast.error("Erro ao fazer upload do contrato: " + (error.message || "Erro desconhecido"));
      } finally {
        setUploading(false);
        document.body.removeChild(input);
      }
    };
    document.body.appendChild(input);
    input.click();
  };

  const handleDownloadContract = async (contract: Contract) => {
    try {
      const { data, error } = await supabase.storage
        .from("onboarding-documents")
        .download(contract.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = contract.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading contract:", error);
      toast.error("Erro ao baixar contrato");
    }
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (!confirm("Tem certeza que deseja excluir este contrato?")) return;

    try {
      // Delete from storage
      await supabase.storage
        .from("onboarding-documents")
        .remove([contract.file_path]);

      // Delete from database
      const { error } = await supabase
        .from("onboarding_documents")
        .delete()
        .eq("id", contract.id);

      if (error) throw error;

      toast.success("Contrato excluído");
      fetchData();
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast.error("Erro ao excluir contrato");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const partnerContacts = contacts.filter((c) => c.type === "partner");
  const salesContacts = contacts.filter((c) => c.type === "sales");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="contacts" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="h-4 w-4" />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="h-4 w-4" />
            Contratos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          <div className="space-y-6">
            {/* Partners */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Sócios / Decisores
                </CardTitle>
                {isAdmin && (
                  <Dialog open={showAddContact && newContact.type === "partner"} onOpenChange={(open) => {
                    setShowAddContact(open);
                    if (open) setNewContact({ ...newContact, type: "partner" });
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Sócio/Decisor</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Nome *</Label>
                          <Input
                            value={newContact.name || ""}
                            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                            placeholder="Nome completo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo</Label>
                          <Input
                            value={newContact.role || ""}
                            onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                            placeholder="Ex: CEO, Diretor Comercial"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input
                              value={newContact.phone || ""}
                              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                              placeholder="(11) 99999-9999"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                              type="email"
                              value={newContact.email || ""}
                              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                              placeholder="email@empresa.com"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea
                            value={newContact.notes || ""}
                            onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                            placeholder="Informações adicionais..."
                            rows={2}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowAddContact(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleAddContact}>Adicionar</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {partnerContacts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum sócio cadastrado
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {partnerContacts.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        isAdmin={isAdmin}
                        onEdit={() => setEditingContact(contact)}
                        onDelete={() => handleDeleteContact(contact.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sales Team */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Vendedores
                </CardTitle>
                {isAdmin && (
                  <Dialog open={showAddContact && newContact.type === "sales"} onOpenChange={(open) => {
                    setShowAddContact(open);
                    if (open) setNewContact({ ...newContact, type: "sales" });
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Vendedor</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Nome *</Label>
                          <Input
                            value={newContact.name || ""}
                            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                            placeholder="Nome completo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo</Label>
                          <Input
                            value={newContact.role || ""}
                            onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                            placeholder="Ex: SDR, Closer, Gestor"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input
                              value={newContact.phone || ""}
                              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                              placeholder="(11) 99999-9999"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                              type="email"
                              value={newContact.email || ""}
                              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                              placeholder="email@empresa.com"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea
                            value={newContact.notes || ""}
                            onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                            placeholder="Informações adicionais..."
                            rows={2}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowAddContact(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleAddContact}>Adicionar</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {salesContacts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum vendedor cadastrado
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {salesContacts.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        isAdmin={isAdmin}
                        onEdit={() => setEditingContact(contact)}
                        onDelete={() => handleDeleteContact(contact.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Contratos e Documentos
              </CardTitle>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={triggerContractUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Anexar Contrato
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum contrato anexado</p>
                  {isAdmin && (
                    <p className="text-sm mt-1">Clique em "Anexar Contrato" para adicionar</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{contract.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(contract.file_size)} • {format(new Date(contract.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            {contract.uploader_name && ` • ${contract.uploader_name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDownloadContract(contract)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteContract(contract)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={editingContact.role}
                  onChange={(e) => setEditingContact({ ...editingContact, role: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={editingContact.phone}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={editingContact.email}
                    onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={editingContact.notes || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingContact(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateContact}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Contact Card Component
const ContactCard = ({
  contact,
  isAdmin,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">{contact.name}</p>
            {contact.role && (
              <Badge variant="secondary" className="text-xs mt-1">
                {contact.role}
              </Badge>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3" />
            <a href={`tel:${contact.phone.replace(/\D/g, '')}`} className="hover:text-primary">
              {formatPhone(contact.phone)}
            </a>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3" />
            <a href={`mailto:${contact.email}`} className="hover:text-primary">
              {contact.email}
            </a>
          </div>
        )}
        {contact.notes && (
          <p className="text-xs mt-2 text-muted-foreground/70">{contact.notes}</p>
        )}
      </div>
    </div>
  );
};
