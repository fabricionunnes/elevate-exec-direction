import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  QrCode,
  Pencil,
  Camera,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppQRCodeModal } from "@/components/onboarding-tasks/WhatsAppQRCodeModal";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  sector_id: string | null;
  is_default: boolean;
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

interface StaffDevice {
  staff_id: string;
  staff_name: string;
  staff_avatar?: string;
}

interface DevicesSectionProps {
  onBack: () => void;
}

export const DevicesSection = ({ onBack }: DevicesSectionProps) => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [staffDevices, setStaffDevices] = useState<Record<string, StaffDevice[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("devices");
  
  // Modal states
  const [showNewDevice, setShowNewDevice] = useState(false);
  const [showEditDevice, setShowEditDevice] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [qrModalInstance, setQrModalInstance] = useState<WhatsAppInstance | null>(null);
  
  // Form states
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSector, setNewSector] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instancesRes, sectorsRes] = await Promise.all([
        supabase.from("whatsapp_instances").select("*").order("created_at", { ascending: false }),
        supabase.from("crm_service_sectors").select("*").eq("is_active", true).order("sort_order"),
      ]);

      setInstances(instancesRes.data || []);
      setSectors(sectorsRes.data || []);

      // Load staff for each device
      if (instancesRes.data && instancesRes.data.length > 0) {
        const { data: deviceStaff } = await supabase
          .from("crm_service_staff_devices")
          .select(`
            instance_id,
            staff:onboarding_staff(id, name, avatar_url)
          `);

        if (deviceStaff) {
          const staffMap: Record<string, StaffDevice[]> = {};
          deviceStaff.forEach((ds: any) => {
            if (!staffMap[ds.instance_id]) staffMap[ds.instance_id] = [];
            if (ds.staff) {
              staffMap[ds.instance_id].push({
                staff_id: ds.staff.id,
                staff_name: ds.staff.name,
                staff_avatar: ds.staff.avatar_url,
              });
            }
          });
          setStaffDevices(staffMap);
        }
      }
    } catch (error) {
      console.error("Error loading devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = async () => {
    if (!newName.trim()) {
      toast.error("Informe um nome para o dispositivo");
      return;
    }

    setSaving(true);
    try {
      const instanceName = `crm_${Date.now()}`;
      
      // Get webhook URL for Evolution API
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;
      
      // Create instance in Evolution API with webhook
      const { data: evolutionResponse, error: evolutionError } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'create-instance',
          instanceName,
          number: newPhone.trim() || undefined,
          qrcode: true,
          webhookUrl,
        },
      });

      // If Evolution fails, do NOT create a DB record (otherwise we end up with stale instances
      // that don't exist on the STEVO server and QR/connect will always 404).
      if (evolutionError || (evolutionResponse as any)?.error) {
        console.error('Evolution API error:', evolutionError || evolutionResponse);
        const msg =
          (evolutionResponse as any)?.error ||
          (evolutionError as any)?.message ||
          'Falha ao criar instância no servidor do WhatsApp';
        throw new Error(msg);
      }
      
      // Create in database
      const { error } = await supabase.from("whatsapp_instances").insert({
        instance_name: instanceName,
        display_name: newName.trim(),
        phone_number: newPhone.trim() || null,
        sector_id: newSector || null,
        status: "disconnected",
        is_default: instances.length === 0,
      });

      if (error) throw error;
      
      toast.success("Dispositivo criado");
      setShowNewDevice(false);
      setNewName("");
      setNewPhone("");
      setNewSector("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar dispositivo");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDevice = async () => {
    if (!selectedInstance || !newName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          display_name: newName.trim(),
          phone_number: newPhone.trim() || null,
          sector_id: newSector || null,
        })
        .eq("id", selectedInstance.id);

      if (error) throw error;
      
      toast.success("Dispositivo atualizado");
      setShowEditDevice(false);
      setSelectedInstance(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar dispositivo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async (instance: WhatsAppInstance) => {
    if (!confirm("Tem certeza que deseja excluir este dispositivo?")) return;

    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", instance.id);

      if (error) throw error;
      toast.success("Dispositivo excluído");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir dispositivo");
    }
  };

  const openEditDevice = (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setNewName(instance.display_name || instance.instance_name);
    setNewPhone(instance.phone_number || "");
    setNewSector(instance.sector_id || "");
    setShowEditDevice(true);
  };

  const getSectorName = (sectorId: string | null) => {
    if (!sectorId) return "-";
    const sector = sectors.find(s => s.id === sectorId);
    return sector?.name || "-";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500"><span className="w-2 h-2 rounded-full bg-white mr-1" />Conectado</Badge>;
      case "connecting":
        return <Badge className="bg-yellow-500"><span className="w-2 h-2 rounded-full bg-white mr-1 animate-pulse" />Conectando</Badge>;
      default:
        return <Badge variant="destructive"><span className="w-2 h-2 rounded-full bg-white mr-1" />Desconectado</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={onBack} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Configurações
        </button>
        <span>/</span>
        <span>Configuração de canais</span>
        <span>/</span>
        <span className="text-foreground">WhatsApp</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-green-500">
          <MessageCircle className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-semibold">WhatsApp</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
          <TabsTrigger value="users">Usuários e Permissões</TabsTrigger>
          <TabsTrigger value="sectors">Setores</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Seus dispositivos</h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {instances.length} / {instances.length} Dispositivos
              </span>
              <Button onClick={() => setShowNewDevice(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo dispositivo
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NOME DISPOSITIVO</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead>SETORES</TableHead>
                <TableHead>USUÁRIOS NESSE DISPOSITIVO</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => (
                <TableRow key={instance.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 bg-green-500">
                        <AvatarFallback className="bg-green-500 text-white">
                          <MessageCircle className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{instance.display_name || instance.instance_name}</p>
                        {instance.phone_number && (
                          <p className="text-sm text-muted-foreground">{instance.phone_number}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(instance.status)}</TableCell>
                  <TableCell>{getSectorName(instance.sector_id)}</TableCell>
                  <TableCell>
                    <div className="flex -space-x-2">
                      {(staffDevices[instance.id] || []).slice(0, 3).map((staff) => (
                        <Avatar key={staff.staff_id} className="h-8 w-8 border-2 border-background">
                          <AvatarImage src={staff.staff_avatar} />
                          <AvatarFallback className="text-xs">
                            {staff.staff_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {(staffDevices[instance.id]?.length || 0) > 3 && (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                          +{staffDevices[instance.id].length - 3}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {instance.status !== "connected" && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setQrModalInstance(instance)}
                          title="Conectar via QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDevice(instance)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteDevice(instance)}
                        title="Excluir"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {instances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum dispositivo configurado. Clique em "Novo dispositivo" para começar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <p className="text-muted-foreground">Configurações de usuários e permissões do WhatsApp.</p>
        </TabsContent>

        <TabsContent value="sectors" className="mt-4">
          <p className="text-muted-foreground">Configurações de setores.</p>
        </TabsContent>
      </Tabs>

      {/* New Device Dialog */}
      <Dialog open={showNewDevice} onOpenChange={setShowNewDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Dispositivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do dispositivo</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Comercial, Suporte..."
              />
            </div>
            <div className="space-y-2">
              <Label>Número do WhatsApp</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+55 (11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={newSector} onValueChange={setNewSector}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDevice(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDevice} disabled={saving}>
              {saving ? "Criando..." : "Criar dispositivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Device Dialog */}
      <Dialog open={showEditDevice} onOpenChange={setShowEditDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Dispositivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do dispositivo</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Comercial, Suporte..."
              />
            </div>
            <div className="space-y-2">
              <Label>Número do WhatsApp</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+55 (11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={newSector} onValueChange={setNewSector}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDevice(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateDevice} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      {qrModalInstance && (
        <WhatsAppQRCodeModal
          instance={qrModalInstance}
          onClose={() => setQrModalInstance(null)}
          onConnected={() => {
            setQrModalInstance(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
