import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const fullRoomName = `unvoffice${sanitizedRoomName}`;

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
          enableLobbyChat: false,
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
        console.log("Successfully joined video conference");
      });

      apiRef.current.addListener("videoConferenceLeft", () => {
        console.log("Left video conference");
        onLeave();
      });

      apiRef.current.addListener("audioMuteStatusChanged", (event: any) => {
        setIsAudioMuted(event.muted);
      });

      apiRef.current.addListener("videoMuteStatusChanged", (event: any) => {
        setIsVideoMuted(event.muted);
      });

      apiRef.current.addListener("readyToClose", () => {
        onLeave();
      });

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

  const toggleAudio = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand("toggleAudio");
    }
  };

  const toggleVideo = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand("toggleVideo");
    }
  };

  const hangup = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand("hangup");
    }
    onLeave();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
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
      
      {/* Custom Controls Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur rounded-full px-4 py-2 shadow-lg z-20">
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-full", isAudioMuted && "bg-destructive/20 text-destructive")}
          onClick={toggleAudio}
        >
          {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-full", isVideoMuted && "bg-destructive/20 text-destructive")}
          onClick={toggleVideo}
        >
          {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full"
          onClick={hangup}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default JitsiMeetRoom;
