import { Link } from "react-router-dom";
import { Linkedin, Instagram, Mail, Phone } from "lucide-react";
import logoUnv from "@/assets/logo-unv.png";

const footerLinks = {
  products: [
    { name: "Sales Acceleration", href: "/sales-acceleration" },
    { name: "UNV Core", href: "/core" },
    { name: "UNV Control", href: "/control" },
    { name: "Growth Room", href: "/growth-room" },
    { name: "UNV Partners", href: "/partners" },
    { name: "Sales Ops", href: "/sales-ops" },
  ],
  company: [
    { name: "Nosso Método", href: "/how-it-works" },
    { name: "Aplicar", href: "/apply" },
    { name: "FAQ", href: "/faq" },
    { name: "Para Closers", href: "/for-closers" },
  ],
  legal: [
    { name: "Termos e Disclaimers", href: "/terms" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-card border-t border-border/30">
      <div className="container-premium section-padding">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-6 group">
              <img 
                src={logoUnv} 
                alt="UNV" 
                className="h-12 w-auto brightness-0 invert transition-all duration-300 group-hover:scale-105" 
              />
            </Link>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs leading-relaxed">
              Direção Comercial como Serviço. Treinamos, acompanhamos e cobramos
              seu time comercial para acelerar resultados.
            </p>
            <div className="flex gap-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-primary mb-6">
              Produtos
            </h4>
            <ul className="space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-primary mb-6">
              Empresa
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-primary mb-6">
              Contato
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:contato@unv.com.br"
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-all duration-300 group"
                >
                  <span className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 transition-all">
                    <Mail className="h-4 w-4" />
                  </span>
                  contato@unv.com.br
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5500000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-all duration-300 group"
                >
                  <span className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 transition-all">
                    <Phone className="h-4 w-4" />
                  </span>
                  WhatsApp
                </a>
              </li>
            </ul>
            <div className="mt-6">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="divider-glow mt-16 mb-8" />
        
        <p className="text-center text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} UNV — Universidade Nacional de Vendas. Todos os
          direitos reservados.
        </p>
      </div>
    </footer>
  );
}
