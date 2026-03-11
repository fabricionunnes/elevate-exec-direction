export interface InstagramAccount {
  id: string;
  project_id: string;
  instagram_user_id: string;
  username: string;
  full_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  website: string | null;
  followers_count: number;
  following_count: number;
  media_count: number;
  status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstagramPost {
  id: string;
  account_id: string;
  instagram_post_id: string;
  post_type: string;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  metrics?: InstagramPostMetrics;
}

export interface InstagramPostMetrics {
  id: string;
  post_id: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profile_visits: number;
  link_clicks: number;
  engagement_rate: number;
  reach_rate: number;
}

export interface InstagramAccountMetrics {
  id: string;
  account_id: string;
  followers_count: number;
  following_count: number;
  media_count: number;
  total_reach: number;
  total_impressions: number;
  total_engagement: number;
  avg_likes: number;
  avg_comments: number;
  avg_shares: number;
  avg_saves: number;
  profile_score: number;
  recorded_date: string;
}

export interface InstagramInsight {
  id: string;
  account_id: string;
  insight_type: string;
  title: string;
  description: string;
  data: any;
  priority: string;
  generated_at: string;
}

export interface InstagramCompetitor {
  id: string;
  account_id: string;
  competitor_username: string;
  competitor_full_name: string | null;
  followers_count: number;
  avg_engagement_rate: number;
  posts_per_week: number;
  last_synced_at: string | null;
}

export interface InstagramContentSuggestion {
  id: string;
  account_id: string;
  suggestion_type: string;
  theme: string;
  format: string | null;
  objective: string | null;
  cta: string | null;
  visual_style: string | null;
  description: string | null;
  is_used: boolean;
  generated_at: string;
}

export interface InstagramReport {
  id: string;
  account_id: string;
  title: string;
  report_type: string;
  period_start: string;
  period_end: string;
  data: any;
  pdf_url: string | null;
  share_token: string;
  created_at: string;
}

export type InstagramSection = 
  | "overview" 
  | "connect" 
  | "posts" 
  | "post-detail" 
  | "insights" 
  | "trends" 
  | "competitors" 
  | "score" 
  | "suggestions" 
  | "reports";
