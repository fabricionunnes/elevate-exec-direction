import logoUnv from "@/assets/logo-unv.png";

export function ServiceSalesFooter() {
  return (
    <footer className="py-10 px-4 border-t border-white/10 bg-[hsl(214,65%,12%)]">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <img src={logoUnv} alt="UNV" className="h-6 opacity-60" />
        <p className="text-white/30 text-sm text-center">
          © {new Date().getFullYear()} Universidade de Vendas. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
