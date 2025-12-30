import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap, Users } from "lucide-react";
import { productDetails } from "@/data/productDetails";
import { productCategories } from "@/data/onboardingContent";

const OnboardingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Onboarding de Serviços</h1>
              <p className="text-muted-foreground">
                Material de apresentação para CS
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Info Banner */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            <Users className="h-10 w-10 text-primary shrink-0" />
            <div>
              <p className="font-medium">Para uso interno do time de Customer Success</p>
              <p className="text-sm text-muted-foreground">
                Use estes slides para apresentar os entregáveis de cada serviço durante o onboarding do cliente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Products by Category */}
        {Object.entries(productCategories).map(([categoryKey, category]) => (
          <section key={categoryKey} className="mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Badge variant="outline" className="text-sm font-normal">
                {category.name}
              </Badge>
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {category.products.map((productId) => {
                const product = productDetails[productId];
                if (!product) return null;
                const ProductIcon = product.icon;
                
                return (
                  <Card
                    key={productId}
                    className="group hover:shadow-lg transition-all duration-300 hover:border-primary/40"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={`p-2.5 rounded-lg ${product.color} text-white`}>
                          <ProductIcon className="h-5 w-5" />
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {product.priceType === "único" ? "Único" : product.priceType}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-3">{product.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {product.tagline}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-primary">
                          {product.price}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 group-hover:gap-2 transition-all"
                          asChild
                        >
                          <Link to={`/onboarding/${productId}`}>
                            Ver slides
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        {/* Back to Home */}
        <div className="text-center mt-12">
          <Button variant="outline" asChild>
            <Link to="/">Voltar para o site</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingPage;
