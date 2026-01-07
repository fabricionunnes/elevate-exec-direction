import { Link } from "react-router-dom";
import logoNexus from "@/assets/logo-unv-nexus.png";

interface NexusHeaderProps {
  title?: string;
  showTitle?: boolean;
  className?: string;
}

export const NexusHeader = ({ title, showTitle = true, className = "" }: NexusHeaderProps) => {
  return (
    <Link to="/onboarding-tasks" className={`flex items-center gap-3 ${className}`}>
      <div className="bg-slate-900 rounded-lg p-2">
        <img 
          src={logoNexus} 
          alt="UNV Nexus" 
          className="h-6 sm:h-7 w-auto"
        />
      </div>
      {showTitle && (
        <div>
          <h1 className="text-lg sm:text-2xl font-bold leading-tight text-foreground">
            {title || "UNV Nexus"}
          </h1>
        </div>
      )}
    </Link>
  );
};
