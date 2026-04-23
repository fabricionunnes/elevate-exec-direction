import { Link } from "react-router-dom";
import { Linkedin, Instagram, Mail, Phone, Lock } from "lucide-react";
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
    { name: "Diagnóstico", href: "/diagnostico" },
    { name: "FAQ", href: "/faq" },
    { name: "Para Closers", href: "/for-closers" },
  ],
  legal: [
    { name: "Termos e Disclaimers", href: "/terms" },
    { name: "Política de Privacidade", href: "/privacidade" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-card border-t border-border/30">
      <div className="container-premium py-10 sm:py-16 md:py-20">
        {/* Glow effect */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        
        <div className="relative grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-block mb-4 sm:mb-6 group">
              <img 
                src={logoUnv} 
                alt="UNV" 
                className="h-10 sm:h-12 w-auto brightness-0 invert transition-all duration-300 group-hover:scale-105" 
              />
            </Link>
            <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6 max-w-xs leading-relaxed">
              Direção Comercial como Serviço. Treinamos, acompanhamos e cobramos
              seu time comercial para acelerar resultados.
            </p>
            <div className="flex gap-3 sm:gap-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
              >
                <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
              >
                <Instagram className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-primary mb-4 sm:mb-6">
              Serviços
            </h4>
            <ul className="space-y-2 sm:space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-primary mb-4 sm:mb-6">
              Empresa
            </h4>
            <ul className="space-y-2 sm:space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-primary mb-4 sm:mb-6">
              Contato
            </h4>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <a
                  href="mailto:fabricio@universidadevendas.com.br"
                  className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-all duration-300 group"
                >
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 transition-all flex-shrink-0">
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  fabricio@universidadevendas.com.br
                </a>
              </li>
              <li>
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-muted-foreground">WhatsApp</p>
                    <p className="text-foreground font-medium">(31) 99912-0003</p>
                  </div>
                </div>
              </li>
            </ul>
            <div className="mt-4 sm:mt-6 flex flex-col gap-1.5">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-[10px] sm:text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="divider-glow mt-10 sm:mt-12 md:mt-16 mb-6 sm:mb-8" />
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[10px] sm:text-xs text-muted-foreground/60 text-center sm:text-left">
            © {new Date().getFullYear()} UNV — Universidade Nacional de Vendas. Todos os
            direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/privacidade"
              className="text-[10px] sm:text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Política de Privacidade
            </Link>
            <Link
              to="/terms"
              className="text-[10px] sm:text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Termos
            </Link>
            <Link 
              to="/admin" 
              className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <Lock className="h-3 w-3" />
              Área Restrita
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
