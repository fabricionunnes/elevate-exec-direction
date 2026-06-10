// UNV Office — escritório virtual multiplayer (3D) dos usuários do Nexus.
// Substituiu o ClientUNVOffice (salas isométricas) pelo escritório 3D estilo
// jogo, com presença em tempo real, chat de texto e chamada de áudio/vídeo.
import { lazy, Suspense } from "react";

const TeamOfficePage = lazy(() => import("../office-team/TeamOfficePage"));

const UNVOfficePage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      }
    >
      <TeamOfficePage />
    </Suspense>
  );
};

export default UNVOfficePage;
