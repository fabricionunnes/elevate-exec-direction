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
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
      <nav className="container-premium flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUnv} alt="UNV - Universidade Nacional de Vendas" className="h-10 md:h-12 w-auto" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navigation.map((item) => (
            <div key={item.name} className="relative group">
              {item.children ? (
                <button
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors",
                    location.pathname.startsWith("/products") ||
                      item.children.some((c) => location.pathname === c.href)
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onMouseEnter={() => setProductsOpen(true)}
                  onMouseLeave={() => setProductsOpen(false)}
                >
                  {item.name}
                  <ChevronDown className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  to={item.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors",
                    location.pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.name}
                </Link>
              )}

              {/* Dropdown */}
              {item.children && (
                <div
                  className={cn(
                    "absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
                  )}
                  onMouseEnter={() => setProductsOpen(true)}
                  onMouseLeave={() => setProductsOpen(false)}
                >
                  <div className="bg-card border border-border rounded-lg shadow-premium p-2 min-w-[220px]">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={cn(
                          "block px-4 py-2.5 text-sm rounded-md transition-colors",
                          child.highlight
                            ? "font-medium text-accent hover:bg-accent/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
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
        <div className="hidden lg:flex items-center gap-4">
          <Link to="/for-closers">
            <Button variant="ghost" size="sm">
              Para Closers
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
          className="lg:hidden p-2"
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
        <div className="lg:hidden bg-background border-t border-border">
          <div className="container-premium py-4 space-y-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <div>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
                      onClick={() => setProductsOpen(!productsOpen)}
                    >
                      {item.name}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          productsOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {productsOpen && (
                      <div className="pl-4 space-y-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className={cn(
                              "block px-4 py-2 text-sm",
                              child.highlight
                                ? "text-accent font-medium"
                                : "text-muted-foreground"
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
                    className="block px-4 py-3 text-sm font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
            <div className="pt-4 border-t border-border space-y-2">
              <Link
                to="/for-closers"
                className="block"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="outline" className="w-full">
                  Para Closers
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
