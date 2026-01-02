import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: { id: string; name: string; role: string };
}

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
}

export const TaskComments = ({ taskId, projectId }: TaskCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    getCurrentUser();
  }, [taskId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .single();
      
      if (onboardingUser) {
        setCurrentUserId(onboardingUser.id);
      }
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_task_comments")
        .select(`*, user:onboarding_users(id, name, role)`)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() || !currentUserId) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("onboarding_task_comments")
        .insert({
          task_id: taskId,
          user_id: currentUserId,
          content: content.trim(),
        });

      if (error) throw error;

      // Also add to history
      await supabase.from("onboarding_task_history").insert({
        task_id: taskId,
        user_id: currentUserId,
        action: "comment",
        new_value: content.trim(),
      });

      setContent("");
      fetchComments();
      toast.success("Comentário adicionado");
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Erro ao adicionar comentário");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("onboarding_task_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      fetchComments();
      toast.success("Comentário removido");
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast.error("Erro ao remover comentário");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Comentários ({comments.length})</h4>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum comentário ainda</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(comment.user?.name || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{comment.user?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  {comment.user?.id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  )}
                </div>
                <p className="text-sm mt-1">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          placeholder="Adicionar comentário..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
        />
        <Button onClick={handleSubmit} disabled={sending || !content.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
