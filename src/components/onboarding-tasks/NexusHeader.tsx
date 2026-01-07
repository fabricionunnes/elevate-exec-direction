import { Link } from "react-router-dom";
import logoNexus from "@/assets/logo-unv-nexus.png";

interface NexusHeaderProps {
  title?: string;
  showTitle?: boolean;
  className?: string;
}

export const NexusHeader = ({ title, showTitle = true, className = "" }: NexusHeaderProps) => {
  return (
    <Link to="/onboarding-tasks" className={`flex items-center gap-2 ${className}`}>
      <img 
        src={logoNexus} 
        alt="UNV Nexus" 
        className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-contain bg-slate-900 p-1"
      />
      {showTitle && (
        <span className="text-lg sm:text-xl font-bold text-foreground whitespace-nowrap">
          {title || "UNV Nexus"}
        </span>
      )}
    </Link>
  );
};
