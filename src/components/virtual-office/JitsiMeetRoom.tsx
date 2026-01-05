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

  useEffect(() => {
    // Load Jitsi Meet External API script
    const script = document.createElement("script");
    script.src = "https://8x8.vc/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/external_api.js";
    script.async = true;
    script.onload = initJitsi;
    document.body.appendChild(script);

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      document.body.removeChild(script);
    };
  }, []);

  const initJitsi = () => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

    // Create a sanitized room name (alphanumeric only)
    const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const fullRoomName = `unv-office-${sanitizedRoomName}`;

    const options = {
      roomName: `vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${fullRoomName}`,
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
        hiddenPremeetingButtons: ["invite"],
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
        TOOLBAR_BUTTONS: [
          "camera",
          "chat",
          "desktop",
          "filmstrip",
          "fullscreen",
          "hangup",
          "microphone",
          "participants-pane",
          "raisehand",
          "settings",
          "tileview",
        ],
        SETTINGS_SECTIONS: ["devices", "language"],
        VIDEO_LAYOUT_FIT: "both",
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
      },
    };

    apiRef.current = new window.JitsiMeetExternalAPI("8x8.vc", options);

    apiRef.current.addListener("videoConferenceJoined", () => {
      setIsLoading(false);
      console.log("Joined video conference");
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

  return (
    <div className="relative w-full h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Conectando à sala de vídeo...</p>
          </div>
        </div>
      )}
      
      <div ref={containerRef} className="flex-1 bg-black rounded-lg overflow-hidden" />
      
      {/* Custom Controls Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur rounded-full px-4 py-2 shadow-lg">
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
