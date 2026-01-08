/**
 * Public domain for shareable links.
 * 
 * Links generated for public access (NPS, CSAT, Assessments, KPI Entry, etc.)
 * should use this domain instead of window.location.origin to ensure
 * they work without requiring platform authentication.
 */
export const PUBLIC_DOMAIN = "https://unvholdings.com.br";

/**
 * Get the base URL for public links.
 * Uses the configured public domain for production,
 * falls back to window.location.origin for local development.
 */
export const getPublicBaseUrl = (): string => {
  // In development (localhost), use the current origin for testing
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return window.location.origin;
  }
  return PUBLIC_DOMAIN;
};
