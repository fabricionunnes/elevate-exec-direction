import { motion } from "framer-motion";
import { LucideIcon, CheckCircle2 } from "lucide-react";

interface ShowcaseModuleSectionProps {
  title: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  imageSrc?: string;
  reversed?: boolean;
}

const ShowcaseModuleSection = ({
  title,
  description,
  features,
  icon: Icon,
  imageSrc,
  reversed = false,
}: ShowcaseModuleSectionProps) => {
  return (
    <section className="py-16 md:py-24 border-t border-border/30">
      <div className="container mx-auto px-4">
        <div className={`flex flex-col ${reversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-12 items-center`}>
          {/* Content */}
          <motion.div 
            className="flex-1"
            initial={{ opacity: 0, x: reversed ? 20 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
            </div>
            
            <p className="text-muted-foreground text-lg mb-6">{description}</p>
            
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Image */}
          <motion.div 
            className="flex-1"
            initial={{ opacity: 0, x: reversed ? -20 : 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {imageSrc ? (
              <div className="rounded-xl overflow-hidden border border-border shadow-2xl shadow-primary/5">
                <img 
                  src={imageSrc} 
                  alt={title} 
                  className="w-full h-auto"
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted/50 rounded-xl border border-border flex items-center justify-center">
                <Icon className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ShowcaseModuleSection;
