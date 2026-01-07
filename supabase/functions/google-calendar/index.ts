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

      // Fetch calendar events
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Next 30 days

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

        return {
          id: event.id,
          title: event.summary || "(Sem título)",
          description: event.description,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          meetingLink,
          calendarLink: event.htmlLink,
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

      // Get meetings without recording links
      const { data: meetingsWithoutRecording } = await supabase
        .from("onboarding_meeting_notes")
        .select("id, meeting_title, meeting_date, subject")
        .eq("project_id", projectId)
        .is("recording_link", null);

      if (!meetingsWithoutRecording || meetingsWithoutRecording.length === 0) {
        return new Response(
          JSON.stringify({ synced: 0, message: "No meetings need recordings" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Search for recordings
      const searchQuery = "mimeType='video/mp4' and (name contains 'Meet Recording' or name contains 'Gravação')";
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,createdTime,webViewLink)&orderBy=createdTime desc&pageSize=100`;

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

         const isDriveApiDisabled =
           driveResponse.status === 403 &&
           (errorText.includes("accessNotConfigured") ||
             errorText.includes("SERVICE_DISABLED") ||
             parsed?.error?.status === "PERMISSION_DENIED" &&
               (parsed?.error?.message || "").toLowerCase().includes("drive api"));

         if (isDriveApiDisabled) {
           return new Response(
             JSON.stringify({
               synced: 0,
               needsDriveApi: true,
               message:
                 "A API do Google Drive não está habilitada no seu projeto Google. Ative a Google Drive API e tente novamente.",
             }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }

         if (driveResponse.status === 401 || driveResponse.status === 403) {
           return new Response(
             JSON.stringify({
               synced: 0,
               needsDriveAuth: true,
               message:
                 "Para buscar gravações automaticamente, reconecte sua conta Google com permissão do Drive.",
             }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }

         return new Response(
           JSON.stringify({ synced: 0, error: "Failed to fetch recordings" }),
           { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }

      const driveData = await driveResponse.json();
      const recordings = driveData.files || [];

      let syncedCount = 0;

      // Try to match recordings with meetings by date
      for (const meeting of meetingsWithoutRecording) {
        const meetingDate = new Date(meeting.meeting_date);
        const meetingDateStr = meetingDate.toISOString().split('T')[0];

        // Find recording from same day
        const matchingRecording = recordings.find((rec: { createdTime: string; name: string }) => {
          const recDate = new Date(rec.createdTime);
          const recDateStr = recDate.toISOString().split('T')[0];
          
          // Match by date and optionally by title similarity
          if (recDateStr === meetingDateStr) {
            // Check if recording name contains part of meeting title
            const titleWords = (meeting.meeting_title || meeting.subject || "").toLowerCase().split(" ");
            const recName = rec.name.toLowerCase();
            return titleWords.some((word: string) => word.length > 3 && recName.includes(word)) || true; // Fallback to date match
          }
          return false;
        });

        if (matchingRecording) {
          const { error: updateError } = await supabase
            .from("onboarding_meeting_notes")
            .update({ recording_link: matchingRecording.webViewLink })
            .eq("id", meeting.id);

          if (!updateError) {
            syncedCount++;
            console.log(`Matched recording for meeting: ${meeting.meeting_title}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ synced: syncedCount, total: meetingsWithoutRecording.length }),
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
