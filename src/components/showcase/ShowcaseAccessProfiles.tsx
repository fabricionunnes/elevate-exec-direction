import { motion } from "framer-motion";
import { 
  Shield, 
  UserCog, 
  Users, 
  Briefcase, 
  DollarSign, 
  Package,
  Lock
} from "lucide-react";

const profiles = [
  {
    name: "Admin",
    description: "Acesso total ao sistema",
    icon: Shield,
    color: "from-red-500 to-red-600",
  },
  {
    name: "Gerente",
    description: "Gestão de equipe e relatórios",
    icon: UserCog,
    color: "from-purple-500 to-purple-600",
  },
  {
    name: "Vendedor",
    description: "Vendas, clientes e metas",
    icon: Users,
    color: "from-blue-500 to-blue-600",
  },
  {
    name: "RH",
    description: "Recrutamento e candidatos",
    icon: Briefcase,
    color: "from-green-500 to-green-600",
  },
  {
    name: "Financeiro",
    description: "Contas e fluxo de caixa",
    icon: DollarSign,
    color: "from-amber-500 to-amber-600",
  },
  {
    name: "Estoque",
    description: "Produtos e fornecedores",
    icon: Package,
    color: "from-cyan-500 to-cyan-600",
  },
];

const ShowcaseAccessProfiles = () => {
  return (
    <section className="py-16 md:py-24 border-t border-white/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full mb-4">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-300">Segurança e Controle de Acesso</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Perfis de Acesso
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Cada usuário vê apenas os dados e funcionalidades relevantes para seu papel. 
            Segurança e privacidade garantidas por isolamento completo de dados.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="text-center"
            >
              <div className={`w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br ${profile.color} flex items-center justify-center shadow-lg`}>
                <profile.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-1">{profile.name}</h3>
              <p className="text-slate-500 text-xs">{profile.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 p-6 bg-slate-900/50 border border-slate-800 rounded-xl text-center"
        >
          <p className="text-slate-300">
            <strong className="text-amber-400">Isolamento de dados:</strong> Cada empresa e usuário 
            opera em um ambiente completamente separado. Dados de uma empresa nunca são visíveis para outra.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ShowcaseAccessProfiles;
