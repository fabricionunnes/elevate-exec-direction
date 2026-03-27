export const META_ADS_PREFERRED_CALLBACK_ORIGIN = "https://elevate-exec-direction.lovable.app";

export function isLovablePreviewHost(hostname = window.location.hostname) {
  return hostname.endsWith(".lovableproject.com") ||
    (hostname.endsWith(".lovable.app") && hostname.includes("--"));
}

export function getMetaAdsRedirectUri() {
  const hostname = window.location.hostname;

  const callbackOrigin = hostname === "localhost"
    ? window.location.origin
    : META_ADS_PREFERRED_CALLBACK_ORIGIN;

  return `${callbackOrigin}/meta-ads-callback`;
}
