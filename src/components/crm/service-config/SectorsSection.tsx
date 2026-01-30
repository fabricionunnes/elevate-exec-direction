import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  Search,
  Star,
  Heart,
  Bookmark,
  User,
  ShoppingCart,
  Clock,
  Settings,
  Building2,
  Phone,
  Mail,
  Globe,
  Zap,
  Target,
  Flag,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Sector {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
}

interface SectorStaff {
  sector_id: string;
  staff_id: string;
  staff_name: string;
  staff_email: string;
  staff_avatar?: string;
}

interface Staff {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface SectorsSectionProps {
  onBack: () => void;
}

const iconOptions = [
  { value: "star", icon: Star },
  { value: "heart", icon: Heart },
  { value: "bookmark", icon: Bookmark },
  { value: "user", icon: User },
  { value: "shopping-cart", icon: ShoppingCart },
  { value: "clock", icon: Clock },
  { value: "settings", icon: Settings },
  { value: "building", icon: Building2 },
  { value: "phone", icon: Phone },
  { value: "mail", icon: Mail },
  { value: "globe", icon: Globe },
  { value: "zap", icon: Zap },
  { value: "target", icon: Target },
  { value: "flag", icon: Flag },
  { value: "award", icon: Award },
];

const colorOptions = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#1e293b", "#64748b", "#94a3b8",
];

