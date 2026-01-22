import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import logoNexus from "@/assets/logo-unv-nexus.png";

const ShowcaseHeader = () => {
  return (
    <header className="border-b border-border/50 backdrop-blur-sm bg-background/95 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={logoNexus} 
            alt="UNV Nexus" 
            className="h-10 w-10 rounded-lg object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-foreground">UNV Nexus</h1>
            <p className="text-xs text-muted-foreground">Portal do Cliente</p>
          </div>
        </div>
        <Link to="/onboarding-tasks/login">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            <LogIn className="w-4 h-4 mr-2" />
            Acessar Portal
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default ShowcaseHeader;
