import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneOff } from "lucide-react";

interface JitsiMeetRoomProps {
  roomName: string;
  displayName: string;
  onLeave: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JitsiMeetRoom = ({ roomName, displayName, onLeave }: JitsiMeetRoomProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    // Load Jitsi Meet External API script from public Jitsi server
    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = initJitsi;
    script.onerror = () => {
      setError("Erro ao carregar a API de videoconferência");
      setIsLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      // Only remove if script still exists
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const initJitsi = () => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) {
      setError("Erro ao inicializar videoconferência");
      setIsLoading(false);
      return;
    }

    try {
      // Create a sanitized room name (alphanumeric only)
      const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

      // NOTE: meet.jit.si may keep per-room moderation/lobby state.
      // Bumping the room namespace avoids getting stuck waiting for a moderator in older rooms.
      const fullRoomName = `unvofficev2${sanitizedRoomName}`;

      const options = {
        roomName: fullRoomName,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: {
          displayName: displayName,
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          enableClosePage: false,
          disableInviteFunctions: true,
          enableWelcomePage: false,

          // Try to prevent "waiting for moderator" behavior (lobby)
          lobby: { enabled: false },
          enableLobbyChat: false,
          disableModeratorIndicator: true,

          hideConferenceSubject: true,
          hideConferenceTimer: false,
          disableThirdPartyRequests: true,
          enableNoisyMicDetection: false,
          enableNoAudioDetection: false,
          toolbarButtons: [
            "camera",
            "chat",
            "desktop",
            "filmstrip",
            "fullscreen",
            "hangup",
            "microphone",
            "participants-pane",
            "raisehand",
            "select-background",
            "settings",
            "tileview",
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          DISABLE_PRESENCE_STATUS: false,
          GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
          DISPLAY_WELCOME_FOOTER: false,
          DISPLAY_WELCOME_PAGE_ADDITIONAL_CARD: false,
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
          RECENT_LIST_ENABLED: false,
          VIDEO_LAYOUT_FIT: "both",
          filmStripOnly: false,
          VERTICAL_FILMSTRIP: true,
        },
      };

      console.log("Initializing Jitsi with room:", fullRoomName);
      apiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", options);

      apiRef.current.addListener("videoConferenceJoined", () => {
        setIsLoading(false);
        setError(null);
        hasJoinedRef.current = true;
        console.log("Successfully joined video conference");
      });

      apiRef.current.addListener("videoConferenceLeft", () => {
        console.log("Left video conference");
        // Only trigger onLeave if user had actually joined the conference
        if (hasJoinedRef.current) {
          onLeave();
        }
      });

      // Don't listen to readyToClose - it fires when clicking "I am the host" login button
      // which causes unwanted exit. User can leave via our "Sair" button or Jitsi's hangup.

      // Set loading to false after a timeout as fallback
      setTimeout(() => {
        setIsLoading(false);
      }, 5000);

    } catch (err) {
      console.error("Error initializing Jitsi:", err);
      setError("Erro ao iniciar videoconferência");
      setIsLoading(false);
    }
  };

  const hangup = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand("hangup");
    }
    onLeave();
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="text-center p-4">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={onLeave} variant="outline">
            Voltar ao Chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col min-h-[400px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Conectando à sala de vídeo...</p>
            <p className="text-xs text-muted-foreground mt-2">Permita o acesso à câmera e microfone se solicitado</p>
          </div>
        </div>
      )}
      
      <div ref={containerRef} className="flex-1 bg-black rounded-lg overflow-hidden" style={{ minHeight: "400px" }} />
      
      {/* Minimal external controls (Jitsi has its own toolbar) */}
      <div className="absolute bottom-4 right-4 z-20">
        <Button
          variant="destructive"
          size="sm"
          className="rounded-full shadow-lg"
          onClick={hangup}
        >
          <PhoneOff className="h-4 w-4 mr-1" />
          Sair
        </Button>
      </div>
    </div>
  );
};

export default JitsiMeetRoom;
