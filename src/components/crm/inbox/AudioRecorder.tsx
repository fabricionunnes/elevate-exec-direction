import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onSend: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function AudioRecorder({ onSend, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Use audio/ogg with opus codec (supported by Supabase Storage and WhatsApp)
      // Fallback to mp4 for Safari/iOS
      let mimeType = "audio/ogg; codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/webm"; // Last resort fallback
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        setAudioBlob(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
  }, [stopRecording]);

  const sendAudio = useCallback(async () => {
    if (!audioBlob) return;
    
    setIsSending(true);
    try {
      // Determine extension based on mime type
      let extension = "ogg";
      if (audioBlob.type.includes("mp4")) {
        extension = "m4a";
      } else if (audioBlob.type.includes("webm")) {
        extension = "webm";
      }
      
      const file = new File([audioBlob], `audio_${Date.now()}.${extension}`, {
        type: audioBlob.type
      });
      
      await onSend(file);
      setAudioBlob(null);
      setRecordingTime(0);
    } catch (error) {
      console.error("Error sending audio:", error);
    } finally {
      setIsSending(false);
    }
  }, [audioBlob, onSend]);

  // Show recording UI
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-1.5 animate-pulse">
        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm font-medium text-destructive">{formatTime(recordingTime)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/20"
          onClick={stopRecording}
          title="Parar gravação"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    );
  }

  // Show preview/send UI after recording
  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
        <Mic className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{formatTime(recordingTime)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={cancelRecording}
          disabled={isSending}
          title="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:text-primary"
          onClick={sendAudio}
          disabled={isSending}
          title="Enviar áudio"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Default mic button
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 shrink-0", disabled && "opacity-50")}
      onClick={startRecording}
      disabled={disabled}
      title="Gravar áudio"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
