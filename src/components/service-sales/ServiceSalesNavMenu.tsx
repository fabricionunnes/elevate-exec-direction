import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Package } from "lucide-react";

interface ServiceItem {
  slug: string;
  name: string;
  price: number;
  billing_type: string;
}

export function ServiceSalesNavMenu() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("service_catalog")
      .select("slug, name, price, billing_type")
      .eq("is_active", true)
      .not("slug", "is", null)
      .order("name")
      .then(({ data }) => {
        if (data) setServices(data as ServiceItem[]);
      });
  }, []);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
      >
        <Package className="h-4 w-4" />
        Serviços
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-[hsl(214,65%,12%)] shadow-2xl backdrop-blur-lg z-50">
          <div className="p-2">
            {services.map((s) => (
              <Link
                key={s.slug}
                to={`/servico/${s.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors group"
              >
                <span className="text-sm text-white/90 group-hover:text-white truncate mr-2">
                  {s.name}
                </span>
                <span className="text-xs text-white/50 whitespace-nowrap">
                  {fmt(s.price)}{s.billing_type === "monthly" ? "/mês" : ""}
                </span>
              </Link>
            ))}
            {services.length === 0 && (
              <p className="text-white/40 text-sm text-center py-4">Carregando...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
