import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Instagram, BarChart3, Grid3X3, Lightbulb, TrendingUp, Users, Star, Sparkles, FileText, Link2 } from "lucide-react";
import { useInstagramAccount } from "./useInstagramAccount";
import { InstagramOverview } from "./sections/InstagramOverview";
import { InstagramConnect } from "./sections/InstagramConnect";
import { InstagramPosts } from "./sections/InstagramPosts";
import { InstagramInsights } from "./sections/InstagramInsights";
import { InstagramTrends } from "./sections/InstagramTrends";
import { InstagramCompetitors } from "./sections/InstagramCompetitors";
import { InstagramScore } from "./sections/InstagramScore";
import { InstagramSuggestions } from "./sections/InstagramSuggestions";
import { InstagramReports } from "./sections/InstagramReports";
import { Loader2 } from "lucide-react";

interface ClientInstagramModuleProps {
  projectId: string;
  isStaff?: boolean;
}

export const ClientInstagramModule = ({ projectId, isStaff = false }: ClientInstagramModuleProps) => {
  const { account, loading, refetch } = useInstagramAccount(projectId);
  const [activeTab, setActiveTab] = useState("overview");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!account) {
    return <InstagramConnect projectId={projectId} isStaff={isStaff} onConnected={refetch} />;
  }

  return (
    <div className="space-y-4">
      {/* Account Header */}
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
        {account.profile_picture_url ? (
          <img src={account.profile_picture_url} alt={account.username} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
            <Instagram className="h-6 w-6 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base">@{account.username}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Conectado
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
            <span><strong className="text-foreground">{account.followers_count.toLocaleString("pt-BR")}</strong> seguidores</span>
            <span><strong className="text-foreground">{account.following_count.toLocaleString("pt-BR")}</strong> seguindo</span>
            <span><strong className="text-foreground">{account.media_count.toLocaleString("pt-BR")}</strong> posts</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs whitespace-nowrap">
            <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-1.5 text-xs whitespace-nowrap">
            <Grid3X3 className="h-3.5 w-3.5" /> Publicações
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5 text-xs whitespace-nowrap">
            <Lightbulb className="h-3.5 w-3.5" /> Insights IA
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5 text-xs whitespace-nowrap">
            <TrendingUp className="h-3.5 w-3.5" /> Tendências
          </TabsTrigger>
          <TabsTrigger value="competitors" className="gap-1.5 text-xs whitespace-nowrap">
            <Users className="h-3.5 w-3.5" /> Concorrentes
          </TabsTrigger>
          <TabsTrigger value="score" className="gap-1.5 text-xs whitespace-nowrap">
            <Star className="h-3.5 w-3.5" /> Score
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5 text-xs whitespace-nowrap">
            <Sparkles className="h-3.5 w-3.5" /> Sugestões
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs whitespace-nowrap">
            <FileText className="h-3.5 w-3.5" /> Relatórios
          </TabsTrigger>
          {isStaff && (
            <TabsTrigger value="connect" className="gap-1.5 text-xs whitespace-nowrap">
              <Link2 className="h-3.5 w-3.5" /> Conexão
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <InstagramOverview accountId={account.id} account={account} />
        </TabsContent>
        <TabsContent value="posts">
          <InstagramPosts accountId={account.id} account={account} />
        </TabsContent>
        <TabsContent value="insights">
          <InstagramInsights accountId={account.id} projectId={projectId} />
        </TabsContent>
        <TabsContent value="trends">
          <InstagramTrends accountId={account.id} />
        </TabsContent>
        <TabsContent value="competitors">
          <InstagramCompetitors accountId={account.id} isStaff={isStaff} />
        </TabsContent>
        <TabsContent value="score">
          <InstagramScore accountId={account.id} account={account} />
        </TabsContent>
        <TabsContent value="suggestions">
          <InstagramSuggestions accountId={account.id} projectId={projectId} />
        </TabsContent>
        <TabsContent value="reports">
          <InstagramReports accountId={account.id} projectId={projectId} />
        </TabsContent>
        {isStaff && (
          <TabsContent value="connect">
            <InstagramConnect projectId={projectId} isStaff={isStaff} onConnected={refetch} existingAccount={account} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
