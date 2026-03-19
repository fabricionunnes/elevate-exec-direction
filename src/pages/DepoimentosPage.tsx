import { Layout } from "@/components/layout/Layout";
import { Play } from "lucide-react";
import { useState } from "react";

interface Testimonial {
  youtubeId: string;
  name: string;
  company: string;
  description: string;
}

const testimonials: Testimonial[] = [
  {
    youtubeId: "pOUL5pil2kk",
    name: "Lucas Viana",
    company: "Pai do Tráfego",
    description: "O \"paizão\" como é conhecido no mercado nacional, o maior player de cursos de gestão de tráfego e dono da maior agência de tráfego do Brasil tem nosso acompanhamento e mudou o resultado dele, mesmo já tendo uma estrutura robusta já funcionando ele escalou absurdamente seus resultados.",
  },
  {
    youtubeId: "r2XWLQlig30",
    name: "Dr. Luis Eduardo",
    company: "Clínica Main",
    description: "Triplicaram as vendas em 3 meses, com um resultado inacreditável em pouquíssimo tempo, sem precisar baixar preço, trabalhava para pagar contas somente e hoje está expandindo a empresa.",
  },
  {
    youtubeId: "WjlTR6qDhlA",
    name: "Duda",
    company: "Auto Escola Ebenezer",
    description: "Estamos indo para o terceiro mês com a UNV e todos com meta batida.",
  },
  {
    youtubeId: "5oR4WRWMWfw",
    name: "Andrea Silva",
    company: "Papelaria Print Point",
    description: "Andrea hoje consegue sair do operacional e a UNV foi um divisor de águas pra ela, que estava pensando se fechava a empresa ou fechava com a Universidade Vendas, fechou com nossa empresa e hoje está escalando forte e dobrando o resultado.",
  },
  {
    youtubeId: "66pAUJmga0Q",
    name: "Ivânia",
    company: "Instituto Mix",
    description: "Ivânia saiu completamente do operacional para se tornar de fato uma empresária de sucesso graças ao acompanhamento da Universidade Vendas. \"Tem dia que eu chego na unidade e penso, acho que vou embora porque não tem nada mais pra fazer\".",
  },
  {
    youtubeId: "pVdibOvP7E0",
    name: "Italínea",
    company: "Loja de móveis planejados",
    description: "Cliente da Italinea que já no primeiro mês teve seu investimento na Universidade Vendas já pago com resultados expressivos.",
  },
  {
    youtubeId: "gC2z0ewic0c",
    name: "Osvani",
    company: "Douramor Semijóias & JG Modas",
    description: "\"Não é o valor que você paga, é o investimento que você faz na sua empresa e na sua vida\". \"A cabeça chega a explodir de tanta informação\".",
  },
  {
    youtubeId: "S21kboTipGY",
    name: "William",
    company: "LP Distribuidora",
    description: "William já fez outros treinamentos com os vendedores mas eles não engajavam, e agora com o Fabrício Nunnes como diretor comercial fez ele abrir novos horizontes, inclusive suporte psicológico, porque o empresário as vezes fica perdido mas não sabe o que fazer, e alguém de fora falando o impacto é bem maior.",
  },
  {
    youtubeId: "2yoOB9HoQ6A",
    name: "Luis Fernando",
    company: "Marmoraria e Posto Shell",
    description: "Luis Fernando no primeiro mês bateu recorde de vendas da história da empresa com mais de 7 anos no mercado.",
  },
  {
    youtubeId: "mPonfVY9wEw",
    name: "Suave Estética",
    company: "Empresa de estética",
    description: "A cliente dobrou suas vendas nos 3 primeiros meses, mesmo já tendo tido outros mentorados, com a Universidade Vendas ela conseguiu alavancar suas vendas consideravelmente.",
  },
  {
    youtubeId: "u298wufExDA",
    name: "Fabiana",
    company: "Zziphus",
    description: "Depoimento da Fabiana, onde em apenas dois meses os serviços da Universidade Nacional de Vendas já foram 100% pagos.",
  },
  {
    youtubeId: "I5xH75GX_DM",
    name: "Jeniffer",
    company: "Instituto Mix - Escola de cursos profissionais",
    description: "Jeniffer teve toda equipe montada pela Universidade Vendas obtendo os resultados esperados.",
  },
  {
    youtubeId: "LUbT6srAeRM",
    name: "Franciscarla",
    company: "Le Fran Perfumaria",
    description: "Franciscarla na sua primeira ação já teve o investimento na Universidade Vendas pago, em menos de 15 dias.",
  },
  {
    youtubeId: "lYYYUNxSC5w",
    name: "Rede Orto",
    company: "Rede Orto",
    description: "Depoimento da Rede Orto sobre os resultados alcançados com a Universidade Vendas.",
  },
  {
    youtubeId: "Mw24mKQ30LI",
    name: "Valéria",
    company: "Vidroflex Vidros e Acessórios",
    description: "Depoimento da Valéria sobre a transformação nos resultados da Vidroflex com o acompanhamento da Universidade Vendas.",
  },
];

function VideoCard({ testimonial }: { testimonial: Testimonial }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="group rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-video bg-muted">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${testimonial.youtubeId}?autoplay=1&rel=0`}
            title={`Depoimento - ${testimonial.name}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full cursor-pointer"
          >
            <img
              src={`https://img.youtube.com/vi/${testimonial.youtubeId}/hqdefault.jpg`}
              alt={`Depoimento de ${testimonial.name}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-7 h-7 text-primary-foreground ml-1" />
              </div>
            </div>
          </button>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-lg text-foreground">{testimonial.name}</h3>
        <p className="text-sm text-primary font-medium mb-2">{testimonial.company}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{testimonial.description}</p>
      </div>
    </div>
  );
}

export default function DepoimentosPage() {
  return (
    <Layout>
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Casos de Sucesso
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Depoimentos de quem <span className="text-primary">transformou</span> seus resultados
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Veja o que nossos clientes têm a dizer sobre a transformação que a Universidade Vendas trouxe para seus negócios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <VideoCard key={t.youtubeId} testimonial={t} />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
