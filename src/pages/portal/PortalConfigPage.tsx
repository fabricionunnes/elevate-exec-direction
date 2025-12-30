import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Building2, 
  Users, 
  Copy, 
  Check, 
  UserPlus,
  Mail,
  Shield,
  Loader2,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  portal_companies?: {
    id: string;
    name: string;
    invite_code: string;
  };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const PortalConfigPage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [company, setCompany] = useState<{ id: string; name: string; invite_code: string } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [sendingInvite, setSendingInvite] = useState(false);

  const isAdmin = user?.role === "admin_company" || user?.role === "admin_unv";

  useEffect(() => {
    loadData();
  }, [user?.company_id]);

  const loadData = async () => {
    if (!user?.company_id) return;

    try {
      // Load company
      const { data: companyData } = await supabase
        .from("portal_companies")
        .select("id, name, invite_code")
        .eq("id", user.company_id)
        .single();

      if (companyData) {
        setCompany(companyData);
      }

      // Load team members
      const { data: membersData } = await supabase
        .from("portal_users")
        .select("id, name, email, role, created_at")
        .eq("company_id", user.company_id)
        .order("created_at");

      if (membersData) {
        setTeamMembers(membersData);
      }

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = async () => {
    if (!company?.invite_code) return;
    
    const link = `${window.location.origin}/portal/signup?company=${company.invite_code}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !company) {
      toast.error("Digite um email válido");
      return;
    }

    setSendingInvite(true);

    try {
      const { data, error } = await supabase
        .from("portal_invites")
        .insert([{
          company_id: company.id,
          email: inviteEmail.trim(),
          role: inviteRole as "admin_company" | "admin_unv" | "member",
        }])
        .select()
        .single();

      if (error) throw error;

      const inviteLink = `${window.location.origin}/portal/signup?invite=${data.token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(inviteLink);
      
      toast.success("Convite criado! Link copiado para a área de transferência.");
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("member");

    } catch (error) {
      console.error("Error creating invite:", error);
      toast.error("Erro ao criar convite");
    } finally {
      setSendingInvite(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin_unv": return "Admin UNV";
      case "admin_company": return "Admin";
      case "member": return "Membro";
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin_unv": return "bg-purple-500/10 text-purple-400";
      case "admin_company": return "bg-amber-500/10 text-amber-400";
      default: return "bg-slate-500/10 text-slate-400";
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="h-48 bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl lg:text-3xl font-bold text-white mb-8">Configurações</h1>

      {/* Company Info */}
      <Card className="bg-slate-900/50 border-slate-800 mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-white">Empresa</CardTitle>
              <CardDescription className="text-slate-400">Informações da sua empresa</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Nome da Empresa</Label>
            <Input
              value={company?.name || ""}
              disabled
              className="bg-slate-800/50 border-slate-700 text-white"
            />
          </div>

          {isAdmin && company?.invite_code && (
            <div className="space-y-2">
              <Label className="text-slate-300">Link de Convite da Empresa</Label>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}/portal/signup?company=${company.invite_code}`}
                  readOnly
                  className="bg-slate-800/50 border-slate-700 text-slate-400 text-sm"
                />
                <Button
                  variant="outline"
                  onClick={copyInviteLink}
                  className="border-slate-700 text-slate-300 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Compartilhe este link para convidar membros para sua empresa.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-white">Equipe</CardTitle>
                <CardDescription className="text-slate-400">
                  {teamMembers.length} membro{teamMembers.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>

            {isAdmin && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Convidar
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Convidar Membro</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Envie um convite por email para adicionar um novo membro à equipe.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Email</Label>
                      <Input
                        type="email"
                        placeholder="email@empresa.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Função</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="admin_company">Admin da Empresa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setInviteDialogOpen(false)}
                      className="text-slate-400"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={sendInvite}
                      disabled={sendingInvite}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950"
                    >
                      {sendingInvite ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Criar Convite
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{member.name}</p>
                    <p className="text-slate-400 text-sm">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                    {getRoleLabel(member.role)}
                  </span>
                  {member.id === user?.id && (
                    <span className="text-xs text-slate-500">(você)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* LGPD Section */}
      <Card className="bg-slate-900/50 border-slate-800 mt-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-white">Privacidade e Dados</CardTitle>
              <CardDescription className="text-slate-400">LGPD e proteção de dados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="border-slate-700 text-slate-300">
            Exportar Meus Dados
          </Button>
          <p className="text-xs text-slate-500">
            Você pode solicitar a exclusão dos seus dados a qualquer momento entrando em contato com o suporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalConfigPage;
