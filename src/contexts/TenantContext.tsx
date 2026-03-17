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
}

interface TenantContextType {
  tenant: TenantData | null;
  isLoading: boolean;
  isWhiteLabel: boolean;
  platformName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  refetchTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const DEFAULT_PLATFORM_NAME = "UNV Nexus";

/**
 * Resolve the current tenant based on hostname.
 * Matches against custom_domain or slug-based subdomains.
 */
async function resolveTenantByDomain(): Promise<TenantData | null> {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname.toLowerCase();

  // Skip tenant resolution for known UNV domains and localhost
  const unvDomains = ["localhost", "lovable.app", "unvholdings.com.br", "www.unvholdings.com.br"];
  if (unvDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
    return null;
  }

  // Try custom domain first
  const { data: byDomain } = await supabase
    .from("whitelabel_tenants")
    .select("*")
    .eq("custom_domain", hostname)
    .in("status", ["active", "trial"])
    .maybeSingle();

  if (byDomain) return mapTenant(byDomain);

  // Try slug from subdomain (e.g., tenant-slug.nexus.com.br)
  const slugMatch = hostname.match(/^([a-z0-9-]+)\./);
  if (slugMatch) {
    const { data: bySlug } = await supabase
      .from("whitelabel_tenants")
      .select("*")
      .eq("slug", slugMatch[1])
      .in("status", ["active", "trial"])
      .maybeSingle();

    if (bySlug) return mapTenant(bySlug);
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
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { applyTheme } = useThemeCustomization();

  const fetchTenant = async () => {
    try {
      const resolved = await resolveTenantByDomain();
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
  }, []);

  const isWhiteLabel = tenant !== null;
  const platformName = tenant?.platform_name || DEFAULT_PLATFORM_NAME;
  const logoUrl = tenant?.logo_url || null;
  const faviconUrl = tenant?.favicon_url || null;

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
