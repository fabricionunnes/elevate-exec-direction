import { useState, useEffect } from "react";
import { Phone, PhoneCall, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TwilioCallButtonProps {
  leadId: string;
  leadName: string;
  leadPhone: string;
  variant?: "icon" | "button";
  onCallStarted?: () => void;
}

export function TwilioCallButton({
  leadId,
  leadName,
  leadPhone,
  variant = "icon",
  onCallStarted,
}: TwilioCallButtonProps) {
  const [open, setOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  const [staffPhone, setStaffPhone] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "connected" | "ended">("idle");

  // Load staff phone from profile
  useEffect(() => {
    const loadStaffPhone = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("phone")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (staff?.phone) {
        setStaffPhone(staff.phone);
      }
    };
    if (open) loadStaffPhone();
  }, [open]);

  const handleCall = async () => {
    if (!staffPhone) {
      toast.error("Informe seu número de telefone");
      return;
    }

    setCalling(true);
    setCallStatus("calling");

    try {
      const { data, error } = await supabase.functions.invoke("twilio-make-call", {
        body: {
          lead_phone: leadPhone,
          staff_phone: staffPhone,
          lead_id: leadId,
          lead_name: leadName,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setCallStatus("connected");
        toast.success("Ligação iniciada! Atenda seu telefone.");
        onCallStarted?.();
      } else {
        throw new Error(data?.error || "Erro ao iniciar ligação");
      }
    } catch (err: any) {
      console.error("Call error:", err);
      toast.error(err.message || "Erro ao iniciar ligação");
      setCallStatus("idle");
    } finally {
      setCalling(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCallStatus("idle");
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={handleClick}
          className="p-1 rounded-md hover:bg-primary/10 transition-colors group"
          title={`Ligar para ${leadName}`}
        >
          <Phone className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleClick}>
          <Phone className="h-3.5 w-3.5 mr-1" />
          Ligar
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              Ligar para {leadName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm text-muted-foreground">Número do lead</p>
              <p className="font-mono font-medium">{leadPhone}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-phone">Seu número (para receber a ligação)</Label>
              <Input
                id="staff-phone"
                placeholder="+5511999999999"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                disabled={callStatus !== "idle"}
              />
              <p className="text-[11px] text-muted-foreground">
                O Twilio ligará para você primeiro e depois conectará ao lead.
              </p>
            </div>

            {callStatus === "connected" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <PhoneCall className="h-4 w-4 text-emerald-600 animate-pulse" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Ligação iniciada — atenda seu telefone!
                </span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              {callStatus === "idle" && (
                <Button onClick={handleCall} disabled={calling} className="gap-2">
                  {calling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  Iniciar Ligação
                </Button>
              )}
              {callStatus === "connected" && (
                <Button variant="outline" onClick={handleClose}>
                  Fechar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
