import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

interface OwnerSelectorProps {
  leadId: string;
  currentOwnerId: string | null;
  currentOwnerName?: string | null;
  onOwnerChange?: () => void;
}

export function OwnerSelector({
  leadId,
  currentOwnerId,
  currentOwnerName,
  onOwnerChange,
}: OwnerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadStaffMembers();
    }
  }, [open]);

  const loadStaffMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role, avatar_url")
        .eq("is_active", true)
        .in("role", ["master", "admin", "head_comercial", "closer", "sdr", "social_setter", "bdr"])
        .order("name");

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error("Error loading staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOwner = async (staffId: string | null) => {
    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ owner_staff_id: staffId })
        .eq("id", leadId);

      if (error) throw error;

      toast.success(staffId ? "Responsável atualizado" : "Responsável removido");
      setOpen(false);
      onOwnerChange?.();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar responsável");
    }
  };

  const filteredStaff = staffMembers.filter(
    (staff) =>
      staff.name.toLowerCase().includes(search.toLowerCase()) ||
      staff.email.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      master: "Master",
      admin: "Admin",
      head_comercial: "Head Comercial",
      closer: "Closer",
      sdr: "SDR",
      social_setter: "Social Setter",
      bdr: "BDR",
    };
    return roles[role] || role;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 hover:bg-muted/50 rounded-full p-1 transition-colors cursor-pointer">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(currentOwnerName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar responsável..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <ScrollArea className="max-h-64">
          <div className="p-1">
            {/* Option to remove owner */}
            <button
              onClick={() => handleSelectOwner(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left",
                !currentOwnerId && "bg-primary/10"
              )}
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Sem responsável</p>
              </div>
              {!currentOwnerId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>

            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Nenhum resultado
              </div>
            ) : (
              filteredStaff.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => handleSelectOwner(staff.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left",
                    currentOwnerId === staff.id && "bg-primary/10"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    {staff.avatar_url && <AvatarImage src={staff.avatar_url} />}
                    <AvatarFallback className="text-xs">
                      {getInitials(staff.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{staff.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getRoleName(staff.role)}
                    </p>
                  </div>
                  {currentOwnerId === staff.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
