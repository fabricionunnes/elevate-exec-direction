import { useState, useEffect } from "react";
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

export const CreateProjectDialog = ({
  open,
  onOpenChange,
  onProjectCreated,
  preselectedCompanyId,
  onSuccess,
}: CreateProjectDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [createNewCompany, setCreateNewCompany] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCompanies();
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

      const productName = productDetails[selectedProduct]?.name || selectedProduct;

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

      // Fetch master template tasks (applies to ALL products)
      const { data: masterTemplates } = await supabase
        .from("onboarding_task_templates")
        .select("*")
        .eq("product_id", "master")
        .order("phase_order")
        .order("sort_order");

      // Fetch product-specific task templates
      const { data: productTemplates } = await supabase
        .from("onboarding_task_templates")
        .select("*")
        .eq("product_id", selectedProduct)
        .order("phase_order")
        .order("sort_order");

      // Combine master + product templates
      const allTemplates = [
        ...(masterTemplates || []),
        ...(productTemplates || []),
      ];

      // Create tasks from templates with phase info and recurrence
      if (allTemplates.length > 0) {
        const today = new Date();
        
        // Re-calculate sort_order to maintain proper ordering
        // Master tasks come first, then product-specific tasks
        const tasks = allTemplates.map((template, index) => ({
          project_id: project.id,
          title: template.title,
          description: template.description,
          priority: template.priority,
          due_date: template.default_days_offset != null 
            ? new Date(today.getTime() + template.default_days_offset * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
            : null,
          sort_order: index,
          status: "pending" as const,
          // Store phase info in tags array: [phase_name, phase_order]
          tags: template.phase ? [template.phase, String(template.phase_order ?? 0)] : null,
          recurrence: template.recurrence,
          template_id: template.id,
        }));

        await supabase.from("onboarding_tasks").insert(tasks);
      }

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

  const availableProducts = Object.entries(productDetails).map(([id, product]) => ({
    id,
    name: product.name,
  }));

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
                {availableProducts.map((product) => (
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
};
