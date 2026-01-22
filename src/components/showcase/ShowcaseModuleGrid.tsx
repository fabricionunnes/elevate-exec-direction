import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, CheckCircle2 } from "lucide-react";

interface ModuleCard {
  title: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  imageSrc?: string;
}

interface ShowcaseModuleGridProps {
  title: string;
  subtitle: string;
  modules: ModuleCard[];
}

const ShowcaseModuleGrid = ({ title, subtitle, modules }: ShowcaseModuleGridProps) => {
  return (
    <section className="py-16 md:py-24 border-t border-white/5 bg-slate-900/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {modules.map((module, index) => (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/30 transition-colors h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <module.icon className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">{module.title}</h3>
                      <p className="text-slate-400 text-sm mb-4">{module.description}</p>
                      
                      <ul className="space-y-2">
                        {module.features.slice(0, 4).map((feature, fIndex) => (
                          <li key={fIndex} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            <span className="text-slate-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {module.imageSrc && (
                    <div className="mt-4 rounded-lg overflow-hidden border border-white/5">
                      <img 
                        src={module.imageSrc} 
                        alt={module.title}
                        className="w-full h-40 object-cover object-top"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShowcaseModuleGrid;
