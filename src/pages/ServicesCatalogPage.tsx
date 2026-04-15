import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Package } from "lucide-react";

interface ServiceItem {
  slug: string;
  name: string;
  description: string | null;
  price: number;
  billing_type: string;
}

export default function ServicesCatalogPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("service_catalog")
      .select("slug, name, description, price, billing_type")
      .eq("is_active", true)
      .not("slug", "is", null)
      .order("name")
      .then(({ data }) => {
        if (data) setServices(data as ServiceItem[]);
        setLoading(false);
      });
  }, []);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-b border-border/30">
        <div className="container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Package className="h-4 w-4" />
            Catálogo de Módulos
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Módulos Extras
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Expanda sua operação comercial com módulos especializados. Contrate individualmente e tenha acesso imediato.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => (
              <Link
                key={s.slug}
                to={`/servico/${s.slug}`}
                className="group relative rounded-xl border border-border/50 bg-card p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="flex flex-col h-full">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    {s.name}
                  </h3>
                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                      {s.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/30">
                    <span className="text-primary font-bold">
                      {fmt(s.price)}
                      {s.billing_type === "monthly" && <span className="text-xs text-muted-foreground font-normal">/mês</span>}
                    </span>
                    <span className="text-sm text-muted-foreground group-hover:text-primary flex items-center gap-1 transition-colors">
                      Ver detalhes
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
