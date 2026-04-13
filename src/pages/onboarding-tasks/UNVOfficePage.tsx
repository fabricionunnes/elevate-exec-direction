import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { ClientUNVOffice } from "@/components/client-office/ClientUNVOffice";

const UNVOfficePage = () => {
  const navigate = useNavigate();

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
        <ClientUNVOffice projectId="staff" />
      </div>
    </div>
  );
};

export default UNVOfficePage;
