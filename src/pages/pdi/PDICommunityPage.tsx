import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Plus, Send, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Post {
  id: string;
  participant_id: string;
  cohort_id: string | null;
  title: string;
  content: string;
  post_type: string;
  created_at: string;
  participant_name?: string;
  comments_count?: number;
}

interface Comment {
  id: string;
  post_id: string;
  participant_id: string;
  content: string;
  created_at: string;
  participant_name?: string;
}

const POST_TYPES = [
  { value: "discussion", label: "Discussão" },
  { value: "experience", label: "Experiência" },
  { value: "question", label: "Pergunta" },
  { value: "learning", label: "Aprendizado" },
];

export default function PDICommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [participants, setParticipants] = useState<{ id: string; full_name: string; cohort_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentAs, setCommentAs] = useState("");

  const fetchData = useCallback(async () => {
    const [postsRes, partsRes, commentsRes] = await Promise.all([
      supabase.from("pdi_community_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("pdi_participants").select("id, full_name, cohort_id"),
      supabase.from("pdi_community_comments").select("post_id"),
    ]);
    const parts = (partsRes.data as any[]) || [];
    setParticipants(parts);
    const pMap = new Map(parts.map((p) => [p.id, p.full_name]));
    const allComments = (commentsRes.data as any[]) || [];
    const commentCounts = new Map<string, number>();
    allComments.forEach((c) => {
      commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
    });

    setPosts(((postsRes.data as any[]) || []).map((p) => ({
      ...p, participant_name: pMap.get(p.participant_id) || "—",
      comments_count: commentCounts.get(p.id) || 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPost = async (post: Post) => {
    setSelectedPost(post);
    const { data } = await supabase.from("pdi_community_comments")
      .select("*").eq("post_id", post.id).order("created_at");
    const parts = participants;
    const pMap = new Map(parts.map((p) => [p.id, p.full_name]));
    setComments(((data as any[]) || []).map((c) => ({
      ...c, participant_name: pMap.get(c.participant_id) || "—",
    })));
  };

  const handleComment = async () => {
    if (!newComment.trim() || !commentAs || !selectedPost) return;
    await supabase.from("pdi_community_comments").insert({
      post_id: selectedPost.id,
      participant_id: commentAs,
      content: newComment,
    });
    setNewComment("");
    openPost(selectedPost);
    fetchData();
    toast.success("Comentário enviado!");
  };

  const getTypeLabel = (val: string) => POST_TYPES.find((t) => t.value === val)?.label || val;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunidade PDI</h1>
        <p className="text-sm text-muted-foreground">Fórum de discussões e troca de experiências</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : posts.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          Nenhuma publicação ainda. Os participantes podem criar posts pela página pública.
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <Card key={post.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openPost(post)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground text-sm">{post.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{getTypeLabel(post.post_type)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{post.participant_name}</span>
                      <span>{format(new Date(post.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{post.comments_count} comentários</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedPost?.title}</DialogTitle></DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div>
                <Badge variant="outline" className="text-[10px] mb-2">{getTypeLabel(selectedPost.post_type)}</Badge>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedPost.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Por {selectedPost.participant_name} em {format(new Date(selectedPost.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h4 className="font-semibold text-sm">Comentários ({comments.length})</h4>
                {comments.map((c) => (
                  <div key={c.id} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm">{c.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.participant_name} • {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                ))}

                <div className="space-y-2 pt-2">
                  <Select value={commentAs} onValueChange={setCommentAs}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Comentar como..." /></SelectTrigger>
                    <SelectContent>
                      {participants.map((p) => (<SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva um comentário..." className="flex-1" />
                    <Button size="icon" onClick={handleComment} disabled={!newComment.trim() || !commentAs}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
