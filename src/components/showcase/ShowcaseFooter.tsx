import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, LogIn } from "lucide-react";

const ShowcaseFooter = () => {
  return (
    <footer className="py-12 border-t border-white/5 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-slate-950" />
            </div>
            <span className="text-xl font-bold text-white">UNV Nexus</span>
          </div>
          
          <Link to="/portal/login">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
              <LogIn className="w-4 h-4 mr-2" />
              Acessar Portal
            </Button>
          </Link>
          
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} UNV Holdings. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ShowcaseFooter;
