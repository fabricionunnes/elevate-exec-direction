import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, ArrowRight } from "lucide-react";

// Aparece no portal do cliente só se o discador estiver habilitado pra ele.
export function DialerPortalBanner() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("onboarding_users")
        .select("dialer_enabled")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data?.dialer_enabled) setEnabled(true);
    })();
    return () => { active = false; };
  }, []);

  if (!enabled) return null;

  return (
    <Link to="/discador" className="block">
      <div className="mx-3 sm:mx-4 mt-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Phone className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Discador</p>
          <p className="text-xs text-muted-foreground">Acesse seu discador — ligações, gravações e carteira.</p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary shrink-0" />
      </div>
    </Link>
  );
}
