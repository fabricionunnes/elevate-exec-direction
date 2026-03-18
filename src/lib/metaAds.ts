export const META_ADS_PREFERRED_CALLBACK_ORIGIN = "https://elevate-exec-direction.lovable.app";

export function isLovablePreviewHost(hostname = window.location.hostname) {
  return hostname.endsWith(".lovableproject.com") ||
    (hostname.endsWith(".lovable.app") && hostname.includes("--"));
}

export function getMetaAdsRedirectUri() {
  const callbackOrigin = isLovablePreviewHost()
    ? META_ADS_PREFERRED_CALLBACK_ORIGIN
    : window.location.origin;

  return `${callbackOrigin}/meta-ads-callback`;
}
