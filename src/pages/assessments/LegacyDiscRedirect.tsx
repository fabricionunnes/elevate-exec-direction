import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

/**
 * Legacy route kept for backwards compatibility.
 * We now use the unified public assessment flow at /avaliacao.
 */
export default function LegacyDiscRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const cycleId = searchParams.get("cycle");
    // If cycle is missing, just go home.
    if (!cycleId) {
      navigate("/", { replace: true });
      return;
    }

    navigate(`/avaliacao?cycle=${encodeURIComponent(cycleId)}`, { replace: true });
  }, [navigate, searchParams]);

  return null;
}
