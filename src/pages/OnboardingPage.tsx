import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap, Users, Sparkles, Play, ArrowLeft } from "lucide-react";
import { productDetails } from "@/data/productDetails";
import { productCategories } from "@/data/onboardingContent";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  "trilha-principal": "from-primary to-blue-600",
  "operacao-comercial": "from-violet-500 to-purple-600",
  "trilha-avancada": "from-amber-500 to-orange-500",
  "estrategia-estrutura": "from-emerald-500 to-teal-500",
  outros: "from-pink-500 to-rose-500",
};

const OnboardingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/3 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="relative border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <Button variant="ghost" size="icon" className="absolute left-4 top-4" asChild>
              <Link to="/onboarding-tasks">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="relative">
              <div className="p-5 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-xl shadow-primary/20">
                <GraduationCap className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1.5 bg-accent rounded-lg">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Onboarding de Serviços
              </h1>
              <p className="text-muted-foreground text-lg">
                Apresentações interativas para o time de Customer Success
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative container mx-auto px-4 py-10">
        {/* Info Banner */}
        <Card className="mb-10 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 overflow-hidden">
          <CardContent className="flex flex-col md:flex-row items-center gap-6 py-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="p-4 bg-primary/10 rounded-xl shrink-0">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center md:text-left">
              <p className="font-semibold text-lg mb-1">Para uso interno do time de Customer Success</p>
              <p className="text-muted-foreground">
                Clique em qualquer serviço para iniciar a apresentação de slides com os entregáveis e benefícios.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Products by Category */}
        {Object.entries(productCategories).map(([categoryKey, category], categoryIndex) => (
          <section key={categoryKey} className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className={cn(
                "h-1 w-12 rounded-full bg-gradient-to-r",
                categoryColors[categoryKey]
              )} />
              <h2 className="text-2xl font-bold">{category.name}</h2>
              <Badge variant="outline" className="ml-auto">
                {category.products.length} serviços
              </Badge>
            </div>
            
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {category.products.map((productId, productIndex) => {
                const product = productDetails[productId];
                if (!product) return null;
                const ProductIcon = product.icon;
                
                return (
                  <Link
                    key={productId}
                    to={`/onboarding/${productId}`}
                    className="group block"
                    style={{
                      animationDelay: `${(categoryIndex * 100) + (productIndex * 50)}ms`,
                    }}
                  >
                    <Card className={cn(
                      "relative h-full overflow-hidden transition-all duration-500",
                      "hover:shadow-2xl hover:shadow-primary/10",
                      "hover:-translate-y-1 hover:border-primary/40",
                      "bg-gradient-to-br from-card to-card/50"
                    )}>
                      {/* Hover gradient overlay */}
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-500",
                        categoryColors[categoryKey]
                      )} />
                      
                      <CardHeader className="pb-3 relative">
                        <div className="flex items-start justify-between mb-4">
                          <div className={cn(
                            "p-3 rounded-xl text-white shadow-lg transition-all duration-300",
                            "group-hover:scale-110 group-hover:rotate-3",
                            product.color
                          )}>
                            <ProductIcon className="h-6 w-6" />
                          </div>
                          
                          {/* Play button indicator */}
                          <div className={cn(
                            "p-2 rounded-full bg-muted/50 text-muted-foreground",
                            "group-hover:bg-primary group-hover:text-white",
                            "transition-all duration-300 group-hover:scale-110"
                          )}>
                            <Play className="h-4 w-4" />
                          </div>
                        </div>
                        
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {product.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {product.tagline}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {product.deliverables.length} entregáveis
                          </span>
                          <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver slides
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {/* Back to Home */}
        <div className="text-center mt-16 pb-8">
          <Button variant="outline" size="lg" className="gap-2" asChild>
            <Link to="/">
              <ArrowRight className="h-4 w-4 rotate-180" />
              Voltar para o site
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingPage;
