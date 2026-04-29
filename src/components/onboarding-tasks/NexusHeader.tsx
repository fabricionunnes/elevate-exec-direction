import { Link } from "react-router-dom";
import logoNexus from "@/assets/logo-unv-nexus.png";
import { useTenant } from "@/contexts/TenantContext";

interface NexusHeaderProps {
  title?: string;
  showTitle?: boolean;
  className?: string;
}

export const NexusHeader = ({ title, showTitle = true, className = "" }: NexusHeaderProps) => {
  const { isWhiteLabel, platformName, logoUrl } = useTenant();

  const displayLogo = logoUrl || logoNexus;
  const displayName = title || platformName;

  return (
    <Link to="/onboarding-tasks" className={`flex min-w-0 items-center gap-2 ${className}`}>
      <img 
        src={displayLogo} 
        alt={displayName} 
        className="h-9 w-9 shrink-0 rounded-lg object-contain bg-muted p-1 sm:h-12 sm:w-12"
      />
      {showTitle && (
        <span className="min-w-0 truncate text-base font-bold text-foreground sm:text-xl">
          {displayName}
        </span>
      )}
    </Link>
  );
};
