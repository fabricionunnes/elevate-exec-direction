import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Users, Clock, AlertTriangle, DoorOpen } from "lucide-react";
import { BoardRoom, WEEKDAY_LABELS, formatTimeSlot } from "./boardTypes";

interface RoomForm {
  name: string;
  weekday: string;
  time_slot: string;
  week_parity: "A" | "B";
  capacity: string;
}

const EMPTY_FORM: RoomForm = {
  name: "",
  weekday: "1",
  time_slot: "19:00",
  week_parity: "A",
  capacity: "25",
};

export function BoardRoomsTab() {
  const [rooms, setRooms] = useState<BoardRoom[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<BoardRoom | null>(null);
  const [form, setForm] = useState<RoomForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const [{ data: roomsData, error: roomsErr }, { data: membersData }] = await Promise.all([
        (supabase as any).from("unv_board_rooms").select("*").order("name"),
        (supabase as any)
          .from("unv_board_members")
          .select("id, room_id, status")
          .eq("status", "active"),
      ]);
      if (roomsErr) throw roomsErr;
      setRooms((roomsData || []) as BoardRoom[]);
      const counts: Record<string, number> = {};
      for (const m of (membersData || []) as { room_id: string | null }[]) {
        if (m.room_id) counts[m.room_id] = (counts[m.room_id] || 0) + 1;
      }
      setMemberCounts(counts);
    } catch (err) {
      console.error("Erro ao carregar salas:", err);
      toast.error("Erro ao carregar salas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const openCreate = () => {
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (room: BoardRoom) => {
    setEditingRoom(room);
    setForm({
      name: room.name,
      weekday: String(room.weekday),
      time_slot: formatTimeSlot(room.time_slot),
      week_parity: room.week_parity,
      capacity: String(room.capacity),
    });
    setDialogOpen(true);
  };

  const saveRoom = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome da sala");
      return;
    }
    const capacity = parseInt(form.capacity, 10);
    if (!capacity || capacity < 1) {
      toast.error("Capacidade inválida");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        weekday: parseInt(form.weekday, 10),
        time_slot: form.time_slot,
        week_parity: form.week_parity,
        capacity,
      };
      if (editingRoom) {
        const { error } = await (supabase as any)
          .from("unv_board_rooms")
          .update(payload)
          .eq("id", editingRoom.id);
        if (error) throw error;
        toast.success("Sala atualizada");
      } else {
        const { error } = await (supabase as any)
          .from("unv_board_rooms")
          .insert({ ...payload, is_active: true });
        if (error) throw error;
        toast.success("Sala criada");
      }
      setDialogOpen(false);
      setLoading(true);
      fetchRooms();
    } catch (err: any) {
      console.error("Erro ao salvar sala:", err);
      toast.error(err?.message || "Erro ao salvar sala");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (room: BoardRoom) => {
    try {
      const { error } = await (supabase as any)
        .from("unv_board_rooms")
        .update({ is_active: !room.is_active })
        .eq("id", room.id);
      if (error) throw error;
      toast.success(room.is_active ? "Sala desativada" : "Sala reativada");
      fetchRooms();
    } catch (err) {
      console.error("Erro ao alterar sala:", err);
      toast.error("Erro ao alterar sala");
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{rooms.length} sala(s)</span>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova sala
        </Button>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DoorOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Nenhuma sala criada ainda</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const count = memberCounts[room.id] || 0;
            const nearFull = count >= Math.min(22, room.capacity);
            const full = count >= room.capacity;
            return (
              <Card
                key={room.id}
                className={`${!room.is_active ? "opacity-60" : ""} ${
                  full
                    ? "border-red-500/60"
                    : nearFull
                      ? "border-yellow-500/60"
                      : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DoorOpen className="h-4 w-4 text-[#0D2B5E] dark:text-blue-300" />
                      {room.name}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(room)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {WEEKDAY_LABELS[room.weekday] || "—"} às {formatTimeSlot(room.time_slot)} ·
                    Semana {room.week_parity}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className={full ? "text-red-600 font-semibold" : nearFull ? "text-yellow-600 font-semibold" : ""}>
                      {count} / {room.capacity} membros
                    </span>
                  </div>
                  {(nearFull || full) && (
                    <div
                      className={`flex items-center gap-2 text-xs rounded-md p-2 ${
                        full
                          ? "bg-red-500/10 text-red-600"
                          : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {full
                        ? "Sala lotada — abra uma nova sala"
                        : "Sala quase cheia — planeje a próxima"}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Badge
                      variant="outline"
                      className={room.is_active ? "border-green-500 text-green-600" : ""}
                    >
                      {room.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(room)}>
                      {room.is_active ? "Desativar" : "Reativar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Editar sala" : "Nova sala"}</DialogTitle>
            <DialogDescription>
              Sala quinzenal do Board — dia fixo, horário fixo, semana A ou B.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                placeholder="Ex.: Sala 1 — Terça 19h"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <Select
                  value={form.weekday}
                  onValueChange={(v) => setForm((f) => ({ ...f, weekday: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={form.time_slot}
                  onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Paridade</Label>
                <Select
                  value={form.week_parity}
                  onValueChange={(v) => setForm((f) => ({ ...f, week_parity: v as "A" | "B" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Semana A</SelectItem>
                    <SelectItem value="B">Semana B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveRoom} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRoom ? "Salvar" : "Criar sala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
