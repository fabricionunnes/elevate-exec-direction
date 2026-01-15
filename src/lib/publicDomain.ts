/**
 * Base URL for shareable public links.
 *
 * IMPORTANT:
 * - These links must be accessible without login.
 * - They also must be stable when copied from the admin area (which may be on a
 *   lovable.app preview domain).
 *
 * Therefore we prefer the canonical public domain in production.
 */
export const PUBLIC_DOMAIN = "https://unvholdings.com.br";

export const getPublicBaseUrl = (): string => {
  if (typeof window === "undefined") return PUBLIC_DOMAIN;

  // In local dev, keep links on localhost for easier testing.
  if (window.location.hostname === "localhost") return window.location.origin;

  return PUBLIC_DOMAIN;
};
