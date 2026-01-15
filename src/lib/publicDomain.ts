/**
 * Base URL for shareable public links.
 *
 * IMPORTANT: these links must point to the same domain where THIS app is hosted.
 * If you hardcode a marketing domain, the link will open the marketing site instead
 * of the public form route.
 */
export const getPublicBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Fallback for non-browser environments
  return "";
};
