import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { waErrorPt } from "@/lib/whatsapp/waErrorPt";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  Filter,
  Phone,
  Video,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Image,
  Clock,
  CheckCheck,
  MessageSquare,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Trash2,
  X,
  ChevronLeft,
  Info,
  Instagram,
  Bot,
  ShieldCheck,
  XCircle,
  EyeOff,
  PanelRight,
  Hourglass,
  User as UserIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCRMContext } from "./CRMLayout";
import { toast } from "sonner";
import { ServiceConfigDialog } from "@/components/crm/service-config/ServiceConfigDialog";
import { useWhatsAppConversations, WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import { useInstagramConversations } from "@/hooks/useInstagramConversations";
import { useInstagramMessages } from "@/hooks/useInstagramMessages";
import { ConversationSidebar } from "@/components/crm/inbox/ConversationSidebar";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ConversationFilters, ConversationFiltersData, defaultFilters } from "@/components/crm/inbox/ConversationFilters";
import { AudioPlayer } from "@/components/crm/inbox/AudioPlayer";
import { MediaUploadButton } from "@/components/crm/inbox/MediaUploadButton";
import { OfficialTemplateSendDialog } from "@/components/crm/OfficialTemplateSendDialog";
import { AudioRecorder } from "@/components/crm/inbox/AudioRecorder";
import { ReceiptAnalysisButton } from "@/components/crm/inbox/ReceiptAnalysisButton";
import { useCompanyIdentification } from "@/hooks/useCompanyIdentification";
import { useIsMobile } from "@/hooks/use-mobile";

// Cor estável por remetente (estilo WhatsApp em grupos) — mesmo nome, mesma cor.
// Nome sem nenhuma letra/número (".", "~", emoji solto) não identifica ninguém: usa o telefone.
const nomeValido = (n?: string | null) => /[\p{L}\p{N}]/u.test(String(n || ""));
const iniciais = (n: string) => {
  const limpo = String(n || "").trim();
  if (/^\+?\d[\d\s()-]*$/.test(limpo)) return limpo.replace(/\D/g, "").slice(-2);
  const partes = limpo.split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x));
  return ((partes[0]?.[0] || "?") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
};
const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const rotuloDia = (d: Date) => {
  const hoje = new Date(); const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return format(d, d.getFullYear() === hoje.getFullYear() ? "dd/MM" : "dd/MM/yyyy");
};
// Esperando resposta = a última mensagem é do contato (no Instagram, usa o não lidas).
// Só entra na fila o que é recente (7 dias) e ainda está aberto — senão vira depósito de "ok" e "obrigado".
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
const esperando = (c: any) => {
  if (c.status === "closed") return false;
  if (!c.last_message_at || Date.now() - new Date(c.last_message_at).getTime() > SETE_DIAS) return false;
  if (c.channel === "instagram") return (c.unread_count || 0) > 0;
  if (c.last_message_direction !== "inbound") return false;
  // alguém já abriu depois da última mensagem do contato: sai da fila (volta se ele escrever de novo)
  if (c.waiting_seen_at && c.last_inbound_at && new Date(c.waiting_seen_at).getTime() >= new Date(c.last_inbound_at).getTime()) return false;
  return true;
};
const haQuanto = (iso?: string | null) => {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
};
// Separador dentro da conversa: "Hoje", "Ontem" ou a data por extenso (sábado, 19 de setembro).
const rotuloDiaLongo = (d: Date) => {
  const r = rotuloDia(d);
  if (r === "Hoje" || r === "Ontem") return `${r} · ${format(d, "dd/MM/yyyy")}`;
  const txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
};
// Lista de conversas: hoje mostra a hora, ontem "Ontem", antes disso a data curta.
const quandoCurto = (iso: string) => { const d = new Date(iso); return mesmoDia(d, new Date()) ? format(d, "HH:mm") : rotuloDia(d); };

function senderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 62%, 45%)`;
}

export const CRMInboxPage = () => {
  const [searchParams] = useSearchParams();
  const conversationIdFromUrl = searchParams.get("conversation");
  const { staffId, staffName, isAdmin, staffRole } = useCRMContext();
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [officialTemplateOpen, setOfficialTemplateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "whatsapp" | "instagram">("all");
  // Filtro rápido por número/conta (evo:<id> | off:<id> | ig:<id>); lembra a última escolha
  const [instanceFilter, setInstanceFilter] = useState<string>(() => {
    try { return localStorage.getItem("crm_inbox_instance_filter") || "all"; } catch { return "all"; }
  });
  const [instanceNames, setInstanceNames] = useState<{ value: string; label: string }[]>([]);
  // Conversas ocultadas (grupos de promoção etc.): somem da lista e o servidor para de gravar
  const [ignoredPhones, setIgnoredPhones] = useState<Set<string>>(new Set());
  useEffect(() => {
    (supabase as any).from("crm_whatsapp_ignored_chats").select("phone").then(({ data }: any) => {
      setIgnoredPhones(new Set(((data || []) as any[]).map((r) => r.phone)));
    });
  }, []);
  const ocultarConversa = async (conv: any) => {
    const phone = String(conv?.contact?.phone || "");
    if (!phone) return;
    if (!window.confirm(`Ocultar "${conv.contact?.name || phone}"? Ela some do Atendimento e o sistema para de guardar as mensagens dela.`)) return;
    const { error } = await (supabase as any).from("crm_whatsapp_ignored_chats").insert({ phone, name: conv.contact?.name || null, created_by: staffId || null });
    if (error) { toast.error("Não consegui ocultar: " + error.message); return; }
    setIgnoredPhones((prev) => new Set(prev).add(phone));
    setSelectedConversation(null);
    toast.success("Conversa ocultada", {
      action: { label: "Desfazer", onClick: async () => {
        await (supabase as any).from("crm_whatsapp_ignored_chats").delete().eq("phone", phone);
        setIgnoredPhones((prev) => { const n = new Set(prev); n.delete(phone); return n; });
      } },
    });
  };
  useEffect(() => {
    try { localStorage.setItem("crm_inbox_instance_filter", instanceFilter); } catch { /* sem storage */ }
  }, [instanceFilter]);
  useEffect(() => {
    (async () => {
      const [evo, off, ig] = await Promise.all([
        supabase.from("whatsapp_instances").select("id, instance_name, display_name").eq("show_in_inbox", true),
        supabase.from("whatsapp_official_instances").select("id, display_name, phone_number").eq("show_in_inbox", true),
        supabase.from("instagram_instances").select("id, instance_name, instagram_username").eq("show_in_inbox", true),
      ]);
      setInstanceNames([
        ...((evo.data || []) as any[]).map((i) => ({ value: `evo:${i.id}`, label: i.display_name || i.instance_name })),
        ...((off.data || []) as any[]).map((i) => ({ value: `off:${i.id}`, label: `${i.display_name || i.phone_number} (API oficial)` })),
        ...((ig.data || []) as any[]).map((i) => ({ value: `ig:${i.id}`, label: i.instagram_username ? `@${i.instagram_username} (Instagram)` : i.instance_name })),
      ]);
    })();
  }, []);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [connectedInstances, setConnectedInstances] = useState<string[]>([]);
  const [allowedInstanceIds, setAllowedInstanceIds] = useState<string[]>([]);
  const [allowedOfficialInstanceIds, setAllowedOfficialInstanceIds] = useState<string[]>([]);
  const [allowedIgInstanceIds, setAllowedIgInstanceIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Redesenho 19/09/2026 (opção 2 + fila da 3): atalhos de filtro, fila por prioridade,
  // negócio no topo da conversa e painel lateral recolhível.
  const [quick, setQuick] = useState<"all" | "unread" | "waiting" | "mine">("all");
  const [showDetails, setShowDetails] = useState<boolean>(() => { try { return localStorage.getItem("crm_inbox_details") === "1"; } catch { return false; } });
  const toggleDetails = () => setShowDetails((v) => { try { localStorage.setItem("crm_inbox_details", v ? "0" : "1"); } catch { /* ok */ } return !v; });
  const [stageMap, setStageMap] = useState<Record<string, { stage: string; pipeline: string; pipelineId?: string }>>({});
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const [{ data: st }, { data: pp }, { data: sf }] = await Promise.all([
        supabase.from("crm_stages").select("id, name, pipeline_id, final_type"),
        supabase.from("crm_pipelines").select("id, name"),
        supabase.from("onboarding_staff").select("id, name").eq("is_active", true),
      ]);
      const pm: Record<string, string> = {}; for (const x of (pp || []) as any[]) pm[x.id] = x.name;
      const sm: Record<string, { stage: string; pipeline: string; pipelineId?: string }> = {};
      for (const x of (st || []) as any[]) sm[x.id] = { stage: x.name, pipeline: pm[x.pipeline_id] || "", pipelineId: x.pipeline_id, lost: x.final_type === "lost" } as any;
      setStageMap(sm);
      setPipelines(((pp || []) as any[]).map((x) => ({ id: x.id, name: x.name })).sort((a, b) => a.name.localeCompare(b.name)));
      const nm: Record<string, string> = {}; for (const x of (sf || []) as any[]) nm[x.id] = x.name;
      setStaffNames(nm);
    })();
  }, []);
  const [filters, setFilters] = useState<ConversationFiltersData>(defaultFilters);
  // Filtro "Agente de IA": conversas em que o agente atuou ou está ligado (vem do banco, WhatsApp e Instagram)
  const [aiAgentConvIds, setAiAgentConvIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!filters.aiAgentId) { setAiAgentConvIds(null); return; }
    let ativo = true;
    (async () => {
      const { data, error } = await (supabase as any).rpc("crm_agent_conversation_ids", { p_agent: filters.aiAgentId === "any" ? null : filters.aiAgentId });
      if (!ativo) return;
      if (error) { toast.error("Não consegui aplicar o filtro de agente"); setAiAgentConvIds(null); return; }
      setAiAgentConvIds(new Set((data || []).map((r: any) => String(r.conversation_id))));
    })();
    return () => { ativo = false; };
  }, [filters.aiAgentId]);
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const [igSending, setIgSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Use real data hooks
  const { 
    conversations: whatsappConversations, 
    loading: loadingWhatsApp, 
    refetch: refetchConversations,
    markAsRead,
    closeConversation,
    reopenConversation,
  } = useWhatsAppConversations({
    status: filterStatus !== "all" ? filterStatus : undefined,
  });

  // Instagram conversations
  const {
    conversations: instagramConversations,
    loading: loadingInstagram,
    refetch: refetchIgConversations,
    markAsRead: markIgAsRead,
  } = useInstagramConversations();

  const loadingConversations = loadingWhatsApp || loadingInstagram;

  // Merge WhatsApp + Instagram conversations and tag the channel
  const allConversations = [
    ...whatsappConversations.map(c => ({ ...c, channel: "whatsapp" as const })),
    ...instagramConversations,
  ].sort((a, b) => {
    // Sempre a conversa com a mensagem mais recente (enviada OU recebida) em primeiro.
    // Conversa sem mensagem ainda usa a data de criação, pra não cair no fim da lista.
    const dateA = new Date(a.last_message_at || a.created_at || 0).getTime();
    const dateB = new Date(b.last_message_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  // Debug log
  console.log('[Inbox] whatsapp:', whatsappConversations.length, 'instagram:', instagramConversations.length, 'staffRole:', staffRole, 'loadingAccess:', loadingAccess);
  
  // Filter conversations based on user's instance access
  const conversations = allConversations.filter((conv) => {
    // Channel filter
    if (channelFilter !== "all" && conv.channel !== channelFilter) return false;
    if (conv.channel !== "instagram" && ignoredPhones.has(String((conv as any).contact?.phone || ""))) return false;

    // Filtro por número/conta
    if (instanceFilter !== "all") {
      const [tipo, id] = instanceFilter.split(":");
      if (tipo === "ig" && conv.instagram_instance_id !== id) return false;
      if (tipo === "off" && !(conv.official_instance_id === id && !conv.instance_id)) return false;
      if (tipo === "evo" && conv.instance_id !== id) return false;
    }

    // NÃO dá bypass total pro master: a visibilidade do Atendimento (show_in_inbox)
    // vale pra todos, inclusive master. Instância com "Atendimento" desligado não
    // aparece — nem pro master. As instâncias visíveis já estão em allowedInstanceIds.
    // If still loading access, don't filter yet - will re-render when loaded
    if (loadingAccess) return false;

    // Instagram conversations - check IG instance access
    if (conv.channel === "instagram") {
      if (!conv.instagram_instance_id) return true; // orphan
      return allowedIgInstanceIds.includes(conv.instagram_instance_id);
    }
    
    // Check Official API access
    if (conv.official_instance_id && !conv.instance_id) {
      return allowedOfficialInstanceIds.includes(conv.official_instance_id);
    }
    
    // Orphan conversations (no instance_id and no official_instance_id):
    // only admin/master can see them — regular staff must NOT see unassigned conversations
    if (!conv.instance_id && !conv.official_instance_id) {
      return staffRole === "admin" || staffRole === "master";
    }
    
    // Check if user has access to this Evolution instance
    const hasAccess = conv.instance_id ? allowedInstanceIds.includes(conv.instance_id) : false;
    return hasAccess;
  });

  const isInstagramConversation = selectedConversation?.channel === "instagram";

  const { 
    messages: whatsappMessages, 
    loading: loadingWhatsAppMessages, 
    sending,
    sendMessage,
    sendMedia,
    refetch: refetchWhatsAppMessages,
  } = useWhatsAppMessages(isInstagramConversation ? null : (selectedConversation?.id || null));

  const {
    messages: igMessages,
    loading: loadingIgMessages,
    refetch: refetchIgMessages,
  } = useInstagramMessages(isInstagramConversation ? (selectedConversation?.id || null) : null);

  const messages = isInstagramConversation ? igMessages : whatsappMessages;
  const loadingMessages = isInstagramConversation ? loadingIgMessages : loadingWhatsAppMessages;
  const refetchMessages = isInstagramConversation ? refetchIgMessages : refetchWhatsAppMessages;

  // Reações (❤️ 👍): aparecem como emoji embaixo da mensagem reagida, igual no WhatsApp.
  // Reação cuja mensagem não está carregada continua aparecendo como balão próprio.
  const reactionsByTarget = useMemo(() => {
    const map = new Map<string, { emoji: string; direction: string }[]>();
    for (const m of messages as any[]) {
      if (m.type === "reaction" && m.quoted_message_id && m.content) {
        const arr = map.get(m.quoted_message_id) || [];
        arr.push({ emoji: m.content, direction: m.direction });
        map.set(m.quoted_message_id, arr);
      }
    }
    return map;
  }, [messages]);
  const loadedMessageIds = useMemo(() => new Set((messages as any[]).map((m) => m.id)), [messages]);

  // Company identification for receipt analysis
  const {
    company: identifiedCompany,
    invoices: companyInvoices,
  } = useCompanyIdentification({
    phone: selectedConversation?.contact?.phone,
  });

  // Fetch allowed instances for this user
  useEffect(() => {
    const fetchAllowedInstances = async () => {
      // Wait for staffId to be loaded
      if (!staffId) {
        console.log('[Inbox] Waiting for staffId...');
        return;
      }

      setLoadingAccess(true);
      try {
        console.log('[Inbox] Fetching allowed instances for staffId:', staffId, 'role:', staffRole);
        
        // Visibilidade GLOBAL do Atendimento: só instâncias marcadas como
        // "Visível no Atendimento" (config Dispositivos) aparecem — pra todos,
        // inclusive master. O acesso por usuário continua valendo por cima.
        const [{ data: visEvo }, { data: visOff }, { data: visIg }] = await Promise.all([
          supabase.from("whatsapp_instances").select("id").eq("show_in_inbox", true),
          supabase.from("whatsapp_official_instances").select("id").eq("show_in_inbox", true),
          supabase.from("instagram_instances").select("id").eq("show_in_inbox", true),
        ]);
        const visEvoIds = (visEvo || []).map((i: any) => i.id);
        const visOffIds = (visOff || []).map((i: any) => i.id);
        const visIgIds = (visIg || []).map((i: any) => i.id);

        // Master has access to all (visible) instances
        if (staffRole === "master") {
          setAllowedInstanceIds(visEvoIds);
          setAllowedOfficialInstanceIds(visOffIds);
          setAllowedIgInstanceIds(visIgIds);
        } else {
          // Get Evolution API instances this user has explicit access to
          const { data: evolutionAccessData, error: evolutionError } = await supabase
            .from("whatsapp_instance_access")
            .select("instance_id")
            .eq("staff_id", staffId)
            .eq("can_view", true);

          if (evolutionError) {
            console.error('[Inbox] Error fetching Evolution access:', evolutionError);
          }

          const evolutionIds = (evolutionAccessData || []).map((a: any) => a.instance_id);
          setAllowedInstanceIds(evolutionIds.filter((id: string) => visEvoIds.includes(id)));

          // Get Official API instances this user has explicit access to
          const { data: officialAccessData, error: officialError } = await supabase
            .from("whatsapp_official_instance_access")
            .select("instance_id")
            .eq("staff_id", staffId)
            .eq("can_view", true);

          if (officialError) {
            console.error('[Inbox] Error fetching Official API access:', officialError);
          }

          const officialIds = (officialAccessData || []).map((a: any) => a.instance_id);
          setAllowedOfficialInstanceIds(officialIds.filter((id: string) => visOffIds.includes(id)));

          // Get Instagram instances this user has explicit access to
          const { data: igAccessData } = await supabase
            .from("instagram_instance_access")
            .select("instance_id")
            .eq("staff_id", staffId)
            .eq("can_view", true);

          const igIds = (igAccessData || []).map((a: any) => a.instance_id);
          setAllowedIgInstanceIds(igIds.filter((id: string) => visIgIds.includes(id)));
        }
      } catch (error) {
        console.error("Error fetching allowed instances:", error);
      } finally {
        setLoadingAccess(false);
      }
    };
    fetchAllowedInstances();
  }, [staffId, staffRole]);

  // Fetch connected instances and project ID
  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch instances
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status")
        .eq("status", "connected");
      
      if (instances) {
        setConnectedInstances(instances.map((i: any) => i.id));
      }

      // Get project ID from staff/company chain
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("company:onboarding_companies(projects:onboarding_projects(id))")
        .maybeSingle();
      
      const projects = (staff?.company as any)?.projects;
      if (projects && projects.length > 0) {
        setProjectId(projects[0].id);
      }
    };
    fetchInitialData();
  }, []);

  // Scroll to bottom when messages change or conversation is selected
  // Só rola sozinho ao abrir/trocar de conversa, quando a última mensagem é minha, ou quando
  // chega mensagem nova e eu já estava perto do fim. Lendo mensagens antigas, fica onde está.
  const scrollState = useRef<{ conv: string | null; count: number; pending: boolean }>({ conv: null, count: 0, pending: false });
  useEffect(() => {
    const st = scrollState.current;
    const convId = selectedConversation?.id || null;
    if (st.conv !== convId) { st.conv = convId; st.pending = true; st.count = 0; }
    if (!messages.length || loadingMessages) return;
    // ao trocar de conversa, as mensagens da ANTERIOR ainda estão na tela por um instante:
    // só considera "aberta" quando as mensagens já são desta conversa (senão gastava a rolagem à toa)
    const donoDasMsgs = (messages[0] as any)?.conversation_id;
    if (st.pending && donoDasMsgs && convId && String(donoDasMsgs) !== String(convId)) return;
    const viewport = messagesScrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    const pertoDoFim = !viewport || viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 220;
    const cresceu = messages.length > st.count;
    const ultimaMinha = (messages[messages.length - 1] as any)?.direction === "outbound";
    if (st.pending) {
      // abriu a conversa: vai direto pro fim, sem animação, e repete enquanto imagens/áudios carregam
      scrollToBottom(true);
      [250, 700, 1500].forEach((ms) => setTimeout(() => { if (scrollState.current.conv === convId) scrollToBottom(true); }, ms));
    } else if (cresceu && (pertoDoFim || ultimaMinha)) scrollToBottom();
    st.pending = false;
    st.count = messages.length;
  }, [messages, selectedConversation?.id, loadingMessages]);

  // Sync selectedConversation with conversations when they update (e.g., from realtime)
  useEffect(() => {
    if (selectedConversation) {
      const updated = conversations.find(c => c.id === selectedConversation.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedConversation)) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations]);

  // Auto-select conversation from URL parameter
  useEffect(() => {
    if (!conversationIdFromUrl) return;
    
    // If already selected the correct conversation, skip
    if (selectedConversation?.id === conversationIdFromUrl) return;
    
    // Try to find in loaded conversations first
    const conv = conversations.find(c => c.id === conversationIdFromUrl);
    if (conv) {
      setSelectedConversation(conv);
      return;
    }
    
    // If not in list but we have conversations loaded, fetch directly
    if (conversations.length > 0 && !loadingConversations) {
      const fetchConversationById = async () => {
        try {
          const { data, error } = await supabase
            .from('crm_whatsapp_conversations')
            .select(`
              *,
              contact:crm_whatsapp_contacts(*),
              lead:crm_leads(id, name),
              assigned_staff:onboarding_staff(id, name, avatar_url)
            `)
            .eq('id', conversationIdFromUrl)
            .single();
          
          if (data && !error) {
            setSelectedConversation(data);
          }
        } catch (err) {
          console.error('Error fetching conversation by ID:', err);
        }
      };
      fetchConversationById();
    }
  }, [conversationIdFromUrl, conversations, selectedConversation, loadingConversations]);

  // Fila "Esperando resposta": a conversa só sai da fila quando o usuário SAI dela (abre outra,
  // fecha ou troca de tela) — não no clique, senão ela some da lista na mão de quem está lendo.
  useEffect(() => {
    const conv: any = selectedConversation;
    if (!conv || conv.channel === "instagram") return;
    const id = conv.id;
    return () => {
      supabase.from("crm_whatsapp_conversations")
        .update({ waiting_seen_at: new Date(Date.now() + 5000).toISOString() } as any)
        .eq("id", id).eq("last_message_direction", "inbound")
        .then(() => { refetchConversations(); }, () => {});
    };
  }, [selectedConversation?.id]);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      if (selectedConversation.channel === "instagram") {
        markIgAsRead(selectedConversation.id);
      } else {
        markAsRead(selectedConversation.id);
      }
    }
  }, [selectedConversation?.id]);

  const scrollToBottom = (instant = false) => {
    // IMPORTANT: avoid scrollIntoView() because it may scroll the whole page.
    // Instead, scroll the internal Radix ScrollArea viewport.
    setTimeout(() => {
      const root = messagesScrollAreaRef.current;
      const viewport = root?.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement | null;

      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: instant ? "auto" : "smooth" });
        return;
      }

      // Fallback: if viewport isn't found (should be rare), try the end ref.
      // Use block: 'nearest' to reduce the chance of scrolling outer containers.
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending || igSending) return;

    // Conversa de Instagram não tem dispositivo de WhatsApp — envia pela
    // instagram-send (mesmo caminho da aba Conversas do lead).
    if (isInstagramConversation) {
      const messageToSend = newMessage.trim();
      setNewMessage("");
      setIgSending(true);
      try {
        const { data, error } = await supabase.functions.invoke("instagram-send", {
          body: { conversationId: selectedConversation.id, message: messageToSend, staffId },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        refetchMessages();
      } catch (error: any) {
        console.error("Error sending IG message:", error);
        setNewMessage(messageToSend);
        toast.error(error.message || "Erro ao enviar mensagem no Instagram");
      } finally {
        setIgSending(false);
      }
      return;
    }

    const isOfficialAPI = !!selectedConversation.official_instance_id && !selectedConversation.instance_id;
    const isEvolutionAPI = !!selectedConversation.instance_id;

    if (!isOfficialAPI && !isEvolutionAPI) {
      toast.error("Conversa sem dispositivo associado");
      return;
    }

    const messageToSend = newMessage.trim();
    setNewMessage(""); // Clear immediately for better UX

    try {
      if (isOfficialAPI) {
        // Send via Official WhatsApp API
        const { data, error } = await supabase.functions.invoke('whatsapp-official-api', {
          body: {
            action: 'sendText',
            instanceId: selectedConversation.official_instance_id,
            phone: selectedConversation.contact?.phone || "",
            message: messageToSend,
          }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        // Insert the message locally
        const { error: insertError } = await supabase.from('crm_whatsapp_messages').insert({
          conversation_id: selectedConversation.id,
          content: messageToSend,
          type: 'text',
          direction: 'outbound',
          status: 'sent',
          sent_by: staffId,
          whatsapp_message_id: data?.messageId,
        });
        
        if (insertError) {
          console.error('Error inserting message:', insertError);
        }
        
        // Update conversation last message
        await supabase.from('crm_whatsapp_conversations').update({
          last_message: messageToSend.substring(0, 255),
          last_message_at: new Date().toISOString(),
        }).eq('id', selectedConversation.id);
        
        // Refetch and scroll
        await refetchMessages();
        scrollToBottom();
        
        toast.success("Mensagem enviada!");
      } else {
        // Send via Evolution API
        await sendMessage(
          messageToSend,
          selectedConversation.instance_id!,
          selectedConversation.contact?.phone || "",
          staffId
        );
        toast.success("Mensagem enviada!");
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      setNewMessage(messageToSend); // Restore message on error
      toast.error(error.message || "Erro ao enviar mensagem");
    }
  };

  const handleSendMedia = async (file: File, type: "image" | "video" | "audio" | "document") => {
    if (!selectedConversation) return;

    if (isInstagramConversation) {
      toast.error("Envio de mídia pelo Instagram ainda não é suportado — só texto.");
      return;
    }

    const isOfficialAPI = !!selectedConversation.official_instance_id && !selectedConversation.instance_id;
    const isEvolutionAPI = !!selectedConversation.instance_id;
    
    if (!isOfficialAPI && !isEvolutionAPI) {
      toast.error("Conversa sem dispositivo associado");
      return;
    }

    try {
      if (isOfficialAPI) {
        // For now, official API media needs to be handled separately
        toast.error("Envio de mídia ainda não suportado para API Oficial");
        return;
      }
      
      // Send via Evolution API
      await sendMedia(
        file,
        type,
        selectedConversation.instance_id!,
        selectedConversation.contact?.phone || "",
        staffId
      );
      toast.success("Mídia enviada!");
    } catch (error) {
      toast.error("Erro ao enviar mídia");
    }
  };

  // Delete conversation (master only)
  const handleDeleteConversation = async () => {
    if (!selectedConversation || staffRole !== "master") return;
    
    setDeletingConversation(true);
    try {
      // First delete all messages
      const { error: messagesError } = await supabase
        .from("crm_whatsapp_messages")
        .delete()
        .eq("conversation_id", selectedConversation.id);
      
      if (messagesError) throw messagesError;
      
      // Then delete the conversation
      const { error: convError } = await supabase
        .from("crm_whatsapp_conversations")
        .delete()
        .eq("id", selectedConversation.id);
      
      if (convError) throw convError;
      
      toast.success("Conversa excluída com sucesso");
      setSelectedConversation(null);
      setDeleteDialogOpen(false);
      refetchConversations();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Erro ao excluir conversa");
    } finally {
      setDeletingConversation(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const displayName = (() => {
      const rawName = (conv.contact?.name || "").trim();
      const isGeneric = !rawName || ["sou eu", "eu", "me"].includes(rawName.toLowerCase());
      return isGeneric ? conv.lead?.name || rawName : rawName;
    })();

    // Busca por nome do contato, nome do lead, EMPRESA do lead e telefone (pedido 11/09/2026)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const haystack = [displayName, conv.contact?.name, conv.lead?.name, (conv.lead as any)?.company, conv.contact?.phone]
        .filter(Boolean).map((v) => String(v).toLowerCase());
      if (!haystack.some((v) => v.includes(search))) return false;
    }

    if (quick === "unread" && !(conv.unread_count > 0)) return false;
    if (quick === "waiting" && !(esperando(conv) && !(stageMap[String((conv.lead as any)?.stage_id || "")] as any)?.lost)) return false;
    if (quick === "mine" && conv.assigned_to !== staffId) return false;

    // Conversation filters
    if (filters.assignedToMe && conv.assigned_to !== staffId) return false;
    if (filters.unassigned && conv.assigned_to !== null) return false;
    if (filters.read && conv.unread_count > 0) return false;
    if (filters.unread && conv.unread_count === 0) return false;
    if (filters.status && conv.status !== filters.status) return false;
    if (filters.assignedTo && conv.assigned_to !== filters.assignedTo) return false;
    if (filters.sectorId && conv.sector_id !== filters.sectorId) return false;
    if (filters.aiAgentId && !aiAgentConvIds) return false; // filtro ainda carregando
    if (filters.aiAgentId && aiAgentConvIds && !aiAgentConvIds.has(String(conv.id))) return false;
    if (filters.instanceId) {
      if (filters.instanceId.startsWith("official:")) {
        const officialId = filters.instanceId.replace("official:", "");
        if (conv.official_instance_id !== officialId) return false;
      } else {
        if (conv.instance_id !== filters.instanceId) return false;
      }
    }
    
    // Deal filters
    if (filters.hasDeal === "with" && !conv.lead_id) return false;
    if (filters.hasDeal === "without" && conv.lead_id) return false;
    // Funil e etapa do negócio (antes o painel mostrava o filtro mas ninguém aplicava — 22/09/2026)
    if (filters.dealPipeline.length) {
      const pid = stageMap[String((conv.lead as any)?.stage_id || "")]?.pipelineId;
      if (!pid || !filters.dealPipeline.includes(pid)) return false;
    }
    if (filters.dealStage.length && !filters.dealStage.includes(String((conv.lead as any)?.stage_id || ""))) return false;

    // Date filter
    if (filters.createdAt) {
      const convDate = new Date(conv.created_at);
      const filterDate = new Date(filters.createdAt);
      if (convDate.toDateString() !== filterDate.toDateString()) return false;
    }

    return true;
  });

  // contagens dos atalhos olham o que o usuário enxerga, sem o próprio atalho aplicado
  const aguardando = (c: any) => esperando(c) && !(stageMap[String(c.lead?.stage_id || "")] as any)?.lost;
  const contagens = useMemo(() => ({
    unread: conversations.filter((c: any) => (c.unread_count || 0) > 0).length,
    waiting: conversations.filter((c: any) => aguardando(c)).length,
  }), [conversations, stageMap]);
  // Fila: quem está esperando resposta sobe, e dentro de cada grupo vale o mais recente.
  const filaEsperando = filteredConversations.filter((c: any) => aguardando(c));
  const filaAndamento = filteredConversations.filter((c: any) => !aguardando(c));
  const listaOrdenada = [...filaEsperando, ...filaAndamento];

  const getStatusIcon = (status: string, errorText?: string | null) => {
    switch (status) {
      case "failed":
        return <XCircle className="h-3 w-3 text-destructive" title={errorText || "Falha na entrega"} />;
      case "sent":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const hasConnectedDevice = connectedInstances.length > 0;

  // Apagar para todos: só mensagem nossa, em número conectado via Evolution.
  const apagarParaTodos = async (message: any) => {
    if (!window.confirm("Apagar esta mensagem para todos? Ela some também no WhatsApp do contato.")) return;
    const { data, error } = await supabase.functions.invoke("evolution-api", { body: { action: "deleteMessage", messageId: message.id, staffId } });
    if (error || !(data as any)?.ok) { toast.error((data as any)?.error || "Não consegui apagar a mensagem."); return; }
    toast.success("Mensagem apagada para todos.");
    refetchMessages();
  };

  const handleLeadCreated = (leadId: string) => {
    setSelectedConversation((prev) => (prev ? { ...prev, lead_id: leadId } : prev));
    refetchConversations();
  };

  return (
    <div className="h-full min-h-0 flex overflow-hidden">
      {/* Conversations List - Hidden on mobile when conversation is selected */}
      <div className={cn(
        "min-h-0 border-r border-border flex flex-col bg-card",
        isMobile ? (selectedConversation ? "hidden" : "w-full") : "w-[300px]"
      )}>
        {/* Search Header */}
        <div className="p-2 sm:p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 shrink-0"
                onClick={() => setShowConfigDialog(true)}
                title="Configurações de atendimento"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Atalhos + filtros compactos */}
        <div className="px-2 sm:px-3 py-2 border-b border-border space-y-2">
          <div className="flex flex-wrap gap-1">
            {([
              ["all", "Todas", 0],
              ["unread", "Não lidas", contagens.unread],
              ["waiting", "Esperando", contagens.waiting],
              ["mine", "Minhas", 0],
            ] as const).map(([k, label, n]) => (
              <button
                key={k}
                onClick={() => setQuick(k)}
                className={cn(
                  "h-7 px-2 rounded-full text-[11px] font-medium border whitespace-nowrap transition-colors flex items-center justify-center gap-1 flex-1",
                  quick === k ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {label}
                {n > 0 && <span className={cn("rounded-full px-1 text-[10px]", quick === k ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")}>{n > 99 ? "99+" : n}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              {/* Filtro rápido por número: só as contas que este usuário enxerga */}
              <SearchableSelect
                value={instanceFilter}
                onValueChange={setInstanceFilter}
                className="h-7 text-xs"
                placeholder="Todos os números"
                emptyMessage="Nenhum número encontrado."
                options={[
                  { value: "all", label: "Todos os números" },
                  ...instanceNames
                    .filter((o) => {
                      const [tipo, id] = o.value.split(":");
                      return tipo === "evo" ? allowedInstanceIds.includes(id) : tipo === "off" ? allowedOfficialInstanceIds.includes(id) : allowedIgInstanceIds.includes(id);
                    })
                    .sort((a, b) => a.label.localeCompare(b.label)),
                ]}
              />
            </div>
            <div className="flex rounded-md border border-border overflow-hidden shrink-0">
              {(["all", "whatsapp", "instagram"] as const).map((ch) => (
                <button key={ch} onClick={() => setChannelFilter(ch)} title={ch === "all" ? "Todos os canais" : ch === "whatsapp" ? "Só WhatsApp" : "Só Instagram"}
                  className={cn("h-7 w-7 flex items-center justify-center text-[10px] font-medium", channelFilter === ch ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>
                  {ch === "all" ? "Tudo" : ch === "whatsapp" ? <MessageSquare className="h-3.5 w-3.5" /> : <Instagram className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
            <Button variant={showFilters ? "secondary" : "ghost"} size="icon" className="h-7 w-7 shrink-0" title="Mais filtros" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          {/* Filtro rápido por funil (pedido do Fabrício 22/09/2026): mesma coisa que Filtros → Negócios → Funil */}
          <SearchableSelect
            value={filters.dealPipeline.length === 1 ? filters.dealPipeline[0] : filters.dealPipeline.length > 1 ? "varios" : "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, dealPipeline: v === "all" ? [] : v === "varios" ? f.dealPipeline : [v], dealStage: [] }))}
            className="h-7 text-xs"
            placeholder="Todos os funis"
            emptyMessage="Nenhum funil encontrado."
            options={[
              { value: "all", label: "Todos os funis" },
              ...(filters.dealPipeline.length > 1 ? [{ value: "varios", label: `${filters.dealPipeline.length} funis (ver Filtros)` }] : []),
              ...pipelines.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5" title={hasConnectedDevice ? "WhatsApp conectado" : "Nenhum dispositivo conectado"}>
              {hasConnectedDevice ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-destructive" />}
              <span className={cn("text-[10px]", hasConnectedDevice ? "text-green-600" : "text-destructive")}>{hasConnectedDevice ? "Conectado" : "Sem dispositivo"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[104px] h-6 text-[11px] border-none shadow-none px-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="closed">Fechados</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Atualizar" onClick={() => { refetchConversations(); refetchIgConversations(); }}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:!block">
          {loadingConversations || loadingAccess ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : allowedInstanceIds.length === 0 && allowedOfficialInstanceIds.length === 0 && staffRole !== "master" ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                Sem acesso a conexões
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Solicite ao administrador para vincular seu usuário a uma conexão WhatsApp
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {hasConnectedDevice 
                  ? "Nenhuma conversa encontrada" 
                  : "Conecte um dispositivo WhatsApp"}
              </p>
              {!hasConnectedDevice && isAdmin && (
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setShowConfigDialog(true)}
                  className="mt-2"
                >
                  Configurar dispositivo
                </Button>
              )}
            </div>
          ) : (
            listaOrdenada.map((conv, convIdx) => {
              const rawName = (conv.contact?.name || "").trim();
              const isGenericName = !nomeValido(rawName) || ["sou eu", "eu", "me"].includes(rawName.toLowerCase());
              const displayName = isGenericName ? conv.lead?.name || conv.contact?.phone || "Desconhecido" : rawName;
              // Destaque = nome do LEAD (quando vinculado); embaixo, a empresa. Sem lead, nome do contato.
              const leadName = (conv.lead?.name || "").trim();
              const titleName = leadName || displayName;
              const companyName = String((conv.lead as any)?.company || "").trim();
              const etapa = stageMap[String((conv.lead as any)?.stage_id || "")];
              const aguarda = aguardando(conv);
              const cabecalho = convIdx === 0 && filaEsperando.length > 0 ? `Esperando resposta · ${filaEsperando.length}`
                : convIdx === filaEsperando.length && filaEsperando.length > 0 && filaAndamento.length > 0 ? `Em andamento · ${filaAndamento.length}` : "";
              const esperaMin = aguarda && (conv as any).last_inbound_at ? (Date.now() - new Date((conv as any).last_inbound_at).getTime()) / 60000 : 0;

              return (
              <div key={conv.id}>
              {cabecalho && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border/60 flex items-center gap-1">
                  {convIdx === 0 && <Hourglass className="h-3 w-3" />}{cabecalho}
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedConversation(conv);
                  // Mark as read immediately on click (e tira da fila "Esperando resposta")
                  if (conv.unread_count > 0) {
                    markAsRead(conv.id);
                  }
                }}
                className={cn(
                  "relative w-full flex items-start gap-3 px-3 py-3.5 hover:bg-muted/50 transition-colors text-left border-b border-border/60 overflow-hidden",
                  conv.unread_count > 0 && "bg-primary/5",
                  selectedConversation?.id === conv.id && "bg-muted shadow-[inset_3px_0_0_hsl(var(--primary))]"
                )}
              >
                {conv.unread_count > 0 && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={conv.contact?.profile_picture_url || undefined} />
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: senderColor(titleName || "?") }}>
                    {iniciais(titleName || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm truncate", conv.unread_count > 0 ? "font-bold" : "font-medium")}>
                      {titleName}
                    </span>
                    <span className={cn("text-[10px] shrink-0", conv.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground")}>
                      {conv.last_message_at ? quandoCurto(conv.last_message_at) : ""}
                    </span>
                  </div>
                  {(companyName || etapa) && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[companyName, etapa ? `${etapa.pipeline} · ${etapa.stage}` : ""].filter(Boolean).join(" — ")}
                    </div>
                  )}
                  {aguarda && (conv as any).last_inbound_at && (
                    <div className={cn("text-[10px] font-medium", esperaMin > 120 ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
                      esperando {haQuanto((conv as any).last_inbound_at)}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    {conv.status === "pending" && (
                      <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                        <MessageSquare className="h-3 w-3 mr-0.5" />
                      </Badge>
                    )}
                    {conv.channel === "instagram" && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0 bg-pink-500/10 text-pink-600 border-pink-500/30">
                        <Instagram className="h-2.5 w-2.5 mr-0.5" /> IG
                      </Badge>
                    )}
                    {conv.channel !== "instagram" && conv.instance && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0 bg-green-500/10 text-green-600 border-green-500/30">
                        {conv.instance.display_name || conv.instance.instance_name}
                      </Badge>
                    )}
                    {conv.channel !== "instagram" && conv.official_instance && !conv.instance && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0 bg-blue-500/10 text-blue-600 border-blue-500/30">
                        📱 {conv.official_instance.display_name || 'API Oficial'}
                      </Badge>
                    )}
                    <p className={cn("text-xs truncate min-w-0 flex-1", conv.unread_count > 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>
                      {conv.last_message || "Sem mensagens"}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge className="h-5 min-w-5 shrink-0 rounded-full px-1.5 flex items-center justify-center text-[10px]" title={`${conv.unread_count} não lidas`}>
                        {conv.unread_count > 99 ? "99+" : conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
              </div>
            )})
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className={cn(
          "flex-1 flex flex-col min-h-0 overflow-hidden",
          isMobile && !selectedConversation && "hidden"
        )}>
          {/* Chat Header */}
          <div className="h-14 border-b border-border flex items-center justify-between px-2 sm:px-4 bg-card">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Back button for mobile */}
              {isMobile && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                <AvatarImage src={selectedConversation.contact?.profile_picture_url || undefined} />
                <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: senderColor(selectedConversation.lead?.name || selectedConversation.contact?.name || selectedConversation.contact?.phone || "?") }}>
                  {(((() => {
                    const rawName = (selectedConversation.contact?.name || "").trim();
                    const isGenericName = !nomeValido(rawName) || ["sou eu", "eu", "me"].includes(rawName.toLowerCase());
                    return iniciais(isGenericName ? selectedConversation.lead?.name || selectedConversation.contact?.phone || "?" : rawName);
                  })()) || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {(() => {
                    const rawName = (selectedConversation.contact?.name || "").trim();
                    const isGenericName = !nomeValido(rawName) || ["sou eu", "eu", "me"].includes(rawName.toLowerCase());
                    return isGenericName ? selectedConversation.lead?.name || selectedConversation.contact?.phone : rawName;
                  })()}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{selectedConversation.contact?.phone}</span>
                  {selectedConversation.instance && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-green-500/10 text-green-600 border-green-500/30 shrink-0">
                      {selectedConversation.instance.display_name || selectedConversation.instance.instance_name}
                    </Badge>
                  )}
                  {selectedConversation.official_instance && !selectedConversation.instance && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30 shrink-0">
                      📱 {selectedConversation.official_instance.display_name || 'API Oficial'}
                    </Badge>
                  )}
                  {(() => {
                    const et = stageMap[String((selectedConversation.lead as any)?.stage_id || "")];
                    return et ? (
                      <a href={`#/crm/leads/${selectedConversation.lead_id}`} className="hidden md:inline-flex h-4 items-center px-1.5 rounded-full border border-border text-[10px] text-foreground hover:bg-muted shrink-0" title="Abrir o negócio">
                        {et.pipeline} · {et.stage}
                      </a>
                    ) : (
                      <span className="hidden md:inline-flex h-4 items-center px-1.5 rounded-full border border-dashed border-border text-[10px] shrink-0">sem negócio</span>
                    );
                  })()}
                  {selectedConversation.assigned_to && staffNames[selectedConversation.assigned_to] && (
                    <span className="hidden md:inline-flex h-4 items-center gap-1 px-1.5 rounded-full border border-border text-[10px] text-foreground shrink-0">
                      <UserIcon className="h-2.5 w-2.5" />{staffNames[selectedConversation.assigned_to].split(" ")[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                <Clock className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                <Video className="h-4 w-4" />
              </Button>
              {!isMobile && (
                <Button variant={showDetails ? "secondary" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={toggleDetails} title="Mostrar ou esconder os detalhes do contato e do negócio">
                  <PanelRight className="h-4 w-4" />
                  <span className="hidden lg:inline">Detalhes</span>
                </Button>
              )}
              {/* Mobile info button */}
              {isMobile && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowMobileInfo(true)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => closeConversation(selectedConversation.id)}>
                    <X className="h-4 w-4 mr-2" />
                    Fechar conversa
                  </DropdownMenuItem>
                  {(staffRole === "master" || staffRole === "admin") && selectedConversation.channel !== "instagram" && (
                    <DropdownMenuItem onClick={() => ocultarConversa(selectedConversation)}>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Ocultar e parar de receber
                    </DropdownMenuItem>
                  )}
                  {staffRole === "master" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir conversa
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea ref={messagesScrollAreaRef} className="flex-1 min-h-0 px-3 sm:px-6 py-4 bg-muted/40 [&>[data-radix-scroll-area-viewport]>div]:!block">
            <div className="space-y-1.5 max-w-4xl mx-auto">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                </div>
              ) : (
                messages
                  .filter((m: any) => !(m.type === "reaction" && m.quoted_message_id && loadedMessageIds.has(m.quoted_message_id)))
                  .map((message, idx, arr) => {
                    const dia = new Date(message.created_at);
                    const anterior = idx > 0 ? arr[idx - 1] : null;
                    const novoDia = !anterior || !mesmoDia(new Date(anterior.created_at), dia);
                    // troca de lado/autor ganha respiro; sequência do mesmo lado fica colada
                    const trocouLado = !!anterior && (anterior.direction !== message.direction || !!(anterior as any).is_ai !== !!(message as any).is_ai);
                    const falhou = message.direction === "outbound" && message.status === "failed";
                    return (
                  <Fragment key={message.id}>
                  {/* Data do dia: fica presa no topo enquanto rola, igual ao WhatsApp do celular */}
                  {novoDia && (
                    <div className="sticky top-0 z-10 flex justify-center py-2 pointer-events-none">
                      <span className="rounded-full bg-background border border-border px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm">{rotuloDiaLongo(dia)}</span>
                    </div>
                  )}
                  <div className={cn(trocouLado && !novoDia && "pt-2.5")}>
                  <div
                    className={cn(
                      "flex",
                      message.direction === "outbound" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "group/msg max-w-[85%] sm:max-w-[68%] rounded-2xl px-3.5 py-2 shadow-sm",
                        message.direction === "outbound"
                          ? falhou
                            // só mensagem com erro fica vermelha — antes toda enviada parecia erro
                            ? "rounded-br-md bg-destructive/10 text-foreground border border-destructive/30"
                            : (message as any).is_ai
                              // enviada pelo agente de IA: cor distinta da mensagem humana
                              ? "rounded-br-md bg-violet-500/10 text-foreground border border-violet-500/25"
                              : "rounded-br-md bg-emerald-500/10 text-foreground border border-emerald-500/20"
                          : "rounded-bl-md bg-card border border-border"
                      )}
                    >
                      {message.direction === "outbound" && (message as any).is_ai && (
                        <p className="text-[11px] font-semibold mb-1 flex items-center gap-1 text-violet-600 dark:text-violet-400">
                          <Bot className="h-3 w-3" />
                          Agente de IA
                        </p>
                      )}
                      {/* Enviada pelo sistema: mostra quem enviou. Sem sent_by = enviada do celular, fica normal. */}
                      {message.direction === "outbound" && !(message as any).is_ai && (message as any).sender?.name && (
                        <p className="text-[11px] font-semibold mb-0.5 text-emerald-700 dark:text-emerald-400">
                          {(message as any).sender.name}
                        </p>
                      )}
                      {/* Grupo de WhatsApp: mostra quem enviou a mensagem */}
                      {message.direction === "inbound" && message.sender_name && (
                        <p className="text-xs font-semibold mb-1" style={{ color: senderColor(message.sender_name) }}>
                          {message.sender_name}
                        </p>
                      )}
                      {/* Render media content based on message type */}
                      {(message as any).deleted_at ? (
                        <p className="text-sm italic text-muted-foreground flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Mensagem apagada</p>
                      ) : message.type === "image" && message.media_url ? (
                        <div className="space-y-2">
                          <img 
                            src={message.media_url} 
                            alt="Imagem" 
                            className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(message.media_url!, '_blank')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden text-sm text-muted-foreground italic">
                            📷 Imagem não disponível
                          </div>
                          {message.content && message.content !== "[Imagem]" && (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}
                          {/* Receipt analysis button for inbound images when company has open invoices */}
                          {message.direction === "inbound" && identifiedCompany && companyInvoices.length > 0 && (
                            <ReceiptAnalysisButton
                              mediaUrl={message.media_url!}
                              invoices={companyInvoices}
                              companyName={identifiedCompany.name}
                            />
                          )}
                        </div>
                      ) : message.type === "video" && message.media_url ? (
                        <div className="space-y-2">
                          <video 
                            src={message.media_url} 
                            controls 
                            className="max-w-full rounded-md"
                            onError={(e) => {
                              const target = e.target as HTMLVideoElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden text-sm text-muted-foreground italic">
                            🎥 Vídeo não disponível
                          </div>
                          {message.content && message.content !== "[Vídeo]" && (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>
                      ) : message.type === "audio" ? (
                        <AudioPlayer src={message.media_url || ""} messageId={message.id} />
                      ) : message.type === "document" && message.media_url ? (
                        <a 
                          href={message.media_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Paperclip className="h-4 w-4" />
                          {message.content || "Documento"}
                        </a>
                      ) : message.type === "sticker" ? (
                        message.media_url ? (
                          <img src={message.media_url} alt="Figurinha" className="w-32 h-32 object-contain" loading="lazy" />
                        ) : (
                          <div className="text-sm text-muted-foreground">🎭 Figurinha</div>
                        )
                      ) : message.type === "reaction" ? (
                        <p className="text-sm text-muted-foreground">
                          Reagiu com <span className="text-xl align-middle">{message.content}</span>
                        </p>
                      ) : message.type === "location" ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span>📍</span>
                          <span className="text-muted-foreground">Localização compartilhada</span>
                        </div>
                      ) : message.type === "contact" ? (
                        // Cartão de contato: nome em negrito e cada telefone clicável (copia só os dígitos)
                        <div className="flex items-start gap-2 text-sm">
                          <span>👤</span>
                          <div>
                            {(message.content || "Contato compartilhado").split("\n").map((linha, i) => (
                              /\d{8,}/.test(linha.replace(/\D/g, "")) ? (
                                <button key={i} type="button" className="block underline decoration-dotted hover:text-primary"
                                  title="Copiar número"
                                  onClick={() => { navigator.clipboard?.writeText(linha.replace(/\D/g, "")); toast.success("Número copiado"); }}>
                                  {linha}
                                </button>
                              ) : (
                                <div key={i} className={i === 0 ? "font-medium" : ""}>{linha}</div>
                              )
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground" title={format(new Date(message.created_at), "dd/MM/yyyy HH:mm")}>
                          {format(new Date(message.created_at), "HH:mm")}
                        </span>
                        {message.direction === "outbound" && getStatusIcon(message.status, waErrorPt((message as any).error_text))}
                        {message.direction === "outbound" && !(message as any).deleted_at && message.status !== "failed" && (message as any).remote_id
                          && selectedConversation.channel !== "instagram" && !!selectedConversation.instance_id
                          && Date.now() - new Date(message.created_at).getTime() < 48 * 3600000 && (
                          <button type="button" onClick={() => apagarParaTodos(message)} title="Apagar para todos"
                            className="ml-1 opacity-0 group-hover/msg:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {message.direction === "outbound" && message.status === "failed" && (
                        <p className="text-[10px] text-destructive mt-0.5">Não entregue{(message as any).error_text ? `: ${waErrorPt((message as any).error_text)}` : ""}</p>
                      )}
                      {reactionsByTarget.get(message.id)?.length ? (
                        <div className={cn("mt-1 -mb-1 flex", message.direction === "outbound" ? "justify-start" : "justify-end")}>
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 text-sm shadow-sm"
                            title={reactionsByTarget.get(message.id)!.map((r) => `${r.direction === "inbound" ? "Lead" : "Nós"}: ${r.emoji}`).join(" · ")}
                          >
                            {reactionsByTarget.get(message.id)!.map((r, i) => (
                              <span key={i}>{r.emoji}</span>
                            ))}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  </div>
                  </Fragment>
                    );
                  })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {selectedConversation.official_instance_id && (
            <OfficialTemplateSendDialog
              open={officialTemplateOpen}
              onOpenChange={setOfficialTemplateOpen}
              leads={[{ id: selectedConversation.lead_id || null, name: selectedConversation.contact?.name || selectedConversation.lead?.name || null, phone: selectedConversation.contact?.phone || null }]}
              conversationId={selectedConversation.id}
              onSent={() => refetchConversations()}
            />
          )}

          {/* Message Input */}
          <div className="border-t border-border p-2 sm:p-3 bg-card">
            <div className="flex items-center gap-1 sm:gap-2 max-w-3xl mx-auto">
              <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
                <Smile className="h-5 w-5" />
              </Button>
              <MediaUploadButton
                onUpload={handleSendMedia}
                disabled={sending}
              />
              {selectedConversation.official_instance_id && !selectedConversation.instance_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-emerald-600"
                  title="Enviar template (API oficial) — obrigatório fora da janela de 24h"
                  onClick={() => setOfficialTemplateOpen(true)}
                >
                  <ShieldCheck className="h-5 w-5" />
                </Button>
              )}
              <Input
                placeholder="Mensagem"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                className="flex-1"
                disabled={sending}
              />
              <AudioRecorder
                onSend={async (file) => {
                  if (isInstagramConversation) {
                    toast.error("Áudio pelo Instagram ainda não é suportado — só texto.");
                    return;
                  }
                  if (!selectedConversation?.instance_id) {
                    toast.error("Conversa sem dispositivo associado");
                    return;
                  }
                  await sendMedia(
                    file,
                    "audio",
                    selectedConversation.instance_id,
                    selectedConversation.contact?.phone || "",
                    staffId
                  );
                  toast.success("Áudio enviado!");
                }}
                disabled={sending}
              />
              <Button 
                onClick={handleSendMessage} 
                size={isMobile ? "icon" : "default"}
                className="shrink-0" 
                disabled={sending || !newMessage.trim()}
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">{sending ? "Enviando..." : "Enviar"}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex-1 flex items-center justify-center bg-muted/30",
          isMobile && "hidden"
        )}>
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-muted-foreground">Selecione uma conversa</p>
          </div>
        </div>
      )}

      {/* Right Sidebar - Lead Info & Actions - Hidden on Mobile */}
      {selectedConversation && !isMobile && showDetails && (
        <ConversationSidebar 
          conversation={selectedConversation}
          projectId={projectId || undefined}
          onLeadCreated={handleLeadCreated}
          onContactUpdated={() => refetchConversations()}
          onAssignmentChanged={() => refetchConversations()}
        />
      )}

      {/* Mobile Info Sheet */}
      {isMobile && selectedConversation && (
        <Sheet open={showMobileInfo} onOpenChange={setShowMobileInfo}>
          <SheetContent side="right" className="w-full sm:w-[400px] p-0">
            <ConversationSidebar 
              conversation={selectedConversation}
              projectId={projectId || undefined}
              onLeadCreated={handleLeadCreated}
              onContactUpdated={() => refetchConversations()}
              onAssignmentChanged={() => refetchConversations()}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Config Dialog */}
      <ServiceConfigDialog 
        open={showConfigDialog} 
        onOpenChange={setShowConfigDialog}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente toda a conversa e suas mensagens. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingConversation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={deletingConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingConversation ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filters Panel */}
      <ConversationFilters
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
        currentStaffId={staffId}
      />
    </div>
  );
};