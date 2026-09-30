// Tipos de atividade do CRM: lista fixa de reserva (usada quando a tabela
// crm_activity_types não responde) e mapa de ícones lucide por nome.
// Importar lucide inteiro pra ícone dinâmico custaria o bundle todo; aqui só os
// que fazem sentido pra atividade, e são esses que a tela de configuração oferece.
import {
  Phone, MessageSquare, Mail, Video, FileText, Repeat2, ListTodo, StickyNote, Calendar,
  Users, Clock, Star, Bell, SquareCheck, Send, MapPin, Coffee, Briefcase, Presentation,
  Handshake, ClipboardList, Instagram, Headphones, type LucideIcon,
} from "lucide-react";

export interface ActivityTypeOption {
  /** valor gravado em crm_activities.type (estável) */
  value: string;
  /** rótulo mostrado */
  label: string;
  icon?: string | null;
  color?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
}

export const FALLBACK_ACTIVITY_TYPES: ActivityTypeOption[] = [
  { value: "call", label: "Ligação", icon: "Phone", isSystem: true },
  { value: "whatsapp", label: "WhatsApp", icon: "MessageSquare", isSystem: true },
  { value: "email", label: "E-mail", icon: "Mail", isSystem: true },
  { value: "meeting", label: "Reunião", icon: "Video", isSystem: true },
  { value: "followup", label: "Follow-up", icon: "Repeat2", isSystem: true },
  { value: "proposal", label: "Proposta", icon: "FileText" },
  { value: "task", label: "Tarefa", icon: "ListTodo", isSystem: true },
  { value: "note", label: "Nota", icon: "StickyNote", isSystem: true },
  { value: "other", label: "Outro", icon: "Calendar" },
];

export const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  Phone, MessageSquare, Mail, Video, FileText, Repeat2, ListTodo, StickyNote, Calendar,
  Users, Clock, Star, Bell, SquareCheck, Send, MapPin, Coffee, Briefcase, Presentation,
  Handshake, ClipboardList, Instagram, Headphones,
};

export const ACTIVITY_ICON_NAMES = Object.keys(ACTIVITY_ICONS);

export const activityIcon = (name: string | null | undefined): LucideIcon =>
  (name && ACTIVITY_ICONS[name]) || Calendar;

/** Gera o slug a partir do nome: "Visita técnica" -> "visita_tecnica". */
export const slugFromName = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
