import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { DialerLivePanel } from "@/components/crm/dialer/DialerLivePanel";
import { DialerQueuePanel } from "@/components/crm/dialer/DialerQueuePanel";
import { DialerDashboard } from "@/components/crm/dialer/DialerDashboard";
import { DialerCallsHistory } from "@/components/crm/dialer/DialerCallsHistory";
import { DialerWalletPanel } from "@/components/crm/dialer/DialerWalletPanel";
import { DialerAdminPanel } from "@/components/crm/dialer/DialerAdminPanel";
import { DialerClientsAdmin } from "@/components/crm/dialer/DialerClientsAdmin";
import { DialerLiveAgentsPanel } from "@/components/crm/dialer/DialerLiveAgentsPanel";
import { DialerCoachPanel } from "@/components/crm/dialer/DialerCoachPanel";
import { PhoneCall, ListChecks, BarChart3, Mic, Wallet, Settings2, Users, Radio, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "live" | "team" | "queue" | "calls" | "coach" | "dashboard" | "wallet" | "admin" | "clients";

interface CampaignOpt { id: string; name: string; status: string }

export default function CRMDialerPage() {
  const { staffId, staffName, isAdmin, tenantId } = useCRMContext();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);

  const loadCampaigns = async () => {
    const { data } = await supabase.from("crm_dialer_campaigns").select("id, name, status").order("created_at", { ascending: false });
    setCampaigns((data || []) as any);
  };
  useEffect(() => { loadCampaigns(); }, []);

  const isUnvAdmin = isAdmin && !tenantId; // staff UNV (não cliente)
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "live", label: "Discador", icon: PhoneCall },
    ...(isAdmin ? [{ key: "team" as Tab, label: "Ao vivo", icon: Radio }] : []),
    { key: "queue", label: "Fila & Campanhas", icon: ListChecks },
    { key: "calls", label: "Ligações", icon: Mic },
    { key: "coach", label: "Coach", icon: GraduationCap },
    { key: "wallet", label: "Carteira", icon: Wallet },
    ...(isUnvAdmin ? [
      { key: "clients" as Tab, label: "Clientes", icon: Users },
      { key: "admin" as Tab, label: "Admin", icon: Settings2 },
    ] : []),
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Discador</p>
        <div className="flex items-center gap-1 mt-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "live" && <DialerLivePanel campaigns={campaigns} staffId={staffId} tenantId={tenantId} />}
        {tab === "team" && isAdmin && <div className="h-full overflow-auto"><DialerLiveAgentsPanel /></div>}
        {tab === "queue" && <div className="h-full overflow-auto"><DialerQueuePanel onChanged={loadCampaigns} tenantId={tenantId} currentAgentId={staffId} currentAgentName={staffName} /></div>}
        {tab === "calls" && <div className="h-full overflow-auto"><DialerCallsHistory /></div>}
        {tab === "coach" && <div className="h-full overflow-auto"><DialerCoachPanel staffId={staffId} isAdmin={isAdmin} /></div>}
        {tab === "wallet" && <div className="h-full overflow-auto"><DialerWalletPanel tenantId={tenantId} /></div>}
        {tab === "clients" && isUnvAdmin && <div className="h-full overflow-auto"><DialerClientsAdmin /></div>}
        {tab === "admin" && isUnvAdmin && <div className="h-full overflow-auto"><DialerAdminPanel /></div>}
        {tab === "dashboard" && <div className="h-full overflow-auto"><DialerDashboard isAdmin={isUnvAdmin} /></div>}
      </div>
    </div>
  );
}
