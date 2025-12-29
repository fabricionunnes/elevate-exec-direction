import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoUnv from "@/assets/logo-unv.png";
import { supabase } from "@/integrations/supabase/client";

interface ProductItem {
  name: string;
  href: string;
  external?: boolean;
  highlight?: boolean;
}

interface ProductCategory {
  category: string;
  items: ProductItem[];
}

const productCategories: ProductCategory[] = [
  {
    category: "Trilha Principal",
    items: [
      { name: "UNV Core", href: "/core" },
      { name: "UNV Control", href: "/control" },
      { name: "Sales Acceleration", href: "/sales-acceleration", highlight: true },
    ],
  },
  {
    category: "Operação Comercial",
    items: [
      { name: "Sales Ops", href: "/sales-ops" },
      { name: "UNV Sales Force", href: "/sales-force" },
      { name: "Sales System", href: "/ai-sales-system", highlight: true },
      { name: "Fractional CRO", href: "/fractional-cro", highlight: true },
      { name: "UNV Ads", href: "/ads" },
      { name: "UNV Social", href: "/social" },
    ],
  },
  {
    category: "Trilha Avançada",
    items: [
      { name: "Growth Room", href: "/growth-room" },
      { name: "UNV Partners", href: "/partners" },
      { name: "UNV Mastermind", href: "/mastermind", highlight: true },
    ],
  },
  {
    category: "Estratégia & Estrutura",
    items: [
      { name: "UNV Leadership", href: "/leadership" },
      { name: "Le Désir", href: "/le-desir" },
      { name: "UNV Finance", href: "/finance" },
      { name: "UNV People", href: "/people" },
      { name: "UNV Safe", href: "/safe" },
    ],
  },
  {
    category: "Outros",
    items: [
      { name: "Mansão Empreendedora", href: "https://mansaoempreendedora.com.br", external: true, highlight: true },
      { name: "Comparar Produtos", href: "/compare" },
    ],
  },
];

const navigation = [
  { name: "Serviços", href: "/products", hasSubmenu: true },
  { name: "Preços", href: "/pricing" },
  { name: "Diagnóstico", href: "/diagnostico" },
  { name: "FAQ", href: "/faq" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const isProductActive = productCategories.some(cat =>
    cat.items.some(item => location.pathname === item.href)
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <nav className="container-premium flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img 
            src={logoUnv} 
            alt="UNV - Universidade Nacional de Vendas" 
            className="h-10 md:h-12 w-auto transition-all duration-300 group-hover:scale-105" 
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navigation.map((item) => (
            <div key={item.name} className="relative group">
              {item.hasSubmenu ? (
                <button
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-all duration-300",
                    isProductActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onMouseEnter={() => setProductsOpen(true)}
                  onMouseLeave={() => setProductsOpen(false)}
                >
                  {item.name}
                  <ChevronDown className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
                </button>
              ) : (
                <Link
                  to={item.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-all duration-300 relative",
                    location.pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.name}
                  <span className={cn(
                    "absolute bottom-0 left-4 right-4 h-0.5 bg-primary transform origin-left transition-transform duration-300",
                    location.pathname === item.href ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  )} />
                </Link>
              )}

              {/* Products Mega Menu */}
              {item.hasSubmenu && (
                <div
                  className={cn(
                    "absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
                  )}
                  onMouseEnter={() => setProductsOpen(true)}
                  onMouseLeave={() => setProductsOpen(false)}
                >
                  <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl p-4 min-w-[600px]">
                    <div className="grid grid-cols-3 gap-4">
                      {productCategories.slice(0, 3).map((cat) => (
                        <div key={cat.category}>
                          <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                            {cat.category}
                          </p>
                          <div className="space-y-1">
                            {cat.items.map((product) => (
                              product.external ? (
                                <a
                                  key={product.href}
                                  href={product.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                >
                                  {product.name}
                                  <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
                                </a>
                              ) : (
                                <Link
                                  key={product.href}
                                  to={product.href}
                                className={cn(
                                    "block px-3 py-2 text-sm rounded-lg transition-all duration-300",
                                    location.pathname === product.href
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                  )}
                                >
                                  {product.name}
                                </Link>
                              )
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/30">
                      {productCategories.slice(3).map((cat) => (
                        <div key={cat.category}>
                          <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                            {cat.category}
                          </p>
                          <div className="space-y-1">
                            {cat.items.map((product) => (
                              product.external ? (
                                <a
                                  key={product.href}
                                  href={product.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                >
                                  {product.name}
                                  <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
                                </a>
                              ) : (
                                <Link
                                  key={product.href}
                                  to={product.href}
                                className={cn(
                                    "block px-3 py-2 text-sm rounded-lg transition-all duration-300",
                                    location.pathname === product.href
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                  )}
                                >
                                  {product.name}
                                </Link>
                              )
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-3">
          {isLoggedIn && (
            <Link to="/for-closers">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Qual produto é ideal?
              </Button>
            </Link>
          )}
          <Link to="/diagnostico">
            <Button variant="premium" size="default">
              Aplicar para Diagnóstico
            </Button>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2 text-foreground hover:text-primary transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-background/95 backdrop-blur-xl border-t border-border/30 animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="container-premium py-6 space-y-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.hasSubmenu ? (
                  <div>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary/50 rounded-lg transition-all"
                      onClick={() => setProductsOpen(!productsOpen)}
                    >
                      {item.name}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-300",
                          productsOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {productsOpen && (
                      <div className="pl-2 space-y-1 mt-1 animate-fade-in">
                        {productCategories.map((cat) => (
                          <div key={cat.category}>
                            <button
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 rounded-lg transition-all"
                              onClick={() => toggleCategory(cat.category)}
                            >
                              {cat.category}
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform duration-300",
                                  expandedCategories.includes(cat.category) && "rotate-90"
                                )}
                              />
                            </button>
                            {expandedCategories.includes(cat.category) && (
                              <div className="pl-4 space-y-1 mt-1 animate-fade-in">
                                {cat.items.map((product) => (
                                  product.external ? (
                                    <a
                                      key={product.href}
                                      href={product.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between px-4 py-2 text-sm rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                      onClick={() => setMobileMenuOpen(false)}
                                    >
                                      {product.name}
                                      <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
                                    </a>
                                  ) : (
                                    <Link
                                      key={product.href}
                                      to={product.href}
                                      className={cn(
                                        "block px-4 py-2 text-sm rounded-lg transition-all",
                                        location.pathname === product.href
                                          ? "bg-primary/10 text-primary font-medium"
                                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                      )}
                                      onClick={() => setMobileMenuOpen(false)}
                                    >
                                      {product.name}
                                    </Link>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.href}
                    className="block px-4 py-3 text-sm font-medium hover:bg-secondary/50 rounded-lg transition-all"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
            <div className="pt-6 border-t border-border/30 space-y-3">
              {isLoggedIn && (
                <Link
                  to="/for-closers"
                  className="block"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button variant="outline" className="w-full">
                    Qual produto é ideal?
                  </Button>
                </Link>
              )}
              <Link
                to="/diagnostico"
                className="block"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="premium" className="w-full">
                  Aplicar para Diagnóstico
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
