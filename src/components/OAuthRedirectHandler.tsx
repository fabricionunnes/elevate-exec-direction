import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Component that checks for OAuth callback parameters in the URL
 * and redirects to the appropriate callback handler.
 * 
 * This is needed because OAuth providers redirect to the origin URL
 * with query params, but our app uses HashRouter.
 */
export function OAuthRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get the full URL to check for OAuth params
    const fullUrl = window.location.href;
    
    // Check if there are query params before the hash (OAuth callback pattern)
    const queryStart = fullUrl.indexOf("?");
    const hashStart = fullUrl.indexOf("#");
    
    // OAuth callback: params are before the hash or there's no hash
    if (queryStart !== -1 && (hashStart === -1 || queryStart < hashStart)) {
      let queryString: string;
      
      if (hashStart !== -1 && hashStart > queryStart) {
        queryString = fullUrl.substring(queryStart, hashStart);
      } else {
        queryString = fullUrl.substring(queryStart);
      }
      
      const params = new URLSearchParams(queryString);
      const code = params.get("code");
      const state = params.get("state");
      
      // If we have OAuth code and state, redirect to Instagram callback
      if (code && state) {
        try {
          // Try to decode state to check the provider
          const decodedState = JSON.parse(atob(state));
          
          // Check if it's a Social module OAuth callback (UNV Social)
          if (decodedState.flow === "social") {
            const callbackUrl = `/social/instagram-callback${queryString}`;
            window.history.replaceState({}, document.title, window.location.origin + "/#" + callbackUrl);
            navigate(callbackUrl, { replace: true });
            return;
          }
          
          // Check if it's a CRM Instagram/Facebook OAuth callback
          if (decodedState.redirectUri || decodedState.staffId) {
            const callbackUrl = `/auth/instagram/callback${queryString}`;
            window.history.replaceState({}, document.title, window.location.origin + "/#" + callbackUrl);
            navigate(callbackUrl, { replace: true });
            return;
          }
        } catch {
          // If we can't decode state, ignore
        }
      }
      
      // Check for error callback
      const error = params.get("error");
      if (error) {
        // Navigate to callback page to show error
        const callbackUrl = `/auth/instagram/callback${queryString}`;
        window.history.replaceState({}, document.title, window.location.origin + "/#" + callbackUrl);
        navigate(callbackUrl, { replace: true });
      }
    }
  }, [navigate, location]);

  return null;
}
