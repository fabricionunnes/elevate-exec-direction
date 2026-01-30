import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  ChevronLeft,
  Search,
  MessageCircle,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { InstanceAccessDialog } from "./InstanceAccessDialog";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: string;
}

interface StaffDevice {
  staff_id: string;
  instance_id: string;
  instance_name: string;
  instance_type: string;
}

interface UsersPermissionsSectionProps {
  onBack: () => void;
}

export const UsersPermissionsSection = ({ onBack }: UsersPermissionsSectionProps) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffDevices, setStaffDevices] = useState<Record<string, StaffDevice[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, avatar_url, role")
        .eq("is_active", true)
        .order("name");

      setStaff(staffData || []);

      // Load device assignments from whatsapp_instance_access
      const { data: accessData } = await supabase
        .from("whatsapp_instance_access")
        .select(`
          staff_id,
          instance_id,
          can_view,
          can_send,
          instance:whatsapp_instances(instance_name, display_name)
        `)
        .eq("can_view", true);

      const deviceMap: Record<string, StaffDevice[]> = {};
      (accessData || []).forEach((d: any) => {
        if (!deviceMap[d.staff_id]) deviceMap[d.staff_id] = [];
        if (d.instance) {
          deviceMap[d.staff_id].push({
            staff_id: d.staff_id,
            instance_id: d.instance_id,
            instance_name: d.instance.display_name || d.instance.instance_name,
            instance_type: "whatsapp",
          });
        }
      });
      setStaffDevices(deviceMap);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openAccessDialog = (member: StaffMember) => {
    setSelectedStaff(member);
    setAccessDialogOpen(true);
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin" || role === "master") {
      return <Badge variant="secondary">Administrador</Badge>;
    }
    return <Badge variant="outline">Personalizado</Badge>;
  };

  const filtered = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={onBack} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Configurações
        </button>
        <span>/</span>
        <span className="text-foreground">Usuários e Permissões</span>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Usuários e Permissões</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie os acessos e permissões de atendimento
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar usuário
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>USUÁRIO</TableHead>
            <TableHead>DISPOSITIVO</TableHead>
            <TableHead>PERMISSÕES DE ATENDIMENTO</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback>
                      {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {(staffDevices[member.id] || []).length > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1">
                      {staffDevices[member.id].map((d) => (
                        <div
                          key={d.instance_id}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs"
                          title={d.instance_name}
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span className="max-w-[80px] truncate">{d.instance_name}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openAccessDialog(member)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="text-sm text-primary hover:underline"
                    onClick={() => openAccessDialog(member)}
                  >
                    + Vincular conexão
                  </button>
                )}
              </TableCell>
              <TableCell>{getRoleBadge(member.role)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Instance Access Dialog */}
      {selectedStaff && (
        <InstanceAccessDialog
          open={accessDialogOpen}
          onOpenChange={setAccessDialogOpen}
          staffId={selectedStaff.id}
          staffName={selectedStaff.name}
          onAccessUpdated={loadData}
        />
      )}
    </div>
  );
};
