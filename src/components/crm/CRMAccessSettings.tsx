import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// Roles that can access CRM (commercial sector)
const CRM_ELIGIBLE_ROLES = ["closer", "sdr", "head_comercial", "social_setter", "bdr"];
const ALL_ROLES_WITH_CRM = ["master", "admin", ...CRM_ELIGIBLE_ROLES];

const ROLE_LABELS: Record<string, string> = {
  master: "Master",
  admin: "Administrador",
  closer: "Closer",
  sdr: "SDR",
  head_comercial: "Head Comercial",
  social_setter: "Social Setter",
  bdr: "BDR",
  cs: "CS",
  consultant: "Consultor",
  rh: "RH",
  financeiro: "Financeiro",
  marketing: "Marketing",
};

const ROLE_COLORS: Record<string, string> = {
  master: "bg-gradient-to-r from-amber-500 to-yellow-400 text-white",
  admin: "bg-purple-100 text-purple-800",
  closer: "bg-cyan-100 text-cyan-800",
  sdr: "bg-teal-100 text-teal-800",
  head_comercial: "bg-orange-100 text-orange-800",
  social_setter: "bg-indigo-100 text-indigo-800",
  bdr: "bg-emerald-100 text-emerald-800",
  cs: "bg-blue-100 text-blue-800",
  consultant: "bg-green-100 text-green-800",
  rh: "bg-pink-100 text-pink-800",
  financeiro: "bg-slate-100 text-slate-800",
  marketing: "bg-rose-100 text-rose-800",
};

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  has_crm_access: boolean;
}

export const CRMAccessSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  useEffect(() => {
    loadStaffWithCRMAccess();
  }, []);

  const loadStaffWithCRMAccess = async () => {
    setLoading(true);
    try {
      // Fetch all active staff
      const { data: staff, error: staffError } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role, avatar_url, is_active")
        .eq("is_active", true)
        .order("name");

      if (staffError) throw staffError;

      // Fetch CRM permissions
      const { data: permissions, error: permError } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      if (permError) throw permError;

      const permissionSet = new Set((permissions || []).map(p => p.staff_id));

      // Map staff with CRM access info
      const staffWithAccess: StaffMember[] = (staff || []).map(s => ({
        ...s,
        has_crm_access: 
          s.role === "master" || 
          s.role === "admin" || 
          permissionSet.has(s.id)
      }));

      setStaffMembers(staffWithAccess);
    } catch (error) {
      console.error("Error loading staff:", error);
      toast.error("Erro ao carregar equipe");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async (staff: StaffMember) => {
    // Can't toggle access for master/admin - they always have access
    if (staff.role === "master" || staff.role === "admin") {
      toast.info("Administradores sempre têm acesso ao CRM");
      return;
    }

    setSaving(staff.id);
    try {
      if (staff.has_crm_access) {
        // Remove permission
        const { error } = await supabase
          .from("staff_menu_permissions")
          .delete()
          .eq("staff_id", staff.id)
          .eq("menu_key", "crm");
        
        if (error) throw error;
        toast.success(`Acesso ao CRM removido para ${staff.name}`);
      } else {
        // Add permission
        const { error } = await supabase
          .from("staff_menu_permissions")
          .insert({ staff_id: staff.id, menu_key: "crm" });
        
        if (error) throw error;
        toast.success(`Acesso ao CRM concedido para ${staff.name}`);
      }

      // Update local state
      setStaffMembers(prev => 
        prev.map(s => 
          s.id === staff.id 
            ? { ...s, has_crm_access: !s.has_crm_access }
            : s
        )
      );
    } catch (error: any) {
      console.error("Error toggling access:", error);
      toast.error(error.message || "Erro ao alterar acesso");
    } finally {
      setSaving(null);
    }
  };

  // Group staff by role type
  const commercialStaff = staffMembers.filter(s => 
    CRM_ELIGIBLE_ROLES.includes(s.role)
  );
  const adminStaff = staffMembers.filter(s => 
    s.role === "master" || s.role === "admin"
  );
  const otherStaff = staffMembers.filter(s => 
    !CRM_ELIGIBLE_ROLES.includes(s.role) && 
    s.role !== "master" && 
    s.role !== "admin"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const StaffList = ({ 
    staff, 
    title, 
    description, 
    allowToggle = true,
    icon: Icon
  }: { 
    staff: StaffMember[]; 
    title: string; 
    description: string;
    allowToggle?: boolean;
    icon: typeof Users;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum membro encontrado
          </p>
        ) : (
          <div className="space-y-3">
            {staff.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.name}</span>
                      <Badge className={ROLE_COLORS[member.role] || "bg-gray-100 text-gray-800"}>
                        {ROLE_LABELS[member.role] || member.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {member.has_crm_access && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {allowToggle ? (
                    <Switch
                      checked={member.has_crm_access}
                      onCheckedChange={() => handleToggleAccess(member)}
                      disabled={saving === member.id || member.role === "master" || member.role === "admin"}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Acesso automático</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-6 w-6 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Controle de Acessos ao CRM</h3>
              <p className="text-sm text-blue-700 mt-1">
                Defina quais membros da equipe têm acesso ao módulo de CRM. 
                Administradores e Master sempre têm acesso. Para o setor comercial 
                (Closer, SDR, Head Comercial, Social Setter, BDR), você pode 
                habilitar ou desabilitar individualmente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Staff - Always have access */}
      {adminStaff.length > 0 && (
        <StaffList
          staff={adminStaff}
          title="Administração"
          description="Master e Administradores sempre têm acesso total ao CRM"
          allowToggle={false}
          icon={Shield}
        />
      )}

      {/* Commercial Staff - Configurable */}
      <StaffList
        staff={commercialStaff}
        title="Setor Comercial"
        description="Closers, SDRs, Head Comercial, Social Setters e BDRs"
        allowToggle={true}
        icon={Users}
      />

      {/* Other Staff - Configurable */}
      {otherStaff.length > 0 && (
        <StaffList
          staff={otherStaff}
          title="Outras Áreas"
          description="Outros membros da equipe que podem precisar de acesso ao CRM"
          allowToggle={true}
          icon={Users}
        />
      )}
    </div>
  );
};
