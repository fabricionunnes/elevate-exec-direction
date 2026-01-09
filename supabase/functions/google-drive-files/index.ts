import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Helper to extract folder ID from Google Drive URL
function extractFolderId(driveUrl: string): string | null {
  if (!driveUrl) return null;
  
  // Match patterns like:
  // https://drive.google.com/drive/folders/FOLDER_ID
  // https://drive.google.com/drive/u/0/folders/FOLDER_ID
  // https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = driveUrl.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Helper to refresh token if needed
async function getValidAccessToken(supabase: any, projectId: string): Promise<string | null> {
  const { data: tokenData, error } = await supabase
    .from("google_drive_tokens")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error || !tokenData) {
    console.log("No Drive tokens found for project:", projectId);
    return null;
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = new Date(tokenData.expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
    console.log("Token expired or expiring soon, refreshing...");
    
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshResponse.json();

    if (refreshData.error) {
      console.error("Token refresh failed:", refreshData);
      return null;
    }

    // Update token in database
    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000));
    await supabase
      .from("google_drive_tokens")
      .update({
        access_token: refreshData.access_token,
        expires_at: newExpiresAt.toISOString(),
      })
      .eq("project_id", projectId);

    return refreshData.access_token;
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, action } = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log("Google Drive Files - Action:", action, "Project:", projectId);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get project to find the Drive folder URL
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .select("documents_link")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found");
    }

    if (!project.documents_link) {
      return new Response(JSON.stringify({ 
        files: [],
        message: "No documents link configured for this project"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const folderId = extractFolderId(project.documents_link);
    if (!folderId) {
      throw new Error("Could not extract folder ID from documents link");
    }

    console.log("Extracted folder ID:", folderId);

    // Get valid access token
    const accessToken = await getValidAccessToken(supabase, projectId);
    if (!accessToken) {
      return new Response(JSON.stringify({ 
        files: [],
        needsAuth: true,
        message: "Google Drive not connected"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: List files
    if (action === "list" || !action) {
      const filesUrl = new URL("https://www.googleapis.com/drive/v3/files");
      filesUrl.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
      filesUrl.searchParams.set("fields", "files(id,name,mimeType,size,modifiedTime,webViewLink)");
      filesUrl.searchParams.set("pageSize", "100");
      filesUrl.searchParams.set("orderBy", "modifiedTime desc");

      const filesResponse = await fetch(filesUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const filesData = await filesResponse.json();

      if (filesData.error) {
        console.error("Drive API error:", filesData.error);
        if (filesData.error.code === 401 || filesData.error.code === 403) {
          return new Response(JSON.stringify({ 
            files: [],
            needsAuth: true,
            message: "Drive access expired or revoked"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(filesData.error.message);
      }

      return new Response(JSON.stringify({ 
        files: filesData.files || [],
        folderId 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Read file content (for text-based files)
    if (action === "read") {
      const { fileId, mimeType } = await req.json();

      if (!fileId) {
        throw new Error("fileId is required for read action");
      }

      let content = "";
      const readableMimeTypes = [
        "text/plain",
        "text/csv",
        "text/markdown",
        "application/json",
        "text/html",
      ];

      // For Google Docs, Sheets, Slides - export as text
      if (mimeType === "application/vnd.google-apps.document") {
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
        const response = await fetch(exportUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        content = await response.text();
      } 
      else if (mimeType === "application/vnd.google-apps.spreadsheet") {
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
        const response = await fetch(exportUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        content = await response.text();
      }
      else if (mimeType === "application/vnd.google-apps.presentation") {
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
        const response = await fetch(exportUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        content = await response.text();
      }
      // For regular text files
      else if (readableMimeTypes.some(t => mimeType?.startsWith(t))) {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const response = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        content = await response.text();
      }
      // For PDFs - just note that it's a PDF (full extraction would require a library)
      else if (mimeType === "application/pdf") {
        content = "[Documento PDF - conteúdo não pode ser extraído diretamente]";
      }
      else {
        content = `[Arquivo ${mimeType} - formato não suportado para leitura de texto]`;
      }

      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Get all readable content for AI context
    if (action === "context") {
      // List all files
      const filesUrl = new URL("https://www.googleapis.com/drive/v3/files");
      filesUrl.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
      filesUrl.searchParams.set("fields", "files(id,name,mimeType,size,modifiedTime)");
      filesUrl.searchParams.set("pageSize", "50");
      filesUrl.searchParams.set("orderBy", "modifiedTime desc");

      const filesResponse = await fetch(filesUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const filesData = await filesResponse.json();

      if (filesData.error) {
        console.error("Drive API error:", filesData.error);
        throw new Error(filesData.error.message);
      }

      const files = filesData.files || [];
      const documentsContent: { name: string; content: string; type: string }[] = [];

      // Read content from readable files
      for (const file of files) {
        try {
          let content = "";
          
          if (file.mimeType === "application/vnd.google-apps.document") {
            const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
            const response = await fetch(exportUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
              content = await response.text();
            }
          } 
          else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
            const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`;
            const response = await fetch(exportUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
              content = await response.text();
            }
          }
          else if (file.mimeType === "application/vnd.google-apps.presentation") {
            const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
            const response = await fetch(exportUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
              content = await response.text();
            }
          }
          else if (file.mimeType?.startsWith("text/") || 
                   file.mimeType === "application/json") {
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
            const response = await fetch(downloadUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
              content = await response.text();
            }
          }

          if (content && content.length > 0) {
            // Limit content per file to avoid context overflow
            documentsContent.push({
              name: file.name,
              content: content.substring(0, 10000),
              type: file.mimeType
            });
          }
        } catch (fileError) {
          console.error(`Error reading file ${file.name}:`, fileError);
        }
      }

      console.log(`Read content from ${documentsContent.length} files`);

      return new Response(JSON.stringify({ 
        documents: documentsContent,
        totalFiles: files.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Google Drive Files error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
