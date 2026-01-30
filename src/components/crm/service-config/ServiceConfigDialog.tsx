import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ServiceConfigMenu } from "./ServiceConfigMenu";
import { DevicesSection } from "./DevicesSection";
import { SectorsSection } from "./SectorsSection";
import { QuickResponsesSection } from "./QuickResponsesSection";
import { UsersPermissionsSection } from "./UsersPermissionsSection";
import { ScheduledMessagesSection } from "./ScheduledMessagesSection";
import { NotificationsSection } from "./NotificationsSection";
import { InstagramSection } from "./InstagramSection";

interface ServiceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ServiceConfigDialog = ({ open, onOpenChange }: ServiceConfigDialogProps) => {
  const [currentSection, setCurrentSection] = useState<string | null>(null);

  const handleClose = () => {
    setCurrentSection(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    setCurrentSection(null);
  };

  const renderContent = () => {
    switch (currentSection) {
      case "devices":
        return <DevicesSection onBack={handleBack} />;
      case "sectors":
        return <SectorsSection onBack={handleBack} />;
      case "quick-responses":
        return <QuickResponsesSection onBack={handleBack} />;
      case "permissions":
        return <UsersPermissionsSection onBack={handleBack} />;
      case "scheduled":
        return <ScheduledMessagesSection onBack={handleBack} />;
      case "notifications":
        return <NotificationsSection onBack={handleBack} />;
      case "instagram":
        return <InstagramSection onBack={handleBack} />;
      default:
        return (
          <ServiceConfigMenu
            onSelectSection={setCurrentSection}
            onClose={handleClose}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) handleClose();
      else onOpenChange(o);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
