import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { ProjectCustomDashboard } from "@/components/onboarding-tasks/ProjectCustomDashboard";

/** Link público, só de leitura, do painel próprio de um projeto: /#/painel/<token>. */
export default function PublicProjectDashboardPage() {
  const { token } = useParams<{ token: string }>();
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const anterior = document.title;
    document.title = "Painel de controle";
    return () => { document.head.removeChild(meta); document.title = anterior; };
  }, []);
  return (
    <div className="min-h-screen bg-[#0E0E0E]">
      <ProjectCustomDashboard publicToken={token} fullScreen />
    </div>
  );
}
