import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import ClientUNVOffice from "@/components/client-office/ClientUNVOffice";
import { supabase } from "@/integrations/supabase/client";

const UNVOfficePage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <NexusHeader title="UNV Office" />
        </div>
      </div>
      <div className="p-0">
        <ClientUNVOffice projectId="staff" currentUserId={userId} />
      </div>
    </div>
  );
};

export default UNVOfficePage;
