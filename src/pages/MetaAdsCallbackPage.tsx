import { useEffect } from "react";

const MetaAdsCallbackPage = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    if (code && window.opener) {
      window.opener.postMessage({ type: "meta-ads-callback", code }, "*");
      setTimeout(() => window.close(), 1500);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">Conectando Meta Ads...</p>
        <p className="text-xs text-muted-foreground">Esta janela será fechada automaticamente.</p>
      </div>
    </div>
  );
};

export default MetaAdsCallbackPage;
