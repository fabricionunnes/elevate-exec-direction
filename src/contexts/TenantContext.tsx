import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useThemeCustomization, ThemeColors } from "@/contexts/ThemeCustomizationContext";

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  platform_name: string;
  theme_colors: ThemeColors | null;
  is_dark_mode: boolean;
  status: string;
  max_active_projects: number;
  enabled_modules: Record<string, boolean>;
  payment_status?: string;
  first_payment_link?: string | null;
  first_payment_due_at?: string | null;
}

interface TenantContextType {
  tenant: TenantData | null;
  isLoading: boolean;
  isWhiteLabel: boolean;
  platformName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  refetchTenant: () => Promise<void>;
  isModuleEnabled: (moduleKey: string) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const DEFAULT_PLATFORM_NAME = "UNV Nexus";

/**
 * Resolve the current tenant based on hostname OR on the logged-in staff user.
 * The hostname check matches custom_domain or slug-based subdomains. When the
 * hostname is a UNV domain (or no match is found), we fall back to the staff
 * user's tenant_id so a white-label admin logging in via the main URL still
 * gets isolated branding/data.
 */
async function resolveTenant(): Promise<TenantData | null> {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname.toLowerCase();

  // Skip hostname-based tenant resolution for known UNV domains and localhost
  const unvDomains = ["localhost", "lovable.app", "unvholdings.com.br", "www.unvholdings.com.br"];
  const isUnvDomain = unvDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));

    const ALLOWED = ["active", "trial", "pending_payment"];
    if (!isUnvDomain) {
      const { data: byDomain } = await supabase
        .from("whitelabel_tenants")
        .select("*")
        .eq("custom_domain", hostname)
        .in("status", ALLOWED)
        .maybeSingle();

      if (byDomain) return mapTenant(byDomain);

      const slugMatch = hostname.match(/^([a-z0-9-]+)\./);
      if (slugMatch) {
        const { data: bySlug } = await supabase
          .from("whitelabel_tenants")
          .select("*")
          .eq("slug", slugMatch[1])
          .in("status", ALLOWED)
          .maybeSingle();

        if (bySlug) return mapTenant(bySlug);
      }
    }

  // Fallback: resolve from the logged-in staff user (admin de tenant white-label
  // acessando pela URL principal). Master da plataforma tem tenant_id IS NULL → ignorado.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (staff?.tenant_id) {
        const { data: byStaff } = await supabase
          .from("whitelabel_tenants")
          .select("*")
          .eq("id", staff.tenant_id)
          .in("status", ["active", "trial", "pending_payment"])
          .maybeSingle();
        if (byStaff) return mapTenant(byStaff);
      }
    }
  } catch (e) {
    console.warn("[TenantContext] staff fallback failed:", (e as Error).message);
  }

  return null;
}

function mapTenant(row: any): TenantData {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    custom_domain: row.custom_domain,
    logo_url: row.logo_url,
    favicon_url: row.favicon_url,
    platform_name: row.platform_name || DEFAULT_PLATFORM_NAME,
    theme_colors: row.theme_colors as ThemeColors | null,
    is_dark_mode: row.is_dark_mode ?? false,
    status: row.status,
    max_active_projects: row.max_active_projects ?? 5,
    enabled_modules: (row.enabled_modules as Record<string, boolean>) || {},
    payment_status: row.payment_status,
    first_payment_link: row.first_payment_link,
    first_payment_due_at: row.first_payment_due_at,
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { applyTheme } = useThemeCustomization();

  const fetchTenant = async () => {
    try {
      const resolved = await resolveTenant();
      setTenant(resolved);

      if (resolved) {
        // Apply tenant branding
        if (resolved.theme_colors) {
          applyTheme(resolved.theme_colors, resolved.is_dark_mode);
        }

        // Update favicon
        if (resolved.favicon_url) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) link.href = resolved.favicon_url;
        }

        // Update document title
        document.title = resolved.platform_name;
      }
    } catch (err) {
      console.error("Failed to resolve tenant:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();

    // React to login/logout so a white-label admin gets their tenant resolved
    // immediately after authenticating via the main URL.
    const { data: sub } = supabase.auth.onAuthStateChange((_event) => {
      fetchTenant();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const isWhiteLabel = tenant !== null;
  const platformName = tenant?.platform_name || DEFAULT_PLATFORM_NAME;
  const logoUrl = tenant?.logo_url || null;
  const faviconUrl = tenant?.favicon_url || null;

  /**
   * Verifica se um módulo está habilitado para o tenant atual.
   * - Sem tenant (master/UNV): TODOS os módulos habilitados.
   * - Com tenant: respeita o JSONB `enabled_modules` (default false p/ chave ausente).
   */
  const isModuleEnabled = (moduleKey: string): boolean => {
    if (!tenant) return true;
    return Boolean(tenant.enabled_modules?.[moduleKey]);
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        isLoading,
        isWhiteLabel,
        platformName,
        logoUrl,
        faviconUrl,
        refetchTenant: fetchTenant,
        isModuleEnabled,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
