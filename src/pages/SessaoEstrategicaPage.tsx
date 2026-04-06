import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Loader2, CheckCircle, Target, TrendingUp, Users, BarChart3, Zap, Award } from "lucide-react";
import fabricioHero from "@/assets/fabricio-hero.png";
import fabricioMentor from "@/assets/fabricio-mentor.png";

const FORM_TOKEN = "b4116f2e0b338035238f5750a7436135";

const cards = [
  { icon: Target, title: "Têm metas de vendas", desc: "mas o time não consegue bater todos os meses" },
  { icon: TrendingUp, title: "Querem escalar", desc: "mas não sabem como estruturar o processo comercial" },
  { icon: Users, title: "Têm um time de vendas", desc: "mas os vendedores estão desmotivados e sem direção" },
  { icon: BarChart3, title: "Investem em marketing", desc: "mas os leads não se convertem em vendas reais" },
  { icon: Zap, title: "Precisam de velocidade", desc: "para aumentar o faturamento ainda este mês" },
  { icon: Award, title: "Querem alta performance", desc: "e vendedores que realmente façam a diferença" },
];

const SessaoEstrategicaPage = () => {
  const [searchParams] = useSearchParams();
  const [showPopup, setShowPopup] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone || !email.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-pipeline-form`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_token: FORM_TOKEN,
            nome: nome.trim(),
            telefone: telefone,
            email: email.trim(),
            utm_source: searchParams.get("utm_source") || undefined,
            utm_medium: searchParams.get("utm_medium") || undefined,
            utm_campaign: searchParams.get("utm_campaign") || undefined,
            utm_content: searchParams.get("utm_content") || undefined,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao enviar");

      // Redirect to the pipeline form with lead_id so it skips step 1
      const leadId = data.lead_id;
      window.location.hash = `/form/${FORM_TOKEN}?lead_id=${leadId}`;
    } catch (err: any) {
      setError(err.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  const openPopup = () => setShowPopup(true);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(220,38,38,0.08)_0%,_transparent_60%)]" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-0">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 lg:space-y-8">
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-red-400 font-medium">
                Análise exclusiva para empresários que têm times de vendas e querem ter vendedores de alta performance
              </p>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight">
                ANÁLISE INDIVIDUAL{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-600">
                  GRATUITA
                </span>
              </h1>

              <h2 className="text-lg sm:text-xl lg:text-2xl text-gray-300 font-medium leading-relaxed">
                Quer um time de vendas que bate metas todos os meses?{" "}
                <span className="text-white font-semibold">Descubra como as melhores empresas fazem isso!</span>
              </h2>

              <p className="text-gray-400 text-base lg:text-lg leading-relaxed">
                Seus vendedores estão perdidos e você não sabe mais o que fazer para{" "}
                <strong className="text-white">aumentar as vendas?</strong> Agende uma{" "}
                <strong className="text-white">reunião gratuita</strong> com minha equipe. Vamos olhar juntos para sua empresa,{" "}
                <strong className="text-white">identificar o que está travando seu crescimento</strong> e criar um{" "}
                <strong className="text-white">plano para você vender mais ainda este mês!</strong>
              </p>

              <div className="space-y-3">
                <Button
                  onClick={openPopup}
                  size="lg"
                  className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-base sm:text-lg px-8 sm:px-12 py-6 sm:py-7 rounded-lg shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_40px_rgba(220,38,38,0.5)] transition-all duration-300 w-full sm:w-auto"
                >
                  QUERO AUMENTAR MINHAS VENDAS
                </Button>
                <p className="text-sm text-gray-500">
                  <span className="line-through">De R$ 297,00</span>{" "}
                  <span className="text-red-400 font-bold">por R$ 0,00</span>
                </p>
              </div>
            </div>

            <div className="hidden lg:flex justify-center">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-t from-red-600/10 via-transparent to-transparent rounded-full blur-3xl" />
                <img
                  src={fabricioHero}
                  alt="Fabricio - Mentor de Vendas"
                  className="relative z-10 max-h-[600px] object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12 sm:mb-16">
            A análise estratégica é para empresários que:
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cards.map((card, i) => (
              <div
                key={i}
                className="group p-6 sm:p-8 rounded-2xl border border-gray-800/50 bg-gray-900/30 hover:border-red-500/30 hover:bg-gray-900/60 transition-all duration-300"
              >
                <card.icon className="h-8 w-8 sm:h-10 sm:w-10 text-red-500 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg sm:text-xl font-bold mb-2">{card.title}</h3>
                <p className="text-gray-400 text-sm sm:text-base">{card.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12 sm:mt-16">
            <Button
              onClick={openPopup}
              size="lg"
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-base sm:text-lg px-8 sm:px-12 py-6 sm:py-7 rounded-lg shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_40px_rgba(220,38,38,0.5)] transition-all duration-300"
            >
              QUERO AUMENTAR MINHAS VENDAS
            </Button>
          </div>
        </div>
      </section>

      {/* Mentor Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="flex justify-center lg:order-2">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-b from-red-600/10 to-transparent rounded-full blur-3xl" />
                <img
                  src={fabricioMentor}
                  alt="Fabricio"
                  className="relative z-10 max-h-[500px] object-contain rounded-2xl"
                />
              </div>
            </div>
            <div className="space-y-6 lg:order-1">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                QUEM É O SEU <span className="text-red-500">MENTOR?</span>
              </h2>
              <div className="space-y-4 text-gray-300 text-base sm:text-lg leading-relaxed">
                <p>
                  Empresário, mentor, diretor de vendas, <strong className="text-white">criador da Universidade Nacional de Vendas.</strong>{" "}
                  Com mais de 20 anos de experiência na área e uma década como diretor comercial, atualmente atende diversas empresas que{" "}
                  <strong className="text-white">faturam entre 6 a 7 dígitos todos os meses.</strong>
                </p>
                <p>
                  Alcançou a marca de <strong className="text-white">mais de 1 bilhão em vendas</strong> de serviços e produtos. Com toda a experiência adquirida, decidiu focar o seu trabalho em empresários de pequenas e médias empresas que desejam escalar o seu negócio.
                </p>
                <p>
                  Sua principal missão é fazer com que cada um <strong className="text-white">alcance suas metas regularmente, aumente seu faturamento</strong> e consiga estruturar um negócio totalmente <strong className="text-white">autogerenciável</strong> que traz <strong className="text-white">resultados exponenciais</strong> e mais <strong className="text-white">qualidade de vida.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-t from-gray-950 to-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
            Resultados de quem já é nosso <span className="text-red-500">cliente</span>
          </h2>
          <Button
            onClick={openPopup}
            size="lg"
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-base sm:text-lg px-8 sm:px-12 py-6 sm:py-7 rounded-lg shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_40px_rgba(220,38,38,0.5)] transition-all duration-300"
          >
            FAZER INSCRIÇÃO GRATUITA
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800/50 text-center text-sm text-gray-600">
        Todos os direitos reservados | Universidade Nacional de Vendas LTDA
      </footer>

      {/* Popup Form */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md bg-gray-950 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Preencha seus dados</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="popup-nome" className="text-gray-300">Nome completo *</Label>
              <Input
                id="popup-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                maxLength={200}
                className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup-telefone" className="text-gray-300">WhatsApp com DDD *</Label>
              <PhoneInput
                id="popup-telefone"
                value={telefone}
                onChange={setTelefone}
                required
                className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup-email" className="text-gray-300">E-mail *</Label>
              <Input
                id="popup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                placeholder="seu@email.com"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-6 text-lg shadow-[0_0_20px_rgba(220,38,38,0.3)]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                "QUERO MINHA ANÁLISE GRATUITA"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessaoEstrategicaPage;
