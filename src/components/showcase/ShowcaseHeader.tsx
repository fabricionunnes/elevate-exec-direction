import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, LogIn } from "lucide-react";

const ShowcaseHeader = () => {
  return (
    <header className="border-b border-white/10 backdrop-blur-sm bg-slate-950/90 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
            <Target className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">UNV Nexus</h1>
            <p className="text-xs text-slate-400">Portal do Cliente</p>
          </div>
        </div>
        <Link to="/portal/login">
          <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
            <LogIn className="w-4 h-4 mr-2" />
            Acessar Portal
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default ShowcaseHeader;
