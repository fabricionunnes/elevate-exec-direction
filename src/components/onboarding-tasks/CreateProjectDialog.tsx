import { useState, useEffect, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { productDetails } from "@/data/productDetails";
import { UpgradePlanDialog } from "@/components/whitelabel/UpgradePlanDialog";

interface ServiceProduct {
  id: string;
  name: string;
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
  preselectedCompanyId?: string;
  onSuccess?: () => void;
}

interface Company {
  id: string;
  name: string;
}

export const CreateProjectDialog = forwardRef<HTMLDivElement, CreateProjectDialogProps>(({
  open,
  onOpenChange,
  onProjectCreated,
  preselectedCompanyId,
  onSuccess,
}, ref) => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [serviceProducts, setServiceProducts] = useState<ServiceProduct[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<{
    tenantId: string;
    tenantName: string;
    planSlug: string | null;
    maxProjects: number;
    activeCount: number;
  } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [createNewCompany, setCreateNewCompany] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCompanies();
      fetchServiceProducts();
      if (preselectedCompanyId) {
        setSelectedCompany(preselectedCompanyId);
        setCreateNewCompany(false);
      }
    }
  }, [open, preselectedCompanyId]);

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("onboarding_companies")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setCompanies(data);
    }
  };

  const fetchServiceProducts = async () => {
    const { data, error } = await supabase
      .from("onboarding_services")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setServiceProducts(data);
    }
  };

  const handleCreate = async () => {
    if (!selectedProduct) {
      toast.error("Selecione um produto");
      return;
    }

    if (!createNewCompany && !selectedCompany) {
      toast.error("Selecione uma empresa");
      return;
    }

    if (createNewCompany && !newCompanyName.trim()) {
      toast.error("Digite o nome da empresa");
      return;
    }

    setLoading(true);
    try {
      // Bloquear criação se tenant white-label estiver no limite de projetos ativos
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("tenant_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staff?.tenant_id) {
          const { data: tenantRow } = await supabase
            .from("whitelabel_tenants")
            .select("id, max_active_projects, name, plan_slug")
            .eq("id", staff.tenant_id)
            .maybeSingle();

          const { count: activeCount } = await supabase
            .from("onboarding_projects")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", staff.tenant_id)
            .eq("status", "active");

          const max = tenantRow?.max_active_projects ?? 0;
          if (tenantRow && (activeCount ?? 0) >= max) {
            setUpgradeInfo({
              tenantId: tenantRow.id,
              tenantName: tenantRow.name,
              planSlug: tenantRow.plan_slug,
              maxProjects: max,
              activeCount: activeCount ?? 0,
            });
            setUpgradeOpen(true);
            setLoading(false);
            return;
          }
        }
      }

      let companyId = selectedCompany;

      // Create new company if needed
      if (createNewCompany) {
        const { data: newCompany, error: companyError } = await supabase
          .from("onboarding_companies")
          .insert({ name: newCompanyName.trim() })
          .select("id")
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      // Check for duplicate project (same company + same product)
      const { data: existingProject } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("onboarding_company_id", companyId)
        .eq("product_id", selectedProduct)
        .maybeSingle();

      if (existingProject) {
        toast.info("Esta empresa já possui um projeto com este produto");
        setLoading(false);
        onOpenChange(false);
        return;
      }

      const productName = serviceProducts.find(p => p.id === selectedProduct)?.name || productDetails[selectedProduct]?.name || selectedProduct;

      // Create project linked to onboarding_company
      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .insert({
          product_id: selectedProduct,
          product_name: productName,
          onboarding_company_id: companyId,
        })
        .select("id")
        .single();

      if (projectError) throw projectError;

      // Buscar templates específicos do produto selecionado
      const { data: templates, error: templatesError } = await supabase
        .from("onboarding_task_templates")
        .select(
          "id, title, description, priority, sort_order, default_days_offset, duration_days, phase, recurrence, phase_order, is_internal"
        )
        .eq("product_id", selectedProduct)
        .order("phase_order", { ascending: true })
        .order("sort_order", { ascending: true });

      if (templatesError) {
        console.error("Erro ao buscar templates:", templatesError);
        throw new Error("Erro ao buscar templates de tarefas");
      }

      if (!templates || templates.length === 0) {
        console.log("Nenhum template encontrado para o produto:", selectedProduct, "- projeto criado sem tarefas");
        toast.success("Projeto criado com sucesso! (sem tarefas pré-definidas)");
        onOpenChange(false);
        onProjectCreated?.();
        onSuccess?.();
        setSelectedProduct("");
        setSelectedCompany("");
        setNewCompanyName("");
        setCreateNewCompany(false);
        setLoading(false);
        return;
      }

      const today = new Date();
      const tasksToInsert = templates.map((tpl, idx) => {
        let dueDate: string | null = null;
        const offset = (tpl.default_days_offset ?? 0) + (tpl.duration_days ?? 0);
        if (offset > 0) {
          const due = new Date(today);
          due.setDate(due.getDate() + offset);
          dueDate = due.toISOString().split("T")[0];
        }

        return {
          project_id: project.id,
          template_id: tpl.id,
          title: tpl.title,
          description: tpl.description,
          priority: tpl.priority || "medium",
          status: "pending" as const,
          due_date: dueDate,
          sort_order: tpl.sort_order ?? idx,
          // Importante: manter a fase do template para não "parecer" tarefa inventada no painel
          tags: tpl.phase ? [tpl.phase] : null,
          recurrence: tpl.recurrence ?? null,
          is_internal: tpl.is_internal ?? false,
        };
      });

      const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);
      if (insertError) {
        console.error("Erro ao inserir tarefas:", insertError);
        await supabase.from("onboarding_projects").delete().eq("id", project.id);
        throw new Error("Erro ao criar tarefas do template");
      }

      console.log(`${templates.length} tarefas criadas a partir dos templates`);

      toast.success("Projeto criado com sucesso!");
      onOpenChange(false);
      onProjectCreated?.();
      onSuccess?.();
      
      // Reset form
      setSelectedProduct("");
      setSelectedCompany("");
      setNewCompanyName("");
      setCreateNewCompany(false);
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast.error("Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  };

  // Merge hardcoded products with dynamic ones from DB, avoiding duplicates
  const hardcodedProducts = Object.entries(productDetails).map(([id, product]) => ({
    id,
    name: product.name,
  }));
  
  const allProducts = [...hardcodedProducts];
  for (const sp of serviceProducts) {
    if (!allProducts.some(p => p.id === sp.id || p.name === sp.name)) {
      allProducts.push(sp);
    }
  }
  allProducts.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Projeto de Onboarding</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {allProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!preselectedCompanyId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Empresa</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateNewCompany(!createNewCompany)}
                >
                  {createNewCompany ? "Selecionar existente" : "Criar nova"}
                </Button>
              </div>
              
              {createNewCompany ? (
                <Input
                  placeholder="Nome da nova empresa"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
              ) : (
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Projeto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

CreateProjectDialog.displayName = "CreateProjectDialog";
