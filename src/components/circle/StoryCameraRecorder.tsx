import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Camera, Square, RotateCcw, Check, SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoryCameraRecorderProps {
  onVideoRecorded: (file: File, previewUrl: string) => void;
  onCancel: () => void;
}

export function StoryCameraRecorder({ onVideoRecorded, onCancel }: StoryCameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const MAX_DURATION = 30; // Maximum 30 seconds

  // Initialize camera
  const initCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Stop previous stream if exists
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          // Force portrait capture as much as the device supports
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: 9 / 16,
        },
        audio: true,
      });

      // Some devices ignore getUserMedia aspectRatio/width/height.
      // Try to enforce constraints on the video track.
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack?.applyConstraints) {
        try {
          await videoTrack.applyConstraints({
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            aspectRatio: 9 / 16,
            frameRate: { ideal: 30 },
          });
        } catch (e) {
          // Non-fatal: fallback to whatever the device provides
          console.warn("applyConstraints failed:", e);
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    } finally {
      setIsLoading(false);
    }
  }, [facingMode]);

  useEffect(() => {
    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (!stream) return;

    chunksRef.current = [];
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    try {
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Erro ao iniciar gravação.");
    }
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  const resetRecording = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    initCamera();
  };

  const confirmRecording = () => {
    if (recordedBlob && previewUrl) {
      const file = new File([recordedBlob], `story-${Date.now()}.webm`, { type: 'video/webm' });
      onVideoRecorded(file, previewUrl);
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show preview after recording
  if (previewUrl) {
    return (
      <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden relative">
        <video
          src={previewUrl}
          className="w-full h-full object-cover object-center"
          controls
          autoPlay
          loop
          playsInline
        />
        
        {/* Action buttons */}
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full bg-white/20 border-white/30 text-white hover:bg-white/30"
            onClick={resetRecording}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full bg-primary"
            onClick={confirmRecording}
          >
            <Check className="h-6 w-6" />
          </Button>
        </div>

        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden relative">
      {/* Camera preview */}
      {!error ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover",
            facingMode === "user" && "scale-x-[-1]" // Mirror front camera
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white text-center p-4">
          <div className="space-y-4">
            <Camera className="h-12 w-12 mx-auto opacity-50" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" onClick={initCamera}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-white text-center">
            <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">Iniciando câmera...</p>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-4 left-0 right-0 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span>{formatTime(recordingTime)} / {formatTime(MAX_DURATION)}</span>
          </div>
        </div>
      )}

      {/* Progress bar for recording */}
      {isRecording && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/30">
          <div 
            className="h-full bg-red-500 transition-all duration-1000"
            style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
          />
        </div>
      )}

      {/* Controls */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
          {/* Switch camera */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30"
            onClick={switchCamera}
            disabled={isRecording}
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>

          {/* Record button */}
          <button
            className={cn(
              "h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-all",
              isRecording ? "bg-red-600" : "bg-transparent hover:bg-white/20"
            )}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <Square className="h-6 w-6 text-white fill-white" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-red-500" />
            )}
          </button>

          {/* Close/Cancel */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30"
            onClick={onCancel}
            disabled={isRecording}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Close button (top) */}
      <button
        onClick={onCancel}
        className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white"
        disabled={isRecording}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
