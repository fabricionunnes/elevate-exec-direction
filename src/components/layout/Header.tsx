import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoUnv from "@/assets/logo-unv.png";

const navigation = [
  { name: "Método", href: "/how-it-works" },
  {
    name: "Produtos",
    href: "/products",
    children: [
      { name: "Sales Acceleration", href: "/sales-acceleration", highlight: true },
      { name: "UNV Core", href: "/core" },
      { name: "UNV Control", href: "/control" },
      { name: "Growth Room", href: "/growth-room" },
      { name: "UNV Partners", href: "/partners" },
      { name: "Sales Ops", href: "/sales-ops" },
      { name: "UNV Ads", href: "/ads" },
      { name: "UNV Social", href: "/social" },
      { name: "UNV Mastermind", href: "/mastermind", highlight: true },
      { name: "Comparar Produtos", href: "/compare" },
    ],
  },
  { name: "FAQ", href: "/faq" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <nav className="container-premium flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img 
            src={logoUnv} 
            alt="UNV - Universidade Nacional de Vendas" 
            className="h-10 md:h-12 w-auto brightness-0 invert transition-all duration-300 group-hover:scale-105" 
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navigation.map((item) => (
            <div key={item.name} className="relative group">
              {item.children ? (
                <button
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-all duration-300",
                    location.pathname.startsWith("/products") ||
                      item.children.some((c) => location.pathname === c.href)
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

              {/* Dropdown */}
              {item.children && (
                <div
                  className={cn(
                    "absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
                  )}
                  onMouseEnter={() => setProductsOpen(true)}
                  onMouseLeave={() => setProductsOpen(false)}
                >
                  <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl p-2 min-w-[240px]">
                    {item.children.map((child, index) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={cn(
                          "block px-4 py-3 text-sm rounded-lg transition-all duration-300",
                          child.highlight
                            ? "font-semibold text-primary hover:bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <Link to="/for-closers">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Qual produto é ideal?
            </Button>
          </Link>
          <Link to="/apply">
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
        <div className="lg:hidden bg-background/95 backdrop-blur-xl border-t border-border/30 animate-fade-in">
          <div className="container-premium py-6 space-y-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
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
                      <div className="pl-4 space-y-1 mt-1 animate-fade-in">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className={cn(
                              "block px-4 py-2.5 text-sm rounded-lg transition-all",
                              child.highlight
                                ? "text-primary font-semibold hover:bg-primary/10"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {child.name}
                          </Link>
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
              <Link
                to="/for-closers"
                className="block"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="outline" className="w-full">
                  Qual produto é ideal?
                </Button>
              </Link>
              <Link
                to="/apply"
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
