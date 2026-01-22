import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import logoNexus from "@/assets/logo-unv-nexus.png";

const ShowcaseFooter = () => {
  return (
    <footer className="py-12 border-t border-border/50 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <img 
              src={logoNexus} 
              alt="UNV Nexus" 
              className="h-10 w-10 rounded-lg object-contain"
            />
            <span className="text-xl font-bold text-foreground">UNV Nexus</span>
          </div>
          
          <Link to="/onboarding-tasks/login">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <LogIn className="w-4 h-4 mr-2" />
              Acessar Portal
            </Button>
          </Link>
          
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} UNV Holdings. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ShowcaseFooter;
