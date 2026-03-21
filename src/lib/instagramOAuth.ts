import { isLovablePreviewHost } from "@/lib/metaAds";

export const INSTAGRAM_OAUTH_PREFERRED_CALLBACK_ORIGIN = "https://elevate-exec-direction.lovable.app";

export function getInstagramOAuthRedirectUri() {
  const callbackOrigin = isLovablePreviewHost()
    ? INSTAGRAM_OAUTH_PREFERRED_CALLBACK_ORIGIN
    : window.location.origin;

  return `${callbackOrigin}/`;
}
