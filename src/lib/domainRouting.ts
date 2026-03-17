/**
 * Domain-based routing configuration.
 * 
 * This project supports multiple domains:
 * - unvholdings.com.br (or similar) → Full UNV Nexus system
 * - unvcircle.com.br → UNV Circle only
 * - [tenant].nexus.com.br or custom domain → White-label tenant
 */

// Circle-specific domain (update this when you connect the domain)
export const CIRCLE_DOMAIN = "unvcircle.com.br";

// Additional Circle domains (for testing, www variants, etc.)
export const CIRCLE_DOMAINS = [
  "unvcircle.com.br",
  "www.unvcircle.com.br",
];

// Known UNV domains (not white-label)
export const UNV_DOMAINS = [
  "unvholdings.com.br",
  "www.unvholdings.com.br",
  "localhost",
];

/**
 * Check if the current domain is a Circle-only domain
 */
export const isCircleDomain = (): boolean => {
  if (typeof window === "undefined") return false;
  
  const hostname = window.location.hostname.toLowerCase();
  
  return CIRCLE_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
};

/**
 * Check if the current domain is a known UNV domain
 */
export const isUNVDomain = (): boolean => {
  if (typeof window === "undefined") return true;
  
  const hostname = window.location.hostname.toLowerCase();
  
  return UNV_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  ) || hostname.endsWith(".lovable.app");
};

/**
 * Check if current domain might be a white-label tenant
 */
export const isPossibleTenantDomain = (): boolean => {
  return !isCircleDomain() && !isUNVDomain();
};

/**
 * Get the appropriate home route based on domain
 */
export const getHomeRoute = (): string => {
  if (isCircleDomain()) {
    return "/circle";
  }
  return "/";
};

/**
 * Check if navigation should be limited to Circle-only
 */
export const isCircleOnlyMode = (): boolean => {
  return isCircleDomain();
};