export const SectorsSection = ({ onBack }: SectorsSectionProps) => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorStaff, setSectorStaff] = useState<Record<string, SectorStaff[]>>({});
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [showNewSector, setShowNewSector] = useState(false);
  const [showEditSector, setShowEditSector] = useState(false);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  
  // Form states
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("star");
  const [newColor, setNewColor] = useState("#6366f1");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sectorsRes, staffRes, sectorStaffRes, devicesRes] = await Promise.all([
        supabase.from("crm_service_sectors").select("*").order("sort_order"),
        supabase.from("onboarding_staff").select("id, name, email, avatar_url").eq("is_active", true),
        supabase.from("crm_service_sector_staff").select(`
          sector_id,
          staff:onboarding_staff(id, name, email, avatar_url)
        `),
        supabase.from("whatsapp_instances").select("id, sector_id"),
      ]);

      setSectors(sectorsRes.data || []);
      setAllStaff(staffRes.data || []);

      // Map staff to sectors
      const staffMap: Record<string, SectorStaff[]> = {};
      (sectorStaffRes.data || []).forEach((ss: any) => {
        if (!staffMap[ss.sector_id]) staffMap[ss.sector_id] = [];
        if (ss.staff) {
          staffMap[ss.sector_id].push({
            sector_id: ss.sector_id,
            staff_id: ss.staff.id,
            staff_name: ss.staff.name,
            staff_email: ss.staff.email,
            staff_avatar: ss.staff.avatar_url,
          });
        }
      });
      setSectorStaff(staffMap);

      // Count devices per sector
      const counts: Record<string, number> = {};
      (devicesRes.data || []).forEach((d) => {
        if (d.sector_id) {
          counts[d.sector_id] = (counts[d.sector_id] || 0) + 1;
        }
      });
      setDeviceCounts(counts);
    } catch (error) {
      console.error("Error loading sectors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSector = async () => {
    if (!newName.trim()) {
      toast.error("Informe um nome para o setor");
      return;
    }

    setSaving(true);
    try {
      const { data: newSector, error } = await supabase
        .from("crm_service_sectors")
        .insert({
          name: newName.trim(),
          icon: newIcon,
          color: newColor,
          sort_order: sectors.length,
        })
        .select()
        .single();

      if (error) throw error;

      // Add staff to sector
      if (selectedStaffIds.length > 0) {
        await supabase.from("crm_service_sector_staff").insert(
          selectedStaffIds.map((staffId) => ({
            sector_id: newSector.id,
            staff_id: staffId,
          }))
        );
      }
      
      toast.success("Setor criado");
      setShowNewSector(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar setor");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSector = async () => {
    if (!selectedSector || !newName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_service_sectors")
        .update({
          name: newName.trim(),
          icon: newIcon,
          color: newColor,
        })
        .eq("id", selectedSector.id);

      if (error) throw error;

      // Update staff - remove all and re-add
      await supabase.from("crm_service_sector_staff").delete().eq("sector_id", selectedSector.id);
      
      if (selectedStaffIds.length > 0) {
        await supabase.from("crm_service_sector_staff").insert(
          selectedStaffIds.map((staffId) => ({
            sector_id: selectedSector.id,
            staff_id: staffId,
          }))
        );
      }
      
      toast.success("Setor atualizado");
      setShowEditSector(false);
      setSelectedSector(null);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar setor");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSector = async (sector: Sector) => {
    if (!confirm("Tem certeza que deseja excluir este setor?")) return;

    try {
      const { error } = await supabase
        .from("crm_service_sectors")
        .delete()
        .eq("id", sector.id);

      if (error) throw error;
      toast.success("Setor excluído");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir setor");
    }
  };

  const openEditSector = (sector: Sector) => {
    setSelectedSector(sector);
    setNewName(sector.name);
    setNewIcon(sector.icon);
    setNewColor(sector.color);
    setSelectedStaffIds((sectorStaff[sector.id] || []).map((s) => s.staff_id));
    setShowEditSector(true);
  };

  const resetForm = () => {
    setNewName("");
    setNewIcon("star");
    setNewColor("#6366f1");
    setSelectedStaffIds([]);
    setStaffSearch("");
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find((i) => i.value === iconName);
    if (iconOption) {
      const IconComp = iconOption.icon;
      return <IconComp className="h-4 w-4" />;
    }
    return <Star className="h-4 w-4" />;
  };

  const filteredSectors = sectors.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStaff = allStaff.filter((s) =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(staffSearch.toLowerCase())
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
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={onBack} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Configurações
        </button>
        <span>/</span>
        <span className="text-foreground">Setores</span>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Setores</h2>
        <p className="text-sm text-muted-foreground">Gerencie seus setores</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowNewSector(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo setor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SETOR</TableHead>
            <TableHead>CONTA/DISPOSITIVO</TableHead>
            <TableHead>ATENDENTES</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSectors.map((sector) => (
            <TableRow key={sector.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg text-white"
                    style={{ backgroundColor: sector.color }}
                  >
                    {getIconComponent(sector.icon)}
                  </div>
                  <span className="font-medium">{sector.name}</span>
                </div>
              </TableCell>
              <TableCell>{deviceCounts[sector.id] || 0}</TableCell>
              <TableCell>{(sectorStaff[sector.id] || []).length}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditSector(sector)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteSector(sector)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filteredSectors.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Nenhum setor encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* New/Edit Sector Dialog */}
      <Dialog open={showNewSector || showEditSector} onOpenChange={(open) => {
        if (!open) {
          setShowNewSector(false);
          setShowEditSector(false);
          setSelectedSector(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSector ? "Editar setor" : "Novo setor"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Nome do setor</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Comercial, Suporte..."
              />
            </div>

            <div className="space-y-2">
              <Label>Adicione usuários a este setor</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Adicione um usuário no setor" />
                </SelectTrigger>
                <SelectContent>
                  {allStaff.map((staff) => (
                    <SelectItem 
                      key={staff.id} 
                      value={staff.id}
                      onClick={() => toggleStaff(staff.id)}
                    >
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Usuários selecionados</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="h-7 pl-7 text-xs w-32"
                    />
                  </div>
                </div>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {filteredStaff.filter(s => selectedStaffIds.includes(s.id)).map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={staff.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {staff.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{staff.name}</p>
                          <p className="text-xs text-muted-foreground">{staff.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => toggleStaff(staff.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {selectedStaffIds.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Nenhum usuário selecionado
                    </p>
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Cores</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: newColor }}
                >
                  {getIconComponent(newIcon)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "w-5 h-5 rounded-full border-2",
                        newColor === color ? "border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Ícones</Label>
              <div className="flex flex-wrap gap-2">
                {iconOptions.map((opt) => {
                  const IconComp = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      className={cn(
                        "p-2 rounded-lg border transition-colors",
                        newIcon === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      )}
                      onClick={() => setNewIcon(opt.value)}
                    >
                      <IconComp className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewSector(false);
              setShowEditSector(false);
              setSelectedSector(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={selectedSector ? handleUpdateSector : handleCreateSector} 
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
