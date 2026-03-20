import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Video, ExternalLink, Calendar, Clock, AlertCircle } from "lucide-react";

interface ReunionPanelProps {
  leadId: string;
  nextMeetingLink: string;
  nextMeetingDateTime: string;
  onNoShowToggle: () => void;
}

export function ReunionPanel({
  leadId,
  nextMeetingLink,
  nextMeetingDateTime,
  onNoShowToggle,
}: ReunionPanelProps) {
  const [markedNoShow, setMarkedNoShow] = useState(false);

  const hasMeeting = !!nextMeetingDateTime;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* No-show toggle at top */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <span className="text-sm font-medium">Marcar no-show</span>
          <Switch
            checked={markedNoShow}
            onCheckedChange={(checked) => {
              setMarkedNoShow(checked);
              if (checked) {
                onNoShowToggle();
              }
            }}
          />
        </div>

        <div className="flex items-center gap-2 text-sm font-medium">
          <Video className="h-4 w-4 text-blue-600" />
          Reunião
        </div>

        {hasMeeting ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data e horário agendado</p>
                  <p className="text-sm font-semibold">{nextMeetingDateTime}</p>
                </div>
              </div>
            </div>

            {nextMeetingLink ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Link da reunião</Label>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <a
                    href={nextMeetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                  >
                    <Video className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium truncate">{nextMeetingLink}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 ml-auto" />
                  </a>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => window.open(nextMeetingLink, '_blank')}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Entrar na reunião
                </Button>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-sm">Nenhum link de reunião disponível.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-l-amber-400">
            <p className="text-sm text-muted-foreground">
              Nenhum agendamento encontrado para esse lead.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
