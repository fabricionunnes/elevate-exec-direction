import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Building2, 
  Users, 
  Package, 
  BarChart3, 
  Search, 
  Plus, 
  Eye,
  Trash2,
  Edit,
  UserCog,
  RefreshCw,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
  segment: string | null;
  size: string | null;
  created_at: string;
  invite_code: string | null;
  user_count?: number;
  plan_count?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string | null;
  created_at: string;
  portal_companies?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
  short_description: string | null;
  category: string | null;
  tags: string[] | null;
  cta_url: string | null;
  is_active: boolean;
}

interface Stats {
  totalCompanies: number;
  totalUsers: number;
  totalPlans: number;
  publishedPlans: number;
  offTrackKRs: number;
  activeRecommendations: number;
}

const PortalAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [activeTab, setActiveTab] = useState("overview");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    short_description: "",
    category: "",
    tags: "",
    cta_url: "",
    is_active: true
  });

  useEffect(() => {
    // Check if user is admin_unv
    if (user?.role !== "admin_unv") {
      toast.error("Acesso não autorizado");
      navigate("/portal/app");
      return;
    }
    
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Fetch companies with counts
      const { data: companiesData } = await supabase
        .from("portal_companies")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch users
      const { data: usersData } = await supabase
        .from("portal_users")
        .select("*, portal_companies(name)")
        .order("created_at", { ascending: false });

      // Fetch products
      const { data: productsData } = await supabase
        .from("portal_product_catalog")
        .select("*")
        .order("name");

      // Fetch stats
      const { count: plansCount } = await supabase
        .from("portal_plans")
        .select("*", { count: "exact", head: true });

      const { count: publishedCount } = await supabase
        .from("portal_plans")
        .select("*", { count: "exact", head: true })
        .eq("status", "published");

      const { count: offTrackCount } = await supabase
        .from("portal_key_results")
        .select("*", { count: "exact", head: true })
        .eq("status", "off_track");

      const { count: recsCount } = await supabase
        .from("portal_recommendations")
        .select("*", { count: "exact", head: true })
        .is("dismissed_at", null);

      setCompanies(companiesData || []);
      setUsers(usersData as User[] || []);
      setProducts(productsData || []);
      setStats({
        totalCompanies: companiesData?.length || 0,
        totalUsers: usersData?.length || 0,
        totalPlans: plansCount || 0,
        publishedPlans: publishedCount || 0,
        offTrackKRs: offTrackCount || 0,
        activeRecommendations: recsCount || 0
      });
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (companyId: string, companyName: string) => {
    // Store impersonation in session storage
    sessionStorage.setItem("impersonating_company", JSON.stringify({ id: companyId, name: companyName }));
    toast.success(`Visualizando como: ${companyName}`);
    navigate("/portal/app");
  };

  const handleSaveProduct = async () => {
    try {
      const productData = {
        name: productForm.name,
        short_description: productForm.short_description || null,
        category: productForm.category || null,
        tags: productForm.tags ? productForm.tags.split(",").map(t => t.trim()) : [],
        cta_url: productForm.cta_url || null,
        is_active: productForm.is_active
      };

      if (editingProduct) {
        await supabase
          .from("portal_product_catalog")
          .update(productData)
          .eq("id", editingProduct.id);
        toast.success("Produto atualizado");
      } else {
        await supabase
          .from("portal_product_catalog")
          .insert(productData);
        toast.success("Produto criado");
      }

      setProductDialogOpen(false);
      setEditingProduct(null);
      setProductForm({ name: "", short_description: "", category: "", tags: "", cta_url: "", is_active: true });
      fetchData();
    } catch (error) {
      toast.error("Erro ao salvar produto");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    
    try {
      await supabase
        .from("portal_product_catalog")
        .delete()
        .eq("id", productId);
      toast.success("Produto excluído");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir produto");
    }
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      short_description: product.short_description || "",
      category: product.category || "",
      tags: product.tags?.join(", ") || "",
      cta_url: product.cta_url || "",
      is_active: product.is_active
    });
    setProductDialogOpen(true);
  };

  const triggerRecommendations = async () => {
    try {
      toast.info("Gerando recomendações...");
      
      const { data, error } = await supabase.functions.invoke("portal-recommendations", {
        body: { action: "generate" }
      });

      if (error) throw error;
      
      toast.success(`${data.created || 0} novas recomendações geradas`);
      fetchData();
    } catch (error) {
      toast.error("Erro ao gerar recomendações");
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Admin UNV</h1>
          <p className="text-slate-400">Gestão centralizada do Portal</p>
        </div>
        <Button onClick={triggerRecommendations} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
          <RefreshCw className="w-4 h-4 mr-2" />
          Gerar Recomendações
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50 border-slate-700">
          <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <BarChart3 className="w-4 h-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="companies" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Building2 className="w-4 h-4 mr-2" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Users className="w-4 h-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="catalog" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Package className="w-4 h-4 mr-2" />
            Catálogo
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Empresas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{stats?.totalCompanies}</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{stats?.totalUsers}</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Planos Criados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{stats?.totalPlans}</p>
                <p className="text-sm text-slate-500">{stats?.publishedPlans} publicados</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  KRs Off Track
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-400">{stats?.offTrackKRs}</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Recomendações Ativas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-400">{stats?.activeRecommendations}</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Produtos no Catálogo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{products.filter(p => p.is_active).length}</p>
                <p className="text-sm text-slate-500">{products.length} total</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar empresas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700 text-white"
              />
            </div>
          </div>

          <Card className="bg-slate-900/50 border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Empresa</TableHead>
                  <TableHead className="text-slate-400">Segmento</TableHead>
                  <TableHead className="text-slate-400">Código Convite</TableHead>
                  <TableHead className="text-slate-400">Criado em</TableHead>
                  <TableHead className="text-slate-400">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="border-slate-800">
                    <TableCell className="text-white font-medium">{company.name}</TableCell>
                    <TableCell className="text-slate-400">{company.segment || "-"}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-800 px-2 py-1 rounded text-amber-400">
                        {company.invite_code}
                      </code>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(company.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleImpersonate(company.id, company.name)}
                          className="text-slate-400 hover:text-amber-400"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700 text-white"
              />
            </div>
          </div>

          <Card className="bg-slate-900/50 border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Nome</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400">Empresa</TableHead>
                  <TableHead className="text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-400">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className="border-slate-800">
                    <TableCell className="text-white font-medium">{u.name}</TableCell>
                    <TableCell className="text-slate-400">{u.email}</TableCell>
                    <TableCell className="text-slate-400">{u.portal_companies?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          u.role === "admin_unv" 
                            ? "border-amber-500 text-amber-400" 
                            : u.role === "admin_company"
                              ? "border-blue-500 text-blue-400"
                              : "border-slate-600 text-slate-400"
                        }
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-400">Gerencie os produtos UNV disponíveis para recomendação</p>
            <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950"
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({ name: "", short_description: "", category: "", tags: "", cta_url: "", is_active: true });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {editingProduct ? "Editar Produto" : "Novo Produto"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Preencha os dados do produto UNV
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Nome</Label>
                    <Input
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="UNV Sales Acceleration"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Descrição Curta</Label>
                    <Textarea
                      value={productForm.short_description}
                      onChange={(e) => setProductForm({ ...productForm, short_description: e.target.value })}
                      placeholder="Acelere suas vendas com metodologia comprovada"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Categoria</Label>
                      <Select
                        value={productForm.category}
                        onValueChange={(v) => setProductForm({ ...productForm, category: v })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="vendas">Vendas</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="gestao">Gestão</SelectItem>
                          <SelectItem value="estrategia">Estratégia</SelectItem>
                          <SelectItem value="tecnologia">Tecnologia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">URL CTA</Label>
                      <Input
                        value={productForm.cta_url}
                        onChange={(e) => setProductForm({ ...productForm, cta_url: e.target.value })}
                        placeholder="/sales-acceleration"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Tags (separadas por vírgula)</Label>
                    <Input
                      value={productForm.tags}
                      onChange={(e) => setProductForm({ ...productForm, tags: e.target.value })}
                      placeholder="vendas, processo, time comercial"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Produto Ativo</Label>
                    <Switch
                      checked={productForm.is_active}
                      onCheckedChange={(v) => setProductForm({ ...productForm, is_active: v })}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setProductDialogOpen(false)} className="border-slate-700 text-slate-300">
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveProduct} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <Card key={product.id} className={`bg-slate-900/50 border-slate-800 ${!product.is_active && "opacity-50"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">{product.name}</CardTitle>
                      <CardDescription className="text-slate-400">{product.category}</CardDescription>
                    </div>
                    <Badge variant={product.is_active ? "default" : "secondary"} className={product.is_active ? "bg-green-500/20 text-green-400" : ""}>
                      {product.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-400 line-clamp-2">{product.short_description}</p>
                  
                  {product.tags && product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-slate-700 text-slate-400">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditProduct(product)}
                      className="text-slate-400 hover:text-amber-400"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortalAdminPage;
