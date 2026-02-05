import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  Volume2,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RealtimeTranscriptionProps {
  leadId?: string;
  meetingEventId?: string;
  projectId?: string;
  leadName?: string;
  companyName?: string | null;
  onTranscriptionSaved?: () => void;
}

export function RealtimeTranscription({
  leadId,
  meetingEventId,
  projectId,
  leadName,
  companyName,
  onTranscriptionSaved,
}: RealtimeTranscriptionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [title, setTitle] = useState("");
  const [transcription, setTranscription] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);

  // Check microphone permission on mount
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        setPermissionGranted(true);
      })
      .catch(() => {
        setPermissionGranted(false);
      });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Setup audio analysis for visual feedback
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const updateLevel = () => {
        if (analyserRef.current && isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateLevel);
        }
      };

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start audio level updates
      requestAnimationFrame(updateLevel);

      toast.success("Gravação iniciada");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao iniciar gravação. Verifique as permissões do microfone.");
      setPermissionGranted(false);
    }
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<Blob>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        resolve(audioBlob);
      };

      mediaRecorderRef.current!.stop();
      mediaRecorderRef.current!.stream.getTracks().forEach((track) => track.stop());
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsRecording(false);
      setAudioLevel(0);
    });
  }, []);

  const handleStopAndTranscribe = useCallback(async () => {
    const audioBlob = await stopRecording();
    
    if (!audioBlob || audioBlob.size === 0) {
      toast.error("Nenhum áudio gravado");
      return;
    }

    setIsProcessing(true);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      // Call transcription API
      const { data, error } = await supabase.functions.invoke("transcribe-assemblyai", {
        body: {
          audio_base64: audioBase64,
          language_code: "pt",
        },
      });

      if (error) throw error;

      if (data?.text) {
        setTranscription(data.text);
        toast.success("Transcrição concluída!");
      } else {
        throw new Error("Transcrição não retornada");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Erro ao transcrever. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  }, [stopRecording]);

  const handleSaveTranscription = useCallback(async () => {
    if (!transcription.trim()) {
      toast.error("Transcrição vazia");
      return;
    }

    if (!title.trim()) {
      toast.error("Adicione um título para a transcrição");
      return;
    }

    setIsSaving(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      const { data: newTranscription, error } = await supabase.from("crm_transcriptions").insert({
        lead_id: leadId || null,
        meeting_event_id: meetingEventId || null,
        project_id: projectId || null,
        title: title.trim(),
        transcription_text: transcription.trim(),
        source: "elevenlabs",
        duration_seconds: recordingTime,
        language: "pt-BR",
        status: "completed",
        recorded_at: new Date().toISOString(),
        created_by: session?.session?.user?.id,
      }).select().single();

      if (error) throw error;

      toast.success("Transcrição salva!");

      // Auto-generate briefing
      if (newTranscription) {
        setIsGeneratingBriefing(true);
        toast.info("Gerando briefing automaticamente...");

        try {
          const { data: briefingData, error: briefingError } = await supabase.functions.invoke(
            "generate-crm-briefing",
            {
              body: {
                transcription: transcription.trim(),
                leadName: leadName || title.trim(),
                companyName: companyName || null,
              },
            }
          );

          if (!briefingError && briefingData?.briefing) {
            await supabase
              .from("crm_transcriptions")
              .update({ ai_analysis: briefingData.briefing })
              .eq("id", newTranscription.id);
            
            toast.success("Briefing gerado e salvo automaticamente!");
          }
        } catch (briefingErr) {
          console.error("Error generating auto-briefing:", briefingErr);
          toast.warning("Briefing não foi gerado, mas a transcrição foi salva.");
        } finally {
          setIsGeneratingBriefing(false);
        }
      }

      setTitle("");
      setTranscription("");
      setRecordingTime(0);
      onTranscriptionSaved?.();
    } catch (error) {
      console.error("Error saving transcription:", error);
      toast.error("Erro ao salvar transcrição");
    } finally {
      setIsSaving(false);
    }
  }, [transcription, title, leadId, meetingEventId, projectId, recordingTime, leadName, companyName, onTranscriptionSaved]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (permissionGranted === false) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-medium">Permissão de microfone negada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Para usar a transcrição em tempo real, você precisa permitir o acesso ao microfone.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                navigator.mediaDevices
                  .getUserMedia({ audio: true })
                  .then((stream) => {
                    stream.getTracks().forEach((track) => track.stop());
                    setPermissionGranted(true);
                  })
                  .catch(() => {
                    toast.error("Permissão negada. Verifique as configurações do navegador.");
                  });
              }}
            >
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Transcrição em Tempo Real
        </CardTitle>
        <CardDescription>
          Grave reuniões diretamente e obtenha transcrições automáticas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title Input */}
        <div className="space-y-2">
          <Label htmlFor="transcription-title">Título da gravação</Label>
          <Input
            id="transcription-title"
            placeholder="Ex: Reunião de Alinhamento - Cliente XYZ"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isRecording || isProcessing}
          />
        </div>

        {/* Recording Controls */}
        <div className="flex items-center gap-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={isProcessing}
              size="lg"
              className="gap-2"
            >
              <Mic className="h-5 w-5" />
              Iniciar Gravação
            </Button>
          ) : (
            <Button
              onClick={handleStopAndTranscribe}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <Square className="h-5 w-5" />
              Parar e Transcrever
            </Button>
          )}

          {isRecording && (
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="animate-pulse">
                {formatTime(recordingTime)}
              </Badge>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                <Progress value={audioLevel * 100} className="w-20 h-2" />
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Transcrevendo...</span>
            </div>
          )}
        </div>

        {/* Transcription Result */}
        {transcription && (
          <div className="space-y-2">
            <Label>Transcrição</Label>
            <Textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="A transcrição aparecerá aqui..."
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {transcription.split(/\s+/).filter(Boolean).length} palavras
              </span>
              <Button
                onClick={handleSaveTranscription}
                disabled={isSaving || isGeneratingBriefing || !title.trim()}
              >
                {isGeneratingBriefing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando Briefing...
                  </>
                ) : isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Salvar e Gerar Briefing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
