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
    <footer className="bg-primary text-primary-foreground">
      <div className="container-premium section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-6">
              <img src={logoUnv} alt="UNV" className="h-12 w-auto brightness-0 invert" />
            </Link>
            <p className="text-primary-foreground/70 text-sm mb-6 max-w-xs">
              Direção Comercial como Serviço. Treinamos, acompanhamos e cobramos
              seu time comercial para acelerar resultados.
            </p>
            <div className="flex gap-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-foreground/60 hover:text-primary-foreground transition-colors"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-foreground/60 hover:text-primary-foreground transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-6">
              Produtos
            </h4>
            <ul className="space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-6">
              Empresa
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-6">
              Contato
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:contato@unv.com.br"
                  className="flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  contato@unv.com.br
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5500000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  WhatsApp
                </a>
              </li>
            </ul>
            <div className="mt-6">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-xs text-primary-foreground/50 hover:text-primary-foreground/70 transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-primary-foreground/10">
          <p className="text-center text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} UNV — Universidade Nacional de Vendas. Todos os
            direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
