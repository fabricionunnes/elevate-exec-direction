import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  htmlLink: string;
  attendees?: Array<{
    email: string;
    self?: boolean;
    organizer?: boolean;
    responseStatus?: string;
  }>;
  organizer?: {
    email: string;
    self?: boolean;
  };
}

// Helper function to transcribe recording using AssemblyAI
async function transcribeRecordingWithAI(
  recordingUrl: string, 
  googleAccessToken: string,
  supabase: any
): Promise<string | null> {
  const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
  
  if (!ASSEMBLYAI_API_KEY) {
    console.log("AssemblyAI API key not configured, skipping AI transcription");
    return null;
  }

  // Extract file ID from Google Drive URL
  const fileIdMatch = recordingUrl.match(/\/d\/([^\/]+)/);
  if (!fileIdMatch) {
    console.log("Could not extract file ID from URL:", recordingUrl);
    return null;
  }

  const fileId = fileIdMatch[1];
  console.log(`Starting AI transcription for file: ${fileId}`);

  try {
    // Get file metadata to check size
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    );

    if (!metadataResponse.ok) {
      console.error("Failed to get file metadata:", metadataResponse.status);
      return null;
    }

    const metadata = await metadataResponse.json();
    const fileSize = parseInt(metadata.size || "0", 10);
    const maxSize = 100 * 1024 * 1024; // 100MB limit for AssemblyAI streaming

    if (fileSize > maxSize) {
      console.log(`File too large for AI transcription: ${Math.round(fileSize / 1024 / 1024)}MB`);
      return null;
    }

    console.log(`File size: ${Math.round(fileSize / 1024 / 1024)}MB, proceeding with download...`);

    // Download file using authenticated request (not webContentLink which fails for large files)
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    );

    if (!downloadResponse.ok) {
      console.error("Failed to download file from Drive:", downloadResponse.status);
      return null;
    }

    // Get the file as a Blob
    const fileBlob = await downloadResponse.blob();
    console.log(`Downloaded file: ${fileBlob.size} bytes, type: ${fileBlob.type}`);

    // Upload to AssemblyAI
    console.log("Uploading to AssemblyAI...");
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        "Authorization": ASSEMBLYAI_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: fileBlob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("AssemblyAI upload error:", errorText);
      return null;
    }

    const uploadData = await uploadResponse.json();
    const uploadUrl = uploadData.upload_url;
    console.log(`File uploaded to AssemblyAI: ${uploadUrl}`);

    // Submit for transcription
    console.log("Submitting to AssemblyAI for transcription...");
    const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        "Authorization": ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        language_code: "pt",
        speaker_labels: true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error("AssemblyAI submit error:", errorText);
      return null;
    }

    const submitData = await submitResponse.json();
    const transcriptId = submitData.id;
    console.log(`AssemblyAI transcript ID: ${transcriptId}`);

    // Poll for completion (max 5 minutes)
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        { headers: { "Authorization": ASSEMBLYAI_API_KEY } }
      );

      if (!statusResponse.ok) {
        console.error("AssemblyAI status check failed");
        return null;
      }

      const statusData = await statusResponse.json();
      
      if (statusData.status === "completed") {
        console.log("AssemblyAI transcription completed");
        console.log(`AssemblyAI result - text length: ${statusData.text?.length || 0}, utterances: ${statusData.utterances?.length || 0}`);
        
        // Format with speaker labels if available
        if (statusData.utterances && statusData.utterances.length > 0) {
          const formatted = statusData.utterances
            .map((u: { speaker: string; text: string }) => `**Participante ${u.speaker}:** ${u.text}`)
            .join("\n\n");
          console.log(`Returning formatted transcript: ${formatted.length} chars`);
          return formatted;
        }
        
        if (statusData.text) {
          console.log(`Returning raw text: ${statusData.text.length} chars`);
          return statusData.text;
        }
        
        console.log("AssemblyAI returned no text content");
        return null;
      } else if (statusData.status === "error") {
        console.error("AssemblyAI transcription error:", statusData.error);
        return null;
      }
      
      console.log(`AssemblyAI status: ${statusData.status}, waiting...`);
    }

    console.log("AssemblyAI transcription timed out");
    return null;

  } catch (error) {
    console.error("AI transcription error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user from authorization header (validated via signing-keys)
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/bearer\s+/i, "").trim();

    // Validate JWT using getClaims (required when verify_jwt=false)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.error("JWT validation error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = { id: claimsData.claims.sub };

    // Use admin client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log(`Google Calendar action: ${action} for user: ${user.id}`);

    // Check for target_user_id query param (for CS/Admin viewing other calendars)
    const targetUserId = url.searchParams.get("target_user_id");
    const effectiveUserId = targetUserId || user.id;

    // Check if user has Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", effectiveUserId)
      .maybeSingle();

    if (action === "check-connection") {
      return new Response(
        JSON.stringify({ connected: !!tokenData && !tokenError }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list-connected-staff") {
      // List all staff members who have connected their Google Calendar
      const { data: connectedTokens } = await supabase
        .from("user_google_tokens")
        .select("user_id");

      if (!connectedTokens || connectedTokens.length === 0) {
        return new Response(
          JSON.stringify({ staff: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userIds = connectedTokens.map((t) => t.user_id);

      // Get staff info for these users
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, user_id")
        .in("user_id", userIds)
        .eq("is_active", true);

      return new Response(
        JSON.stringify({ staff: staffData || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      if (tokenData) {
        await supabase
          .from("user_google_tokens")
          .delete()
          .eq("user_id", user.id);
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-token") {
      const body = await req.json();
      const { access_token, refresh_token, expires_in } = body;

      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

      const { error: upsertError } = await supabase
        .from("user_google_tokens")
        .upsert({
          user_id: user.id,
          access_token,
          refresh_token,
          token_expires_at: expiresAt.toISOString(),
        }, {
          onConflict: "user_id"
        });

      if (upsertError) {
        console.error("Token save error:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to save token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "events") {
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let accessToken = tokenData.access_token;

      // Check if token is expired and refresh if needed
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        console.log("Token expired, attempting refresh...");
        
        if (!tokenData.refresh_token) {
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (!googleClientId || !googleClientSecret) {
          console.error("Missing Google OAuth credentials for token refresh");
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Refresh the token
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: tokenData.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error("Token refresh failed:", errorText);
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000);

        // Update token in database
        await supabase
          .from("user_google_tokens")
          .update({
            access_token: accessToken,
            token_expires_at: newExpiresAt.toISOString(),
          })
          .eq("user_id", effectiveUserId);

        console.log("Token refreshed successfully");
      }

      // Fetch calendar events - include past 7 days and next 30 days
      const now = new Date();
      const pastDays = 7;
      const futureDays = 30;
      const timeMin = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000).toISOString();

      const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`;

      console.log("Fetching calendar events...");
      
      const calendarResponse = await fetch(calendarUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text();
        console.error("Calendar API error:", errorText);
        
        if (calendarResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to fetch calendar events" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const calendarData = await calendarResponse.json();
      const events: CalendarEvent[] = calendarData.items || [];

      // Process events to extract meeting links
      const processedEvents = events.map((event) => {
        let meetingLink = event.hangoutLink || null;
        
        // Check for other conference links
        if (!meetingLink && event.conferenceData?.entryPoints) {
          const videoEntry = event.conferenceData.entryPoints.find(
            (ep) => ep.entryPointType === "video"
          );
          if (videoEntry) {
            meetingLink = videoEntry.uri;
          }
        }

        // Check if current user is an attendee (not just organizer)
        const isOrganizer = event.organizer?.self === true;
        const isAttendee = event.attendees?.some((a) => a.self === true) || false;
        
        // Extract attendee emails for filtering on frontend
        const attendeeEmails = event.attendees?.map((a) => a.email) || [];

        return {
          id: event.id,
          title: event.summary || "(Sem título)",
          description: event.description,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          meetingLink,
          calendarLink: event.htmlLink,
          isOrganizer,
          isAttendee,
          attendeeEmails,
        };
      });

      console.log(`Found ${processedEvents.length} events`);

      return new Response(
        JSON.stringify({ events: processedEvents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create-event") {
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        console.error("Failed to parse request body:", parseError);
        return new Response(
          JSON.stringify({ error: "Invalid request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { title, description, startDateTime, endDateTime, attendees, target_user_id } = body;
      console.log("create-event body:", { title, startDateTime, endDateTime, target_user_id });

      if (!title || !startDateTime || !endDateTime) {
        console.error("Missing required fields:", { title, startDateTime, endDateTime });
        return new Response(
          JSON.stringify({ error: "Missing required fields: title, startDateTime, endDateTime" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine which user's calendar to use
      const calendarUserId = target_user_id || user.id;
      console.log("Using calendar for user:", calendarUserId);

      // Get token for the target calendar user
      const { data: calendarTokenData, error: calendarTokenError } = await supabase
        .from("user_google_tokens")
        .select("*")
        .eq("user_id", calendarUserId)
        .maybeSingle();

      console.log("Token lookup result:", { hasToken: !!calendarTokenData, error: calendarTokenError?.message });

      if (!calendarTokenData || calendarTokenError) {
        console.error("No token found for user:", calendarUserId);
        return new Response(
          JSON.stringify({ error: "Target user not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let accessToken = calendarTokenData.access_token;

      // Check if token is expired and refresh if needed
      if (calendarTokenData.token_expires_at && new Date(calendarTokenData.token_expires_at) < new Date()) {
        console.log("Token expired for create-event, attempting refresh...");
        
        if (!calendarTokenData.refresh_token) {
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (!googleClientId || !googleClientSecret) {
          console.error("Missing Google OAuth credentials for token refresh");
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Refresh the token
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: calendarTokenData.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error("Token refresh failed:", errorText);
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000);

        // Update token in database
        await supabase
          .from("user_google_tokens")
          .update({
            access_token: accessToken,
            token_expires_at: newExpiresAt.toISOString(),
          })
          .eq("user_id", calendarUserId);

        console.log("Token refreshed successfully for create-event");
      }

      // Create event with Google Meet link
      const eventData: Record<string, unknown> = {
        summary: title,
        description: description || "",
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
      };

      // Add attendees if provided
      if (attendees && Array.isArray(attendees) && attendees.length > 0) {
        eventData.attendees = attendees.map((email: string) => ({ email }));
      }

      console.log("Creating calendar event with Meet link...", eventData);

      const createUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all";
      
      const createResponse = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("Create event error:", errorText);
        
        if (createResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (createResponse.status === 403) {
          return new Response(
            JSON.stringify({ error: "Permissão negada. Reconecte sua conta Google com permissões de escrita.", needsAuth: true }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to create event: " + errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const createdEvent = await createResponse.json();
      console.log("Event created successfully:", createdEvent.id);

      const meetingLink = createdEvent.hangoutLink || 
        createdEvent.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video")?.uri;

      return new Response(
        JSON.stringify({
          success: true,
          event: {
            id: createdEvent.id,
            title: createdEvent.summary,
            start: createdEvent.start.dateTime || createdEvent.start.date,
            end: createdEvent.end.dateTime || createdEvent.end.date,
            meetingLink,
            calendarLink: createdEvent.htmlLink,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-event") {
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { eventId, title, description, startDateTime, endDateTime, attendees } = body;

      if (!eventId || !title || !startDateTime || !endDateTime) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: eventId, title, startDateTime, endDateTime" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      // Check if token is expired
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update event
      const eventData: Record<string, unknown> = {
        summary: title,
        description: description || "",
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
      };

      // Add attendees if provided
      if (attendees && Array.isArray(attendees) && attendees.length > 0) {
        eventData.attendees = attendees.map((email: string) => ({ email }));
      }

      console.log("Updating calendar event...", eventData);

      const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`;
      
      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("Update event error:", errorText);
        
        if (updateResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (updateResponse.status === 403) {
          return new Response(
            JSON.stringify({ error: "Permissão negada. Reconecte sua conta Google com permissões de escrita.", needsAuth: true }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to update event: " + errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatedEvent = await updateResponse.json();
      console.log("Event updated successfully:", updatedEvent.id);

      const meetingLink = updatedEvent.hangoutLink || 
        updatedEvent.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video")?.uri;

      return new Response(
        JSON.stringify({
          success: true,
          event: {
            id: updatedEvent.id,
            title: updatedEvent.summary,
            start: updatedEvent.start.dateTime || updatedEvent.start.date,
            end: updatedEvent.end.dateTime || updatedEvent.end.date,
            meetingLink,
            calendarLink: updatedEvent.htmlLink,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-event") {
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { eventId } = body;

      if (!eventId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: eventId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      // Check if token is expired
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Deleting calendar event...", eventId);

      const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`;
      
      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!deleteResponse.ok && deleteResponse.status !== 204) {
        const errorText = await deleteResponse.text();
        console.error("Delete event error:", errorText);
        
        if (deleteResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to delete event: " + errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Event deleted successfully");

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch-recordings") {
      // Fetch Google Meet recordings from Google Drive
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let accessToken = tokenData.access_token;

      // Check if token is expired and refresh if needed
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        console.log("Token expired, attempting refresh for recordings...");
        
        if (!tokenData.refresh_token) {
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (!googleClientId || !googleClientSecret) {
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: tokenData.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!refreshResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000);

        await supabase
          .from("user_google_tokens")
          .update({
            access_token: accessToken,
            token_expires_at: newExpiresAt.toISOString(),
          })
          .eq("user_id", effectiveUserId);
      }

      // Search for Google Meet recordings in Drive
      // Meet recordings are stored in "Meet Recordings" folder
      const searchQuery = "mimeType='video/mp4' and name contains 'Meet Recording'";
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,createdTime,webViewLink,webContentLink)&orderBy=createdTime desc&pageSize=50`;

      console.log("Fetching recordings from Google Drive...");

      const driveResponse = await fetch(driveUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!driveResponse.ok) {
        const errorText = await driveResponse.text();
        console.error("Drive API error:", errorText);
        
        if (driveResponse.status === 401 || driveResponse.status === 403) {
          // Drive scope might not be authorized - this is expected for now
          return new Response(
            JSON.stringify({ 
              recordings: [], 
              message: "Para buscar gravações automaticamente, reconecte sua conta Google com permissão do Drive",
              needsDriveAuth: true 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to fetch recordings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const driveData = await driveResponse.json();
      const recordings = (driveData.files || []).map((file: { id: string; name: string; createdTime: string; webViewLink: string }) => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        link: file.webViewLink,
      }));

      console.log(`Found ${recordings.length} recordings`);

      return new Response(
        JSON.stringify({ recordings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync-recordings") {
      // Sync recordings with meeting notes - match by date/title
      const body = await req.json();
      const { projectId } = body;

      if (!projectId) {
        return new Response(
          JSON.stringify({ error: "Missing projectId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let accessToken = tokenData.access_token;

      // Refresh token if needed (similar logic as above)
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (!googleClientId || !googleClientSecret || !tokenData.refresh_token) {
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: tokenData.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;
        }
      }

      // Get meetings without recording links OR without transcripts (using new transcript column)
      const { data: meetingsToSync } = await supabase
        .from("onboarding_meeting_notes")
        .select("id, meeting_title, meeting_date, subject, recording_link, transcript")
        .eq("project_id", projectId);

      if (!meetingsToSync || meetingsToSync.length === 0) {
        return new Response(
          JSON.stringify({ synced: 0, transcriptsSynced: 0, message: "No meetings to sync" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Search for recordings AND transcripts - more flexible query
      // Recordings: any mp4 files in Meet Recordings folder
      const recordingsQuery = "mimeType='video/mp4'";
      const transcriptQuery = "mimeType='text/vtt' or mimeType='text/plain' or mimeType='application/x-subrip' or mimeType='text/srt'";
      
      const combinedQuery = `(${recordingsQuery}) or (${transcriptQuery})`;
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(combinedQuery)}&fields=files(id,name,createdTime,webViewLink,mimeType)&orderBy=createdTime desc&pageSize=200`;

      const driveResponse = await fetch(driveUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

       if (!driveResponse.ok) {
         const errorText = await driveResponse.text();
         console.error("Drive API error (sync-recordings):", errorText);

         let parsed: any = null;
         try {
           parsed = JSON.parse(errorText);
         } catch {
           // ignore
         }

         // Check for various Drive API permission/scope errors
         const isScopeInsufficient = 
           driveResponse.status === 403 &&
           (errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
            errorText.includes("insufficientPermissions") ||
            errorText.includes("Insufficient Permission") ||
            (parsed?.error?.details || []).some((d: any) => 
              d?.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT"
            ));

         const isDriveApiDisabled =
           driveResponse.status === 403 &&
           !isScopeInsufficient &&
           (errorText.includes("accessNotConfigured") ||
             errorText.includes("SERVICE_DISABLED") ||
             parsed?.error?.status === "PERMISSION_DENIED" &&
               (parsed?.error?.message || "").toLowerCase().includes("drive api"));

         if (isDriveApiDisabled) {
           return new Response(
             JSON.stringify({
               synced: 0,
               transcriptsSynced: 0,
               needsDriveApi: true,
               message:
                 "A API do Google Drive não está habilitada no seu projeto Google. Ative a Google Drive API e tente novamente.",
             }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }

         if (isScopeInsufficient) {
           return new Response(
             JSON.stringify({
               synced: 0,
               transcriptsSynced: 0,
               needsDriveAuth: true,
               message:
                 "O consultor precisa reconectar a conta Google para autorizar o acesso ao Drive. Vá em Escritório Virtual > Google Calendar > Desconectar e conectar novamente.",
             }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }

         if (driveResponse.status === 401 || driveResponse.status === 403) {
           return new Response(
             JSON.stringify({
               synced: 0,
               transcriptsSynced: 0,
               needsDriveAuth: true,
               message:
                 "Para buscar gravações automaticamente, reconecte sua conta Google com permissão do Drive.",
             }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }

         return new Response(
           JSON.stringify({ synced: 0, transcriptsSynced: 0, error: "Failed to fetch recordings" }),
           { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }

      const driveData = await driveResponse.json();
      const allFiles = driveData.files || [];
      
      // Separate recordings and transcripts
      const recordings = allFiles.filter((f: { mimeType: string }) => f.mimeType === 'video/mp4');
      const transcripts = allFiles.filter((f: { mimeType: string }) => 
        f.mimeType === 'text/vtt' || f.mimeType === 'text/plain' || f.mimeType === 'application/x-subrip' || f.mimeType === 'text/srt'
      );

      console.log(`Found ${recordings.length} recordings and ${transcripts.length} transcripts`);
      
      // Log first few files for debugging
      if (recordings.length > 0) {
        console.log("Sample recordings:", recordings.slice(0, 3).map((r: { name: string; createdTime: string }) => ({ name: r.name, date: r.createdTime })));
      }
      if (transcripts.length > 0) {
        console.log("Sample transcripts:", transcripts.slice(0, 3).map((t: { name: string; createdTime: string }) => ({ name: t.name, date: t.createdTime })));
      }

      let syncedRecordings = 0;
      let syncedTranscripts = 0;

      // Helper to parse VTT/SRT/Chat content to plain text
      const parseSubtitleToText = (content: string, mimeType: string): string => {
        const lines = content.split('\n');
        const textLines: string[] = [];
        
        for (const line of lines) {
          let trimmed = line.trim();
          // Skip empty lines and metadata
          if (!trimmed) continue;
          if (trimmed === 'WEBVTT') continue;
          if (/^\d+$/.test(trimmed)) continue; // SRT sequence numbers
          if (/-->/.test(trimmed)) continue; // VTT timestamp lines (00:00:01.000 --> 00:00:05.000)
          if (/^NOTE/.test(trimmed)) continue; // VTT notes
          if (/^STYLE/.test(trimmed)) continue;
          if (/^Kind:/.test(trimmed)) continue;
          if (/^Language:/.test(trimmed)) continue;
          
          // Remove inline timestamps from Google Meet chat format (00:04:23.451,00:04:26.451 or 00:04:23)
          trimmed = trimmed.replace(/^\d{2}:\d{2}:\d{2}(\.\d+)?(,\d{2}:\d{2}:\d{2}(\.\d+)?)?\s*/g, '');
          trimmed = trimmed.replace(/^\d{2}:\d{2}(:\d{2})?\s*/g, ''); // Also match MM:SS format
          
          // Clean HTML tags if any
          trimmed = trimmed.replace(/<[^>]*>/g, '');
          
          // Skip promotional/extension messages
          if (trimmed.toLowerCase().includes('tactiq.io')) continue;
          if (trimmed.toLowerCase().includes('transcrevendo esta chamada')) continue;
          
          if (trimmed) {
            textLines.push(trimmed);
          }
        }
        
        return textLines.join('\n');
      };

      // Download transcript content
      const downloadTranscript = async (fileId: string, mimeType: string): Promise<string | null> => {
        try {
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
          const downloadResponse = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          
          if (!downloadResponse.ok) {
            console.error(`Failed to download transcript ${fileId}:`, downloadResponse.status);
            return null;
          }
          
          const content = await downloadResponse.text();
          return parseSubtitleToText(content, mimeType);
        } catch (error) {
          console.error(`Error downloading transcript ${fileId}:`, error);
          return null;
        }
      };

      // Fetch embedded video captions/transcripts from Google Meet recordings
      const getVideoTranscript = async (videoFileId: string): Promise<string | null> => {
        try {
          // First, try to get captions associated with the video file
          // Google Meet recordings store transcripts as caption tracks
          const captionsUrl = `https://www.googleapis.com/drive/v3/files/${videoFileId}?fields=videoMediaMetadata,capabilities&supportsAllDrives=true`;
          const metaResponse = await fetch(captionsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!metaResponse.ok) {
            console.log(`Could not fetch video metadata for captions: ${metaResponse.status}`);
          }

          // Try to find transcript file that matches the video name pattern
          // Meet recordings: "Meeting Name - Date Time - Recording"  
          // Meet transcripts: "Meeting Name - Date Time - Transcript"
          const videoMetaUrl = `https://www.googleapis.com/drive/v3/files/${videoFileId}?fields=name,parents&supportsAllDrives=true`;
          const videoMeta = await fetch(videoMetaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!videoMeta.ok) {
            console.log(`Could not get video file name: ${videoMeta.status}`);
            return null;
          }

          const videoData = await videoMeta.json();
          const videoName = videoData.name || "";
          
          // Extract the base name (before "- Recording" or similar)
          // Pattern: "Company Name - 2026/01/07 10:30 GMT-03:00 - Recording"
          const baseName = videoName.replace(/\s*-\s*(Recording|Gravação).*$/i, '');
          
          if (!baseName) {
            console.log(`Could not extract base name from: ${videoName}`);
            return null;
          }

          console.log(`Looking for transcript matching video: "${baseName}"`);

          // Search for transcript file with matching base name
          const transcriptSearchQuery = `name contains 'Transcript' or name contains 'Transcrição'`;
          const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(transcriptSearchQuery)}&fields=files(id,name,mimeType,createdTime)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;
          
          const searchResponse = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!searchResponse.ok) {
            console.log(`Transcript search failed: ${searchResponse.status}`);
            return null;
          }

          const searchData = await searchResponse.json();
          const transcriptFiles = searchData.files || [];

          // Find a transcript that matches the video's base name
          const matchingTranscript = transcriptFiles.find((t: { name: string; id: string }) => {
            const transcriptBase = t.name.replace(/\s*-\s*(Transcript|Transcrição).*$/i, '');
            return transcriptBase.toLowerCase() === baseName.toLowerCase() ||
                   t.name.toLowerCase().includes(baseName.toLowerCase().substring(0, 30));
          });

          if (matchingTranscript) {
            console.log(`Found matching transcript: "${matchingTranscript.name}" (${matchingTranscript.id})`);
            
            // Download the transcript content
            const content = await downloadTranscript(matchingTranscript.id, matchingTranscript.mimeType || 'text/vtt');
            if (content && content.length > 50) {
              return content;
            }
          }

          console.log(`No matching transcript found for video: ${baseName}`);
          return null;
        } catch (error) {
          console.error(`Error fetching video transcript:`, error);
          return null;
        }
      };

      // Match files with meetings by date (with 1 day tolerance for timezone differences)
      for (const meeting of meetingsToSync) {
        const meetingDate = new Date(meeting.meeting_date);
        const meetingDateStr = meetingDate.toISOString().split('T')[0];
        const prevDayStr = new Date(meetingDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const nextDayStr = new Date(meetingDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const titleWords = (meeting.meeting_title || meeting.subject || "").toLowerCase()
          .split(/[\s\-_]+/)
          .filter((w: string) => w.length > 2);

        console.log(`Checking meeting: "${meeting.meeting_title}" on ${meetingDateStr}, keywords: [${titleWords.join(', ')}]`);

        // Try to match recording if not already linked
        if (!meeting.recording_link) {
          const matchingRecording = recordings.find((rec: { createdTime: string; name: string }) => {
            const recDate = new Date(rec.createdTime);
            const recDateStr = recDate.toISOString().split('T')[0];
            
            // Accept same day, previous day, or next day
            const dateMatch = recDateStr === meetingDateStr || recDateStr === prevDayStr || recDateStr === nextDayStr;
            
            if (dateMatch) {
              const recName = rec.name.toLowerCase();
              // More flexible matching: check if any keyword is in the file name
              const keywordMatch = titleWords.length === 0 || titleWords.some((word: string) => recName.includes(word));
              console.log(`  Recording candidate: "${rec.name}" (${recDateStr}) - dateMatch: ${dateMatch}, keywordMatch: ${keywordMatch}`);
              return keywordMatch;
            }
            return false;
          });

          if (matchingRecording) {
            const { error: updateError } = await supabase
              .from("onboarding_meeting_notes")
              .update({ recording_link: matchingRecording.webViewLink })
              .eq("id", meeting.id);

            if (!updateError) {
              syncedRecordings++;
              console.log(`✓ Matched recording for meeting: ${meeting.meeting_title}`);
            }
          }
        }

        // Try to match transcript if transcript column is empty
        if (!meeting.transcript) {
          // First, try to find transcript file in Drive (separate .vtt/.sbv files)
          const matchingTranscript = transcripts.find((t: { createdTime: string; name: string }) => {
            const tDate = new Date(t.createdTime);
            const tDateStr = tDate.toISOString().split('T')[0];
            
            // Accept same day, previous day, or next day
            const dateMatch = tDateStr === meetingDateStr || tDateStr === prevDayStr || tDateStr === nextDayStr;
            
            if (dateMatch) {
              const tName = t.name.toLowerCase();
              const keywordMatch = titleWords.length === 0 || titleWords.some((word: string) => tName.includes(word));
              console.log(`  Transcript candidate: "${t.name}" (${tDateStr}) - dateMatch: ${dateMatch}, keywordMatch: ${keywordMatch}`);
              return keywordMatch;
            }
            return false;
          });

          let transcriptSaved = false;

          if (matchingTranscript) {
            console.log(`Downloading transcript: ${matchingTranscript.name} (${matchingTranscript.id})`);
            const transcriptText = await downloadTranscript(matchingTranscript.id, matchingTranscript.mimeType);
            
            console.log(`Downloaded transcript length: ${transcriptText?.length || 0} chars`);
            
            if (transcriptText && transcriptText.length > 50) {
              console.log(`Saving transcript to meeting ${meeting.id}...`);
              const { error: updateError, data: updateData } = await supabase
                .from("onboarding_meeting_notes")
                .update({ transcript: transcriptText })
                .eq("id", meeting.id)
                .select("id, transcript");

              if (updateError) {
                console.error(`Error saving transcript: ${JSON.stringify(updateError)}`);
              } else {
                syncedTranscripts++;
                transcriptSaved = true;
                console.log(`✓ Matched Drive transcript file for meeting: ${meeting.meeting_title}`);
                console.log(`Saved transcript preview: ${transcriptText.substring(0, 100)}...`);
              }
            } else {
              console.log(`Transcript too short (${transcriptText?.length || 0} chars), skipping`);
            }
          }

          // If no separate transcript file found, try to get the embedded video transcript
          if (!transcriptSaved && meeting.recording_link) {
            // Extract file ID from recording link
            const fileIdMatch = meeting.recording_link.match(/\/d\/([^\/]+)/);
            
            if (fileIdMatch) {
              const videoFileId = fileIdMatch[1];
              console.log(`Trying to get embedded transcript for video: ${videoFileId}`);
              
              const embeddedTranscript = await getVideoTranscript(videoFileId);
              
              if (embeddedTranscript && embeddedTranscript.length > 50) {
                const { error: updateError } = await supabase
                  .from("onboarding_meeting_notes")
                  .update({ transcript: embeddedTranscript })
                  .eq("id", meeting.id);

                if (!updateError) {
                  syncedTranscripts++;
                  transcriptSaved = true;
                  console.log(`✓ Got embedded video transcript for meeting: ${meeting.meeting_title}`);
                }
              }
            }
          }

          // Last resort: try AI transcription
          if (!transcriptSaved && meeting.recording_link) {
            console.log(`No Drive transcript found, attempting AI transcription for: ${meeting.meeting_title}`);
            
            try {
              const transcriptResult = await transcribeRecordingWithAI(meeting.recording_link, accessToken, supabase);
              
              if (transcriptResult && transcriptResult.length > 50) {
                const { error: updateError } = await supabase
                  .from("onboarding_meeting_notes")
                  .update({ transcript: transcriptResult })
                  .eq("id", meeting.id);

                if (!updateError) {
                  syncedTranscripts++;
                  console.log(`✓ AI transcription completed for meeting: ${meeting.meeting_title}`);
                }
              }
            } catch (transcribeError) {
              console.error(`AI transcription failed for ${meeting.meeting_title}:`, transcribeError);
              // Continue with next meeting, don't fail the whole sync
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          synced: syncedRecordings, 
          transcriptsSynced: syncedTranscripts,
          total: meetingsToSync.length 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Google Calendar function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
