import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useThemeCustomization, ThemeColors } from "@/contexts/ThemeCustomizationContext";
import { TenantBlockedScreen } from "@/components/whitelabel/TenantBlockedScreen";

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

// Status that grant normal access
const ACTIVE_STATUSES = ["active", "trial"];
// Status that resolve the tenant but BLOCK access (show gate screen)
const BLOCKED_STATUSES = ["pending_payment", "suspended", "inactive"];
const RESOLVABLE_STATUSES = [...ACTIVE_STATUSES, ...BLOCKED_STATUSES];

/**
 * Resolve the current tenant based on hostname OR on the logged-in staff user.
 * Returns the tenant even when blocked, so the UI can show a gate screen
 * instead of silently falling back to the master view.
 */
async function resolveTenant(): Promise<TenantData | null> {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname.toLowerCase();
  const unvDomains = ["localhost", "lovable.app", "unvholdings.com.br", "www.unvholdings.com.br"];
  const isUnvDomain = unvDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));

  if (!isUnvDomain) {
    const { data: byDomain } = await supabase
      .from("whitelabel_tenants")
      .select("*")
      .eq("custom_domain", hostname)
      .in("status", RESOLVABLE_STATUSES)
      .maybeSingle();

    if (byDomain) return mapTenant(byDomain);

    const slugMatch = hostname.match(/^([a-z0-9-]+)\./);
    if (slugMatch) {
      const { data: bySlug } = await supabase
        .from("whitelabel_tenants")
        .select("*")
        .eq("slug", slugMatch[1])
        .in("status", RESOLVABLE_STATUSES)
        .maybeSingle();

      if (bySlug) return mapTenant(bySlug);
    }
  }

  // Fallback: logged-in white-label staff accessing via main URL
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
          .in("status", RESOLVABLE_STATUSES)
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

function isTenantBlocked(t: TenantData): boolean {
  if (BLOCKED_STATUSES.includes(t.status)) return true;
  // Active but with payment pending and not exempt
  if (
    t.status === "active" &&
    t.payment_status &&
    !["paid", "not_required"].includes(t.payment_status)
  ) {
    return true;
  }
  return false;
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
        if (resolved.theme_colors) {
          applyTheme(resolved.theme_colors, resolved.is_dark_mode);
        }
        if (resolved.favicon_url) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) link.href = resolved.favicon_url;
        }
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

  const isModuleEnabled = (moduleKey: string): boolean => {
    if (!tenant) return true;
    return Boolean(tenant.enabled_modules?.[moduleKey]);
  };

  // Gate: block access for suspended/inactive/payment-pending tenants
  if (tenant && isTenantBlocked(tenant)) {
    return (
      <TenantBlockedScreen
        tenantName={tenant.name}
        status={tenant.status}
        paymentStatus={tenant.payment_status}
        paymentLink={tenant.first_payment_link}
      />
    );
  }

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
