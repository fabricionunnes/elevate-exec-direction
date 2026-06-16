import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { DialerLivePanel } from "@/components/crm/dialer/DialerLivePanel";
import { DialerQueuePanel } from "@/components/crm/dialer/DialerQueuePanel";
import { DialerDashboard } from "@/components/crm/dialer/DialerDashboard";
import { PhoneCall, ListChecks, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "live" | "queue" | "dashboard";

interface CampaignOpt { id: string; name: string; status: string }

export default function CRMDialerPage() {
  const { staffId } = useCRMContext();
  const [tab, setTab] = useState<Tab>("live");
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);

  const loadCampaigns = async () => {
    const { data } = await supabase.from("crm_dialer_campaigns").select("id, name, status").order("created_at", { ascending: false });
    setCampaigns((data || []) as any);
  };
  useEffect(() => { loadCampaigns(); }, []);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "live", label: "Discador", icon: PhoneCall },
    { key: "queue", label: "Fila & Campanhas", icon: ListChecks },
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
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
        {tab === "live" && <DialerLivePanel campaigns={campaigns} staffId={staffId} />}
        {tab === "queue" && <div className="h-full overflow-auto"><DialerQueuePanel onChanged={loadCampaigns} /></div>}
        {tab === "dashboard" && <div className="h-full overflow-auto"><DialerDashboard /></div>}
      </div>
    </div>
  );
}
